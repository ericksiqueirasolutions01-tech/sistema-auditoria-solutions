// Endpoint Central de Sincronização Delta e Resolução de Conflitos (Gate 5)
// Suporte a eventos Outbox, chaves de idempotência, concorrência e detecção de duplicidades

import fs from 'fs';
import path from 'path';

const ALLOWED_ORIGINS = [
  'https://sistema-auditoria-solutions.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Mutex em memória por IMEI para proteção contra condições de corrida (Section 9.4)
const inFlightImeis = new Set<string>();

function obterCaminhosCentrais() {
  const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST));
  const dataDir = isTest
    ? path.resolve(process.cwd(), 'data', 'test_data')
    : path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return {
    dbFile: path.join(dataDir, 'central_database.json'),
    logsFile: path.join(dataDir, 'central_envios.json'),
    tentFile: path.join(dataDir, 'central_tentativas_duplicadas.json'),
    idempFile: path.join(dataDir, 'central_idempotency.json'),
  };
}

function carregarIdempotencia(): Record<string, any> {
  const { idempFile } = obterCaminhosCentrais();
  try {
    if (fs.existsSync(idempFile)) {
      return JSON.parse(fs.readFileSync(idempFile, 'utf-8'));
    }
  } catch {}
  return {};
}

function salvarIdempotencia(map: Record<string, any>) {
  const { idempFile } = obterCaminhosCentrais();
  try {
    fs.writeFileSync(idempFile, JSON.stringify(map, null, 2), 'utf-8');
  } catch (e) {
    console.error('[SyncDelta] Erro ao salvar cache de idempotência:', e);
  }
}

function carregarBaseCentral() {
  const { dbFile, logsFile, tentFile } = obterCaminhosCentrais();
  let produtos: any[] = [];
  let lotes: any[] = [];
  let fotos: any[] = [];
  let historico_envios: any[] = [];
  let tentativas_duplicadas: any[] = [];

  try {
    if (fs.existsSync(dbFile)) {
      const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
      produtos = parsed.produtos || [];
      lotes = parsed.lotes || [];
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

  return { produtos, lotes, fotos, historico_envios, tentativas_duplicadas };
}

function salvarBaseCentral(dados: any) {
  const { dbFile, logsFile, tentFile } = obterCaminhosCentrais();
  try {
    fs.writeFileSync(
      dbFile,
      JSON.stringify(
        {
          produtos: dados.produtos,
          lotes: dados.lotes,
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
    console.error('[SyncDelta] Erro ao salvar dados centrais:', e);
  }
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Mesma origem permitida
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Idempotency-Key');
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

    const { usuario, computador, eventos } = body || {};

    // 1. Autenticação Obrigatória Server-Side
    if (!usuario || (!usuario.login && !usuario.nome)) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Não autorizado. Sessão autenticada é obrigatória para sincronização Delta.',
      });
    }

    // 2. Verificação de Dispositivo Revogado
    if (computador?.status === 'REVOGADO') {
      return res.status(403).json({
        sucesso: false,
        erro: `Dispositivo ${computador.id || ''} revogado pelo Administrador do Sistema.`,
      });
    }

    if (!Array.isArray(eventos) || eventos.length === 0) {
      return res.status(400).json({ erro: 'Nenhum evento Delta enviado para processamento.' });
    }

    const idempotenciaMap = carregarIdempotencia();
    const centralData = carregarBaseCentral();
    const agora = new Date().toISOString();

    const resultadosEventos: any[] = [];
    let novosProcessados = 0;
    let conflitosDetectados = 0;
    let replaysEvitados = 0;

    for (const evento of eventos) {
      const idempKey = evento.idempotency_key || req.headers?.['idempotency-key'];

      // 3. Verificação de Idempotência (Gate 9.2: Replay seguro sem duplicar)
      if (idempKey && idempotenciaMap[idempKey]) {
        replaysEvitados++;
        resultadosEventos.push({
          event_id: evento.event_id,
          idempotency_key: idempKey,
          status: 'REPLAY_IDENTICO_ACEITO',
          resultado_anterior: idempotenciaMap[idempKey],
        });
        continue;
      }

      // 4. Verificação de Escopo Regional para Operadores
      const perfilUsuario = usuario.perfil || 'OPERADOR';
      const regionalUsuario = (usuario.regional || '').trim().toUpperCase();
      const regionalEvento = (evento.payload?.regional || '').trim().toUpperCase();

      if (perfilUsuario === 'OPERADOR' && regionalUsuario && regionalEvento && regionalEvento !== regionalUsuario) {
        resultadosEventos.push({
          event_id: evento.event_id,
          status: 'CONFLITO_REGIONAL',
          erro: `Acesso negado: operador da regional "${regionalUsuario}" tentou modificar dados em "${regionalEvento}".`,
        });
        conflitosDetectados++;
        continue;
      }

      // 5. Roteamento por Tipo de Entidade e Operação
      if (evento.entity_type === 'PRODUTO') {
        const p = evento.payload;
        const imeiNorm = (p.imei || p.serial || '').trim().toUpperCase();

        // 5.1 Proteção de Condição de Corrida (Atomicidade de inserção concorrente)
        if (inFlightImeis.has(imeiNorm)) {
          // Outra thread/requisição está gravando este IMEI neste exato momento
          resultadosEventos.push({
            event_id: evento.event_id,
            status: 'CONFLITO_CONCORRENCIA_DUPLICADO',
            imei: imeiNorm,
            erro: 'Conflito de concorrência: Este IMEI está sendo processado simultaneamente por outra estação.',
          });
          conflitosDetectados++;
          continue;
        }

        try {
          inFlightImeis.add(imeiNorm);

          // 5.2 Validação de Bloqueio por Lote Finalizado (Gate 9.3)
          const loteDestino = (p.numero_lote || '').trim().toUpperCase();
          const loteFechado = centralData.lotes.find(
            (l: any) => l.numero_lote === loteDestino && l.status === 'FINALIZADO'
          );
          if (loteFechado && perfilUsuario === 'OPERADOR') {
            resultadosEventos.push({
              event_id: evento.event_id,
              status: 'CONFLITO_LOTE_FECHADO',
              erro: `O Lote ${loteDestino} já foi finalizado no servidor. Novos produtos não são permitidos.`,
            });
            conflitosDetectados++;
            continue;
          }

          // 5.3 Validação de Unicidade e Conflito de IMEI Duplicado
          const existente = centralData.produtos.find(
            (item: any) => (item.imei || item.serial || '').trim().toUpperCase() === imeiNorm
          );

          if (existente && evento.operation === 'INSERT') {
            // Rejeita duplicidade e registra tentativa no log auditável
            const logDup = {
              usuario: usuario.nome || usuario.login || 'Operador',
              data_hora: new Date().toLocaleString('pt-BR'),
              imei: imeiNorm,
              computador: `${computador?.id || 'PC-001'} (${computador?.nome || 'Estacao'})`,
              resultado: 'BLOQUEADO: IMEI JÁ CADASTRADO NO SERVIDOR',
              regional: p.regional || computador?.regional || 'Geral',
              data_cadastro_existente: existente.data_sincronizacao || existente.data_auditoria,
              usuario_existente: existente.usuario_sincronizacao || 'Outro Colaborador',
            };
            centralData.tentativas_duplicadas.unshift(logDup);

            resultadosEventos.push({
              event_id: evento.event_id,
              status: 'DUPLICADO_BLOQUEADO',
              imei: imeiNorm,
              detalhes: existente,
            });
            conflitosDetectados++;
            continue;
          }

          // 5.4 Processamento de Inserção com Revisão Otimista
          if (evento.operation === 'INSERT') {
            const novoProduto = {
              ...p,
              serial: imeiNorm,
              imei: imeiNorm,
              id_servidor: `SRV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              data_sincronizacao: agora,
              status_sincronizacao: 'ENVIADO',
              sync_status: 'ENVIADO',
              revisao: 1,
              created_at: agora,
              updated_at: agora,
            };
            centralData.produtos.push(novoProduto);
            novosProcessados++;

            const resEvento = {
              event_id: evento.event_id,
              status: 'SUCESSO_INSERT',
              id_servidor: novoProduto.id_servidor,
              revisao: 1,
            };
            if (idempKey) idempotenciaMap[idempKey] = resEvento;
            resultadosEventos.push(resEvento);
          } else if (evento.operation === 'UPDATE') {
            // Conflito de Revisão Otimista (Gate 9.3)
            const idx = centralData.produtos.findIndex(
              (item: any) => (item.imei || item.serial || '').trim().toUpperCase() === imeiNorm
            );
            if (idx === -1) {
              resultadosEventos.push({ event_id: evento.event_id, status: 'ERRO_NAO_ENCONTRADO' });
              continue;
            }

            const revAtual = centralData.produtos[idx].revisao || 1;
            if (evento.base_revision < revAtual) {
              resultadosEventos.push({
                event_id: evento.event_id,
                status: 'CONFLITO_REVISAO_DESATUALIZADA',
                revisao_servidor: revAtual,
                erro: 'Registro foi alterado por outra estação em revisão mais recente.',
              });
              conflitosDetectados++;
              continue;
            }

            centralData.produtos[idx] = {
              ...centralData.produtos[idx],
              ...p,
              revisao: revAtual + 1,
              updated_at: agora,
            };
            const resEvento = {
              event_id: evento.event_id,
              status: 'SUCESSO_UPDATE',
              revisao: revAtual + 1,
            };
            if (idempKey) idempotenciaMap[idempKey] = resEvento;
            resultadosEventos.push(resEvento);
          } else if (evento.operation === 'DELETE') {
            // Tombstone para exclusão lógica auditável (Gate 9.3)
            const idx = centralData.produtos.findIndex(
              (item: any) => (item.imei || item.serial || '').trim().toUpperCase() === imeiNorm
            );
            if (idx >= 0) {
              centralData.produtos[idx].deleted_at = agora;
              centralData.produtos[idx].updated_at = agora;
              centralData.produtos[idx].revisao = (centralData.produtos[idx].revisao || 1) + 1;
            }
            const resEvento = { event_id: evento.event_id, status: 'SUCESSO_TOMBSTONE' };
            if (idempKey) idempotenciaMap[idempKey] = resEvento;
            resultadosEventos.push(resEvento);
          }
        } finally {
          inFlightImeis.delete(imeiNorm);
        }
      }
    }

    // Persistência Central e Cache de Idempotência
    salvarBaseCentral(centralData);
    salvarIdempotencia(idempotenciaMap);

    return res.status(200).json({
      sucesso: conflitosDetectados === 0,
      processados: novosProcessados,
      conflitos: conflitosDetectados,
      replaysEvitados,
      resultados: resultadosEventos,
      timestamp: agora,
    });
  } catch (err: any) {
    console.error('[SyncDelta] Falha crítica:', err);
    return res.status(500).json({
      sucesso: false,
      erro: err.message || 'Erro interno ao processar sincronização delta.',
    });
  }
}

