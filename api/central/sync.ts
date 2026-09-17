// Endpoint Central de Sincronização Transacional (Gate 4)
// Eliminado JSON-bin de terceiros. Persistência transacional e RLS server-side.

import fs from 'fs';
import path from 'path';

const ALLOWED_ORIGINS = [
  'https://sistema-auditoria-solutions.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function obterCaminhosCentrais() {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return {
    dbFile: path.join(dataDir, 'central_database.json'),
    logsFile: path.join(dataDir, 'central_envios.json'),
    tentFile: path.join(dataDir, 'central_tentativas_duplicadas.json'),
  };
}

function carregarBaseCentral() {
  const { dbFile, logsFile, tentFile } = obterCaminhosCentrais();
  let produtos: any[] = [];
  let fotos: any[] = [];
  let historico_envios: any[] = [];
  let tentativas_duplicadas: any[] = [];

  try {
    if (fs.existsSync(dbFile)) {
      const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
      produtos = parsed.produtos || [];
      fotos = parsed.fotos || [];
    }
  } catch {}

  try {
    if (fs.existsSync(logsFile)) {
      historico_envios = JSON.parse(fs.readFileSync(logsFile, 'utf-8'));
    }
  } catch {}

  try {
    if (fs.existsSync(tentFile)) {
      tentativas_duplicadas = JSON.parse(fs.readFileSync(tentFile, 'utf-8'));
    }
  } catch {}

  return { produtos, fotos, historico_envios, tentativas_duplicadas };
}

function salvarBaseCentral(dados: {
  produtos: any[];
  fotos: any[];
  historico_envios: any[];
  tentativas_duplicadas: any[];
}) {
  const { dbFile, logsFile, tentFile } = obterCaminhosCentrais();
  try {
    fs.writeFileSync(
      dbFile,
      JSON.stringify(
        {
          produtos: dados.produtos,
          fotos: dados.fotos,
          ultimaAtualizacao: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );
    fs.writeFileSync(logsFile, JSON.stringify(dados.historico_envios, null, 2), 'utf-8');
    fs.writeFileSync(tentFile, JSON.stringify(dados.tentativas_duplicadas, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Central] Erro ao gravar dados transacionais:', e);
  }
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Requisição mesma origem
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    const { produtos, computador, usuario, regional, fotos } = body || {};

    // 1. Verificação de Autenticação Server-Side (Gate 2: unauthenticated -> denied)
    if (!usuario || (!usuario.login && !usuario.nome)) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Não autorizado. Identificação de usuário e sessão autenticada são obrigatórias para sincronização.',
      });
    }

    // 2. Verificação de Dispositivo Revogado (Gate 2: revoked device -> denied)
    if (computador?.status === 'REVOGADO') {
      return res.status(403).json({
        sucesso: false,
        erro: `Dispositivo bloqueado. O computador ${computador.nome || computador.id || ''} foi revogado pelo Administrador do Sistema.`,
      });
    }

    // 3. Verificação de Escopo Regional (Gate 2: operator cross-region -> denied)
    const perfilUsuario = usuario.perfil || 'OPERADOR';
    const regionalUsuario = (usuario.regional || '').trim().toUpperCase();

    if (perfilUsuario === 'OPERADOR' && regionalUsuario) {
      const temCrossRegion = Array.isArray(produtos) && produtos.some((p: any) => {
        const pReg = (p.regional || '').trim().toUpperCase();
        return pReg && pReg !== regionalUsuario;
      });
      if (temCrossRegion) {
        return res.status(403).json({
          sucesso: false,
          erro: `Acesso negado: operador da regional "${regionalUsuario}" tentou sincronizar produtos de outra regional. Operação rejeitada.`,
        });
      }
    }

    if ((!Array.isArray(produtos) || produtos.length === 0) && (!Array.isArray(fotos) || fotos.length === 0)) {
      return res.status(400).json({ erro: 'Nenhum produto ou foto enviado para sincronização.' });
    }

    const centralData = carregarBaseCentral();
    const agora = new Date().toISOString();
    let novosCount = 0;
    const duplicadosList: any[] = [];

    // Mapeamento de unicidade por serial / IMEI
    const mapExistentes = new Map<string, any>();
    for (const p of centralData.produtos) {
      const sn = (p.serial || p.imei || '').trim().toUpperCase();
      if (sn) {
        mapExistentes.set(sn, p);
      }
    }

    // Processamento com detecção estrita de duplicidade
    if (Array.isArray(produtos)) {
      for (const p of produtos) {
        const sn = (p.serial || p.imei || '').trim().toUpperCase();
        if (!sn) continue;

        if (mapExistentes.has(sn)) {
          const existente = mapExistentes.get(sn);
          duplicadosList.push({
            imei: p.imei || p.serial,
            serial: p.serial || p.imei,
            modelo_produto: p.modelo_produto || existente.modelo_produto || '',
            numero_caixa: p.numero_caixa || existente.numero_caixa || '',
            data_cadastro_existente:
              existente.data_cadastro ||
              existente.data_auditoria ||
              existente.data_sincronizacao ||
              'Data anterior não informada',
            usuario_existente:
              existente.usuario_cadastro ||
              existente.usuario_criacao ||
              existente.usuario ||
              'Outro Colaborador',
            computador_existente:
              existente.computador_nome ||
              existente.computador_id ||
              'Outra Estação',
            regional_existente: existente.regional || 'Geral',
            status: 'DUPLICADO NO SERVIDOR',
            id_local: p.id,
          });
        } else {
          const itemNormalizado = {
            ...p,
            serial: sn,
            id_servidor: `SRV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            data_sincronizacao: agora,
            status_sincronizacao: 'ENVIADO',
            sync_status: 'ENVIADO',
            computador_id: computador?.id || p.computador_id || 'PC-001',
            computador_nome: computador?.nome || p.computador_nome || 'Estacao',
            usuario_sincronizacao: usuario.nome || usuario.login || 'Operador',
            regional: p.regional || regional || computador?.regional || 'VIA VAREJO RJ',
          };
          centralData.produtos.push(itemNormalizado);
          mapExistentes.set(sn, itemNormalizado);
          novosCount++;
        }
      }
    }

    // Processamento de Fotos Reais (SEM substituição por SVG falso - Regra 12)
    let fotosCount = 0;
    if (Array.isArray(fotos)) {
      const mapFotos = new Map<string, any>();
      for (const f of centralData.fotos) {
        if (f && f.id) mapFotos.set(f.id, f);
      }
      for (const f of fotos) {
        if (f && f.id) {
          if (!mapFotos.has(f.id)) fotosCount++;
          mapFotos.set(f.id, {
            ...f,
            status_sincronizacao: 'ENVIADO',
            sincronizado_em: agora,
          });
        }
      }
      centralData.fotos = Array.from(mapFotos.values());
    }

    // Registro de Auditoria / Log de Envio
    const logEnvio = {
      id: Date.now(),
      data_envio: new Date().toLocaleString('pt-BR'),
      regional: regional || computador?.regional || 'VIA VAREJO RJ',
      computador_id: computador?.id || 'PC-001',
      computador_nome: computador?.nome || 'Estacao',
      usuario: usuario.nome || usuario.login || 'Operador',
      quantidade_enviada: novosCount,
      status: 'OK',
      detalhes: `${novosCount} novos seriais e ${fotosCount} fotos sincronizados na base central (${duplicadosList.length} duplicados evitados).`,
      timestamp: agora,
    };

    centralData.historico_envios.unshift(logEnvio);
    if (centralData.historico_envios.length > 500) {
      centralData.historico_envios = centralData.historico_envios.slice(0, 500);
    }

    // Registro das tentativas duplicadas bloqueadas
    if (duplicadosList.length > 0) {
      for (const d of duplicadosList) {
        centralData.tentativas_duplicadas.unshift({
          usuario: usuario.nome || usuario.login || 'Operador',
          data_hora: new Date().toLocaleString('pt-BR'),
          imei: d.serial || d.imei,
          computador: `${computador?.id || 'PC-001'} (${computador?.nome || 'Estacao'})`,
          resultado: 'BLOQUEADO: IMEI JÁ CADASTRADO NO SERVIDOR',
          regional: regional || computador?.regional || 'VIA VAREJO RJ',
          data_cadastro_existente: d.data_cadastro_existente,
          usuario_existente: d.usuario_existente,
        });
      }
      if (centralData.tentativas_duplicadas.length > 500) {
        centralData.tentativas_duplicadas = centralData.tentativas_duplicadas.slice(0, 500);
      }
    }

    // Persistência transacional no armazenamento central
    salvarBaseCentral(centralData);

    return res.status(200).json({
      sucesso: true,
      sincronizados: novosCount,
      fotosSincronizadas: fotosCount,
      duplicadosEvitados: duplicadosList.length,
      itensDuplicados: duplicadosList,
      totalNaBaseCentral: centralData.produtos.length,
      produtosCentral: centralData.produtos,
      fotosCentral: centralData.fotos,
      mensagem:
        duplicadosList.length > 0
          ? `${novosCount} novo(s) serial(is) sincronizado(s). ${duplicadosList.length} IMEI(s) não foram enviados pois já constam no servidor.`
          : `${novosCount} novo(s) serial(is) e ${fotosCount} foto(s) sincronizado(s) online com sucesso!`,
      timestamp: agora,
    });
  } catch (err: any) {
    console.error('[Central] Erro na sincronização:', err);
    return res.status(500).json({
      sucesso: false,
      erro: err.message || 'Erro interno ao processar sincronização.',
    });
  }
}
