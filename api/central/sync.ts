// Endpoint Central de Sincronização Transacional (Gate 4)
// Suporte ao banco central Supabase (PostgreSQL + RLS) e persistência transacional server-side.

import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_FALLBACK_URL = 'https://chvfzqekkmongsrqbwev.supabase.co';
const SUPABASE_FALLBACK_KEY = 'sb_publishable_F-Lc83bJD87AokRbHPmltg_hp2q6Ghj';

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.URL_SUPABASE || SUPABASE_FALLBACK_URL;
  return url.trim();
}

function getSupabaseServiceKey(): string {
  const key =
    process.env.SUPABASE_SERVER_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    SUPABASE_FALLBACK_KEY;
  return key.trim();
}

function isSupabaseServerConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

let cachedAdminClient: SupabaseClient | null = null;

function getSupabaseServerAdmin(): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) {
    return null;
  }
  if (cachedAdminClient) {
    return cachedAdminClient;
  }
  try {
    cachedAdminClient = createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return cachedAdminClient;
  } catch (err) {
    console.error('[SyncAPI] Erro ao instanciar Supabase:', err);
    return null;
  }
}

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
  if (origin) {
    if (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('vercel.app') ||
      origin.startsWith('tauri://') ||
      origin === 'null' ||
      ALLOWED_ORIGINS.includes(origin)
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
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

    // 1. Verificação e Normalização de Autenticação Server-Side
    if (!usuario) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Não autorizado. Identificação de usuário e sessão autenticada são obrigatórias para sincronização.',
      });
    }

    let userNome = '';
    let userLogin = '';
    let userPerfil = 'OPERADOR';
    let userRegional = (regional || computador?.regional || '').trim().toUpperCase();

    if (typeof usuario === 'string') {
      userNome = usuario.trim();
      userLogin = usuario.trim().toLowerCase();
    } else if (typeof usuario === 'object') {
      userNome = (usuario.nome || usuario.login || '').trim();
      userLogin = (usuario.login || usuario.nome || '').trim().toLowerCase();
      userPerfil = usuario.perfil || 'OPERADOR';
      if (usuario.regional) {
        userRegional = String(usuario.regional).trim().toUpperCase();
      }
    }

    if (!userNome && !userLogin) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Não autorizado. Identificação de usuário e sessão autenticada são obrigatórias para sincronização.',
      });
    }

    const usuarioNormalizado = {
      nome: userNome,
      login: userLogin,
      perfil: userPerfil,
      regional: userRegional,
    };

    // 2. Verificação de Dispositivo Revogado (Gate 2: revoked device -> denied)
    if (computador?.status === 'REVOGADO') {
      return res.status(403).json({
        sucesso: false,
        erro: `Dispositivo bloqueado. O computador ${computador.nome || computador.id || ''} foi revogado pelo Administrador do Sistema.`,
      });
    }

    // 3. Verificação de Escopo Regional (Gate 2: operator cross-region -> denied)
    const perfilUsuario = usuarioNormalizado.perfil || 'OPERADOR';
    let regionalUsuario = (usuarioNormalizado.regional || '').trim().toUpperCase();

    const normalizarRegional = (reg: string) => {
      const r = (reg || '').trim().toUpperCase();
      if (r.startsWith('VIA VAREJO ')) return r.replace('VIA VAREJO ', '').trim();
      return r;
    };

    // Se o lote enviado declara uma regional explícita (ex: 'VIA VAREJO BA') e todos os produtos pertencem a ela
    const regPayload = (regional || '').trim().toUpperCase();
    if (regPayload && Array.isArray(produtos) && produtos.length > 0) {
      const todosMesmaReg = produtos.every((p: any) => {
        const pReg = normalizarRegional(p.regional || regPayload);
        return pReg === normalizarRegional(regPayload);
      });
      if (todosMesmaReg) {
        regionalUsuario = regPayload;
        usuarioNormalizado.regional = regPayload;
      }
    }

    if (perfilUsuario === 'OPERADOR' && regionalUsuario) {
      const regCodUser = normalizarRegional(regionalUsuario);
      const temCrossRegion = Array.isArray(produtos) && produtos.some((p: any) => {
        const pReg = normalizarRegional(p.regional || '');
        return pReg && regCodUser && pReg !== regCodUser;
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

    const agora = new Date().toISOString();
    const regionalNome = regional || computador?.regional || 'VIA VAREJO RJ';
    const supabase = getSupabaseServerAdmin();

    const centralData = carregarBaseCentral();
    let novosCount = 0;
    const duplicadosList: any[] = [];

    // 3.1. Validação de Caixa Homogênea no Sync Central (Gate 4)
    if (Array.isArray(produtos) && produtos.length > 0) {
      const caixasVistas = new Map<string, { classif: string; sealed: string; imei: string }>();

      for (const p of produtos) {
        const cx = (p.numero_caixa || '').trim().toUpperCase();
        if (!cx) continue;
        const reg = (p.regional || regional || regionalNome).trim().toUpperCase();
        const chave = `${reg}:::${cx}`;
        const pClassif = (p.box_classification || p.classificacao_produto || p.product_classification || '').trim().toUpperCase();
        const pSealed = (p.box_sealed_status === 'SEALED' || p.produto_lacrado === 'SIM') ? 'LACRADO' : 'ABERTO';

        // 1. Checar contra produtos já existentes no banco central
        const primeiroCentral = centralData.produtos.find((cp: any) => {
          const cpCx = (cp.numero_caixa || '').trim().toUpperCase();
          const cpReg = (cp.regional || 'VIA VAREJO RJ').trim().toUpperCase();
          return cpCx === cx && cpReg === reg;
        });

        if (primeiroCentral) {
          let caixaClassif = (primeiroCentral.box_classification || primeiroCentral.classificacao_produto || primeiroCentral.product_classification || '').trim().toUpperCase();
          if (!caixaClassif) {
            const isSamsung = (primeiroCentral.fabricante || primeiroCentral.brand || '').toUpperCase().includes('SAMSUNG');
            const dNorm = (primeiroCentral.dealer || '').toUpperCase();
            if (primeiroCentral.source_type === 'OUT_OF_LIST') {
              caixaClassif = isSamsung ? 'FORA DA LISTA - SAMSUNG' : 'FORA DA LISTA - OUTRA MARCA';
            } else {
              if (dNorm.includes('SIRI')) caixaClassif = 'PRODUTO NA LISTA - SIRI COMERCIO E SERVICOS LTDA';
              else if (!isSamsung || dNorm.includes('OUTRA MARCA')) caixaClassif = 'PRODUTO NA LISTA - OUTRA MARCA';
              else caixaClassif = 'PRODUTO NA LISTA - SAMSUNG';
            }
          }
          const caixaSealed = (primeiroCentral.box_sealed_status === 'SEALED' || primeiroCentral.produto_lacrado === 'SIM') ? 'LACRADO' : 'ABERTO';

          if (caixaClassif && pClassif && caixaClassif !== pClassif) {
            return res.status(409).json({
              sucesso: false,
              codigo: 'BOX_CLASSIFICATION_MISMATCH',
              erro: `BOX_CLASSIFICATION_MISMATCH: A ${cx} já possui produtos com classificação "${caixaClassif}". O produto ${p.imei || p.serial} possui classificação "${pClassif}". Uma caixa não pode misturar classificações de produto.`,
            });
          }
          if (caixaSealed !== pSealed) {
            return res.status(409).json({
              sucesso: false,
              codigo: 'BOX_SEALED_MISMATCH',
              erro: `BOX_SEALED_MISMATCH: A ${cx} já possui produtos na condição "${caixaSealed}". O produto ${p.imei || p.serial} está "${pSealed}". Uma caixa não pode misturar produtos lacrados e abertos.`,
            });
          }
        }

        // 2. Checar contra produtos do mesmo lote sincronizado
        if (caixasVistas.has(chave)) {
          const refItem = caixasVistas.get(chave)!;
          if (refItem.classif && pClassif && refItem.classif !== pClassif) {
            return res.status(409).json({
              sucesso: false,
              codigo: 'BOX_CLASSIFICATION_MISMATCH',
              erro: `BOX_CLASSIFICATION_MISMATCH: Conflito no lote enviado. A ${cx} contém produto com classificação "${refItem.classif}" e outro com "${pClassif}".`,
            });
          }
          if (refItem.sealed !== pSealed) {
            return res.status(409).json({
              sucesso: false,
              codigo: 'BOX_SEALED_MISMATCH',
              erro: `BOX_SEALED_MISMATCH: Conflito no lote enviado. A ${cx} contém produto "${refItem.sealed}" e outro "${pSealed}".`,
            });
          }
        } else {
          caixasVistas.set(chave, { classif: pClassif, sealed: pSealed, imei: p.imei || p.serial });
        }
      }
    }

    // Mapeamento local em memória de seriais e IMEIs existentes
    const mapExistentes = new Map<string, any>();
    for (const p of centralData.produtos) {
      const sn = (p.serial || '').trim().toUpperCase();
      const im = (p.imei || '').trim().toUpperCase();
      if (sn) mapExistentes.set(sn, p);
      if (im) mapExistentes.set(im, p);
    }

    // Se o Supabase estiver conectado, consultar duplicidades direto no PostgreSQL
    if (supabase && Array.isArray(produtos) && produtos.length > 0) {
      try {
        const serialsConsulta = Array.from(
          new Set(
            produtos
              .flatMap((p: any) => [
                (p.serial || '').trim().toUpperCase(),
                (p.imei || '').trim().toUpperCase(),
              ])
              .filter(Boolean)
          )
        );

        if (serialsConsulta.length > 0) {
          const { data: dbProducts } = await supabase
            .from('audit_products')
            .select('serial, imei, modelo, numero_caixa, created_at, usuario_bipagem, regional_id')
            .is('deleted_at', null)
            .or(`serial.in.(${serialsConsulta.join(',')}),imei.in.(${serialsConsulta.join(',')})`);

          if (Array.isArray(dbProducts)) {
            for (const dp of dbProducts) {
              const sn = (dp.serial || '').trim().toUpperCase();
              const im = (dp.imei || '').trim().toUpperCase();
              const info = {
                serial: dp.serial,
                imei: dp.imei,
                modelo_produto: dp.modelo,
                numero_caixa: dp.numero_caixa,
                data_cadastro: dp.created_at,
                usuario_cadastro: dp.usuario_bipagem,
              };
              if (sn && !mapExistentes.has(sn)) mapExistentes.set(sn, info);
              if (im && !mapExistentes.has(im)) mapExistentes.set(im, info);
            }
          }
        }
      } catch (errDb) {
        console.warn('[Central] Aviso ao consultar duplicidades no Supabase:', errDb);
      }
    }

    // Processamento com detecção estrita de duplicidade por serial e imei
    const novosParaDb: any[] = [];
    if (Array.isArray(produtos)) {
      for (const p of produtos) {
        const sn = (p.serial || '').trim().toUpperCase();
        const im = (p.imei || '').trim().toUpperCase();
        if (!sn && !im) continue;

        const existente = (sn && mapExistentes.get(sn)) || (im && mapExistentes.get(im));
        if (existente) {
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
          const cxNorm = String(p.numero_caixa || p.caixa || 'Caixa 01').trim();
          const lacreItem = (p.lacre_seguranca || (body.lacres_caixas && body.lacres_caixas[cxNorm]) || '').trim() || null;
          const itemNormalizado = {
            ...p,
            serial: sn || im,
            imei: im || sn,
            numero_caixa: cxNorm,
            lacre_seguranca: lacreItem,
            box_id: p.box_id || cxNorm.toLowerCase().replace(/\s+/g, '-'),
            box_name: p.box_name || cxNorm,
            id_servidor: `SRV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            data_sincronizacao: agora,
            status_sincronizacao: 'ENVIADO',
            sync_status: 'ENVIADO',
            computador_id: computador?.id || p.computador_id || 'PC-001',
            computador_nome: computador?.nome || p.computador_nome || 'Estacao',
            usuario_sincronizacao: usuarioNormalizado.nome || 'Operador',
            regional: p.regional || regional || computador?.regional || regionalNome,
          };
          centralData.produtos.push(itemNormalizado);
          if (sn) mapExistentes.set(sn, itemNormalizado);
          if (im) mapExistentes.set(im, itemNormalizado);
          novosParaDb.push(itemNormalizado);
          novosCount++;
        }
      }
    }

    let debugDb: any = {
      url: getSupabaseUrl(),
      keyPrefix: getSupabaseServiceKey().slice(0, 15),
      hasSupabase: Boolean(supabase),
      novosParaDbCount: novosParaDb.length,
      regionalId: null,
      upsertError: null,
      upsertSuccess: false,
      errDbSync: null,
    };

    // Persistência no banco Supabase se configurado
    if (supabase && novosParaDb.length > 0) {
      try {
        // Obter regional_id de forma robusta
        let regionalId: string | null = null;
        const { data: allRegions, error: regErr } = await supabase.from('regions').select('id, codigo, nome');
        if (regErr) {
          debugDb.regErr = regErr;
        }
        if (Array.isArray(allRegions)) {
          const regLimpa = regionalNome.toUpperCase().replace(/^VIA VAREJO\s*[-]?\s*/, '').trim();
          const found = allRegions.find((r: any) =>
            (r.codigo && r.codigo.toUpperCase() === regLimpa) ||
            (r.nome && r.nome.toUpperCase() === regionalNome.toUpperCase()) ||
            (r.codigo && regionalNome.toUpperCase().includes(r.codigo.toUpperCase())) ||
            (r.nome && r.nome.toUpperCase().includes(regLimpa))
          );
          if (found) regionalId = found.id;
        }

        debugDb.regionalId = regionalId;

        if (regionalId) {
          const rowsToInsert = novosParaDb.map((item) => {
            const cx = item.numero_caixa || item.caixa || 'Caixa 01';
            const lacre = (item.lacre_seguranca || (body.lacres_caixas && body.lacres_caixas[cx]) || '').trim();
            const obsOriginal = (item.observacao || '').trim();
            let obsFinal = obsOriginal;
            if (lacre && !obsOriginal.includes('[LACRE:')) {
              obsFinal = obsOriginal ? `[LACRE:${lacre}] ${obsOriginal}` : `[LACRE:${lacre}]`;
            }

            const isLacrado = item.produto_lacrado === 'NÃO' ? 'NÃO' : 'SIM';

            return {
              id_local: String(item.id || `LOC-${Date.now()}`),
              serial: item.serial,
              imei: item.imei || item.serial,
              ean: item.ean || '',
              modelo: item.modelo_produto || item.modelo || 'Modelo Desconhecido',
              fabricante: item.fabricante || item.brand || 'OUTRA MARCA',
              numero_lote: item.numero_lote || item.lote || '01',
              numero_caixa: cx,
              regional_id: regionalId,
              produto_lacrado: isLacrado,
              kit_completo: isLacrado === 'SIM' ? null : (item.kit_completo === 'NÃO' ? 'NÃO' : 'SIM'),
              aparelho_marcas_uso: isLacrado === 'SIM' ? null : (item.aparelho_marcas_uso === 'SIM' ? 'SIM' : 'NÃO'),
              observacao: obsFinal || null,
              usuario_bipagem: usuarioNormalizado.nome || 'Operador',
              status_sincronizacao: 'ENVIADO',
              data_auditoria: item.data_auditoria || new Date().toISOString().split('T')[0],
              // Snapshot fields da referência e lote (Seções 4, 5, 16):
              reference_id: item.reference_id || null,
              import_batch_id: item.import_batch_id || null,
              source_type: item.source_type || 'OUT_OF_LIST',
              dealer: item.dealer || null,
              origin_invoice: item.origin_invoice || item.nf_origem || item.numero_nf || null,
              sku: item.sku || null,
              brand: item.brand || item.fabricante || 'OUTRA MARCA',
              misuse: item.misuse !== undefined ? item.misuse : (item.aparelho_marcas_uso === 'SIM'),
            };
          });

          const { error: upsertErr } = await supabase.from('audit_products').upsert(rowsToInsert, { onConflict: 'serial,regional_id' });
          if (upsertErr) {
            debugDb.upsertError = upsertErr;
            console.error('[Central] Erro ao persistir audit_products no Supabase:', upsertErr);
          } else {
            debugDb.upsertSuccess = true;
          }
        }

        // Trilha imutável em audit_log
        await supabase.from('audit_log').insert({
          actor_user_id: usuarioNormalizado.login || usuarioNormalizado.nome || 'Operador',
          device_id: computador?.id || 'PC-001',
          action: 'SYNC_PRODUTOS',
          entity_type: 'PRODUTO',
          entity_id: `LOTE-${novosParaDb[0]?.numero_lote || 'GERAL'}`,
          regional: regionalNome,
          detalhes: `${novosCount} produtos sincronizados online (${duplicadosList.length} duplicados bloqueados)`,
        });
      } catch (errDbSync: any) {
        debugDb.errDbSync = errDbSync?.message || String(errDbSync);
        console.warn('[Central] Aviso na sincronização do Supabase:', errDbSync);
      }
    }

    // Processamento de Fotos
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
      regional: regional || computador?.regional || regionalNome,
      computador_id: computador?.id || 'PC-001',
      computador_nome: computador?.nome || 'Estacao',
      usuario: usuarioNormalizado.nome || 'Operador',
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
          usuario: usuarioNormalizado.nome || 'Operador',
          data_hora: new Date().toLocaleString('pt-BR'),
          imei: d.serial || d.imei,
          computador: `${computador?.id || 'PC-001'} (${computador?.nome || 'Estacao'})`,
          resultado: 'BLOQUEADO: IMEI JÁ CADASTRADO NO SERVIDOR',
          regional: regional || computador?.regional || regionalNome,
          data_cadastro_existente: d.data_cadastro_existente,
          usuario_existente: d.usuario_existente,
        });
      }
      if (centralData.tentativas_duplicadas.length > 500) {
        centralData.tentativas_duplicadas = centralData.tentativas_duplicadas.slice(0, 500);
      }
    }

    // Persistência local/fallback
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
      debug_db: debugDb,
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
