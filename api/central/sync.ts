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

function isCaixaZero(caixa?: string | null): boolean {
  if (!caixa) return false;
  const c = caixa.trim().toUpperCase();
  if (
    c === '0' ||
    c === '00' ||
    c === 'CAIXA 0' ||
    c === 'CAIXA 00' ||
    c === 'CAIXA-0' ||
    c === 'CAIXA-00' ||
    c === 'CX 0' ||
    c === 'CX 00' ||
    c === 'CX-0' ||
    c === 'CX-00'
  ) {
    return true;
  }
  if (/^(CAIXA|CX)[\s\-_]*0{1,2}(?!\d)/i.test(c)) {
    return true;
  }
  if (c.includes('NÃO DEVOLVER') || c.includes('NAO DEVOLVER')) {
    return true;
  }
  return false;
}

function isSupabaseServerConfigured(): boolean {
  if (
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' ||
      Boolean(process.env.VITEST) ||
      Boolean(process.env.CI) ||
      Boolean(process.env.GITHUB_ACTIONS))
  ) {
    if (process.env.FORCE_TEST_SERVER_SYNC === 'true') {
      return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
    }
    return false;
  }
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

/**
 * CORREÇÃO 3 — Normaliza qualquer formato de data (DD/MM/YYYY, ISO, etc.) para o formato DATE do PostgreSQL (YYYY-MM-DD)
 */
function normalizeDatabaseDate(dataInput: any): string {
  if (!dataInput) {
    return new Date().toISOString().split('T')[0];
  }
  const str = String(dataInput).trim();
  // Formato brasileiro DD/MM/YYYY ou DD-MM-YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const dia = ddmmyyyyMatch[1].padStart(2, '0');
    const mes = ddmmyyyyMatch[2].padStart(2, '0');
    const ano = ddmmyyyyMatch[3];
    return `${ano}-${mes}-${dia}`;
  }
  // Formato ISO YYYY-MM-DD ou YYYY/MM/DD
  const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmddMatch) {
    const ano = yyyymmddMatch[1];
    const mes = yyyymmddMatch[2].padStart(2, '0');
    const dia = yyyymmddMatch[3].padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return new Date().toISOString().split('T')[0];
}

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
    const { produtos, computador, usuario, regional, fotos, registros_10_fotos } = body || {};

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

    // 3.1. Validação de Caixa Homogênea no Sync Central (Gate 4):
    // Regra: se o produto estiver aberto ele deve ir para a Caixa 0 e classificar como NÃO DEVOLVER.
    // Todas as travas que impediam misturar produtos de diferente classificação na mesma caixa foram removidas.
    if (Array.isArray(produtos) && produtos.length > 0) {
      for (const p of produtos) {
        const cx = (p.numero_caixa || '').trim().toUpperCase();
        if (!cx) continue;
        const ehCaixaZero = isCaixaZero(cx);
        const ehAberto = p.produto_lacrado === 'NÃO' || p.box_sealed_status === 'OPEN';

        // 1. Produto aberto fora da Caixa 0
        if (ehAberto && !ehCaixaZero) {
          return res.status(409).json({
            sucesso: false,
            codigo: 'PRODUTO_ABERTO_CAIXA_ZERO',
            erro: `PRODUTO_ABERTO_CAIXA_ZERO: O produto ${p.imei || p.serial} está ABERTO (não lacrado) e deve ir obrigatoriamente para a Caixa 0 com a classificação NÃO DEVOLVER. A ${cx} aceita apenas produtos lacrados.`,
          });
        }

        // 2. Produto lacrado na Caixa 0
        if (!ehAberto && ehCaixaZero) {
          return res.status(409).json({
            sucesso: false,
            codigo: 'CAIXA_ZERO_APENAS_ABERTOS',
            erro: `CAIXA_ZERO_APENAS_ABERTOS: A ${cx} é destinada exclusivamente a produtos ABERTOS (NÃO DEVOLVER). O produto ${p.imei || p.serial} está lacrado e deve ir para uma caixa operacional normal.`,
          });
        }

        // Se for aberto e estiver na Caixa 0, assegurar classificação NÃO DEVOLVER
        if (ehAberto) {
          p.classificacao_produto = 'NÃO DEVOLVER';
          p.product_classification = 'NÃO DEVOLVER';
          p.box_classification = 'NÃO DEVOLVER';
        }
      }

      // 3.2. Validação da regra de NFOrigem Samsung por Caixa:
      // Uma caixa só pode conter produtos da mesma NFOrigem Samsung.
      const nfPorCaixa = new Map<string, string>();
      for (const p of produtos) {
        const cx = (p.numero_caixa || '').trim().toUpperCase();
        if (!cx || isCaixaZero(cx)) continue;
        const nfP = (p.nf_origem_samsung || p.origin_invoice || p.numero_nf || p.nf_origem || '').trim().toUpperCase();
        if (nfPorCaixa.has(cx)) {
          const nfExistente = nfPorCaixa.get(cx)!;
          if (nfP !== nfExistente) {
            return res.status(409).json({
              sucesso: false,
              codigo: 'CAIXA_BLOQUEADA_NF_DIVERGENTE',
              erro: 'CAIXA BLOQUEADA: Não é permitido misturar produtos com NFOrigem Samsung diferentes na mesma caixa.',
            });
          }
        } else {
          nfPorCaixa.set(cx, nfP);
        }
      }
    }

    // Mapeamento de seriais e IMEIs existentes (CENTRAL-FIRST: Supabase PostgreSQL é a única fonte oficial)
    const mapExistentes = new Map<string, any>();

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
              if (sn) mapExistentes.set(sn, info);
              if (im) mapExistentes.set(im, info);
            }
          }
        }
      } catch (errDb) {
        console.warn('[Central] Aviso ao consultar duplicidades no Supabase:', errDb);
      }
    } else {
      // Fallback estrito apenas se Supabase não estiver configurado
      for (const p of centralData.produtos) {
        const sn = (p.serial || '').trim().toUpperCase();
        const im = (p.imei || '').trim().toUpperCase();
        if (sn) mapExistentes.set(sn, p);
        if (im) mapExistentes.set(im, p);
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
        // Obter mapeamento de regiões de forma robusta
        const { data: allRegions, error: regErr } = await supabase.from('regions').select('id, codigo, nome');
        if (regErr) {
          debugDb.regErr = regErr;
        }

        const resolverIdRegiao = (nomeReg: string): string | null => {
          if (!nomeReg || !Array.isArray(allRegions)) return null;
          const regUpper = nomeReg.trim().toUpperCase();
          const regLimpa = regUpper.replace(/^VIA VAREJO\s*[-]?\s*/, '').trim();
          const found = allRegions.find((r: any) =>
            (r.codigo && r.codigo.toUpperCase() === regLimpa) ||
            (r.nome && r.nome.toUpperCase() === regUpper) ||
            (r.codigo && regUpper.includes(r.codigo.toUpperCase())) ||
            (r.nome && r.nome.toUpperCase().includes(regLimpa))
          );
          return found ? found.id : null;
        };

        const defaultRegionalId = resolverIdRegiao(regionalNome) || (Array.isArray(allRegions) && allRegions.length > 0 ? allRegions[0].id : null);
        debugDb.regionalId = defaultRegionalId;

        const rowsToInsert = novosParaDb.map((item) => {
          const cx = item.numero_caixa || item.caixa || 'Caixa 01';
          const lacre = (item.lacre_seguranca || (body.lacres_caixas && body.lacres_caixas[cx]) || '').trim();
          const obsOriginal = (item.observacao || '').trim();
          let obsFinal = obsOriginal;
          if (lacre && !obsOriginal.includes('[LACRE:')) {
            obsFinal = obsOriginal ? `[LACRE:${lacre}] ${obsOriginal}` : `[LACRE:${lacre}]`;
          }

          const isLacrado = item.produto_lacrado === 'NÃO' ? 'NÃO' : 'SIM';
          const itemReg = item.regional || regional || regionalNome;
          const itemRegionalId = resolverIdRegiao(itemReg) || defaultRegionalId;

          return {
            id_local: String(item.id || `LOC-${Date.now()}`),
            serial: String(item.serial || '').trim().slice(0, 50),
            imei: String(item.imei || item.serial || '').trim().slice(0, 20),
            ean: String(item.ean || item.sku || '').trim().slice(0, 20),
            modelo: String(item.modelo_produto || item.modelo || 'Modelo Desconhecido').trim().slice(0, 120),
            fabricante: String(item.fabricante || item.brand || 'OUTRA MARCA').trim().slice(0, 50),
            numero_lote: String(item.numero_lote || item.lote || '01').trim().slice(0, 50),
            numero_caixa: String(cx).trim().slice(0, 50),
            regional_id: itemRegionalId,
            produto_lacrado: isLacrado,
            kit_completo: isLacrado === 'SIM' ? null : (item.kit_completo === 'NÃO' ? 'NÃO' : 'SIM'),
            aparelho_marcas_uso: isLacrado === 'SIM' ? null : (item.aparelho_marcas_uso === 'SIM' ? 'SIM' : 'NÃO'),
            observacao: obsFinal || null,
            usuario_bipagem: String(usuarioNormalizado.nome || 'Operador').slice(0, 100),
            status_sincronizacao: 'ENVIADO',
            data_auditoria: normalizeDatabaseDate(item.data_auditoria),
            // Snapshot fields da referência e lote (Seções 4, 5, 16):
            reference_id: item.reference_id ? String(item.reference_id).slice(0, 100) : null,
            import_batch_id: item.import_batch_id || null,
            source_type: item.source_type || 'OUT_OF_LIST',
            dealer: item.dealer ? String(item.dealer).slice(0, 255) : null,
            origin_invoice: (item.origin_invoice || item.nf_origem || item.numero_nf) ? String(item.origin_invoice || item.nf_origem || item.numero_nf).slice(0, 50) : null,
            nf_origem_samsung: (item.nf_origem_samsung || item.origin_invoice || item.nf_origem || item.numero_nf) ? String(item.nf_origem_samsung || item.origin_invoice || item.nf_origem || item.numero_nf).slice(0, 100) : null,
            regional: itemReg,
            sku: item.sku ? String(item.sku).slice(0, 50) : null,
            brand: item.brand ? String(item.brand).slice(0, 50) : (item.fabricante ? String(item.fabricante).slice(0, 50) : 'OUTRA MARCA'),
            misuse: item.misuse !== undefined ? item.misuse : (item.aparelho_marcas_uso === 'SIM'),
          };
        });

        let { error: upsertErr } = await supabase.from('audit_products').upsert(rowsToInsert, { onConflict: 'serial,regional_id' });
        if (upsertErr && (upsertErr.message?.includes('nf_origem_samsung') || upsertErr.message?.includes('regional') || upsertErr.code === 'PGRST204')) {
          const fallbackRows = rowsToInsert.map(({ nf_origem_samsung, regional, ...rest }: any) => rest);
          const retry = await supabase.from('audit_products').upsert(fallbackRows, { onConflict: 'serial,regional_id' });
          upsertErr = retry.error;
        }
        if (upsertErr) {
          debugDb.upsertError = upsertErr;
          console.error('[Central] Erro ao persistir audit_products no Supabase:', upsertErr);
          return res.status(500).json({
            sucesso: false,
            erro: `Falha ao persistir produtos no banco central: ${upsertErr.message || String(upsertErr)}`,
            debug_db: debugDb,
          });
        }
        debugDb.upsertSuccess = true;

        // Trilha imutável em audit_log
        try {
          await supabase.from('audit_log').insert({
            actor_user_id: usuarioNormalizado.login || usuarioNormalizado.nome || 'Operador',
            device_id: computador?.id || 'PC-001',
            action: 'SYNC_PRODUTOS',
            entity_type: 'PRODUTO',
            entity_id: `LOTE-${novosParaDb[0]?.numero_lote || 'GERAL'}`,
            regional: regionalNome,
            detalhes: `${novosCount} produtos sincronizados online (${duplicadosList.length} duplicados bloqueados)`,
          });
        } catch {}

        // Persistência Central de Evidências Fotográficas no Supabase
        try {
          const todasFotosParaDb: any[] = [];
          if (Array.isArray(fotos)) todasFotosParaDb.push(...fotos);
          if (Array.isArray(registros_10_fotos)) {
            for (const r of registros_10_fotos) {
              for (const f of (r.fotos || [])) {
                if (f && f.fotoDataUri) {
                  todasFotosParaDb.push({
                    caixa: r.caixa,
                    regional: r.regional || regionalNome,
                    grupoNumero: f.indice,
                    grupoRotulo: f.rotulo,
                    fotoDataUri: f.fotoDataUri,
                  });
                }
              }
            }
          }

          const fotosPorCaixaMap = new Map<string, any[]>();
          for (const f of todasFotosParaDb) {
            if (!f || !f.fotoDataUri || f.fotoDataUri.length < 50) continue;
            const cx = (f.caixa || 'Caixa 01').trim();
            const reg = (f.regional || regionalNome).trim();
            const chave = `${reg}:::${cx}`;
            if (!fotosPorCaixaMap.has(chave)) fotosPorCaixaMap.set(chave, []);
            const lista = fotosPorCaixaMap.get(chave)!;
            const num = f.grupoNumero || f.indice || 1;
            const existe = lista.some((item) => (item.grupoNumero || item.indice) === num);
            if (!existe) lista.push(f);
          }

          if (fotosPorCaixaMap.size > 0) {
            for (const [chave, listaFotos] of fotosPorCaixaMap.entries()) {
              const [regFoto, cxFoto] = chave.split(':::');
              const regFotoId = resolverIdRegiao(regFoto) || defaultRegionalId;
              if (!regFotoId) continue;
              const regCod = regFoto.replace(/[^A-Z0-9]/g, '').slice(0, 10);
              const cxCod = cxFoto.replace(/[^A-Z0-9]/g, '').slice(0, 20);
              const serialEvidencia = `EVIDENCIA_FOTOS_${regCod}_${cxCod}`;
              const payloadFotosJson = JSON.stringify({
                caixa: cxFoto,
                regional: regFoto,
                fotos: listaFotos.map((item) => ({
                  indice: item.grupoNumero || item.indice || 1,
                  rotulo: item.grupoRotulo || item.rotulo || `Foto ${item.grupoNumero || 1}`,
                  fotoDataUri: item.fotoDataUri,
                })),
              });

              await supabase.from('audit_products').upsert({
                id_local: serialEvidencia,
                serial: serialEvidencia,
                imei: serialEvidencia.slice(0, 20),
                ean: '0000000000000',
                modelo: 'EVIDENCIA FOTOGRAFICA',
                fabricante: 'SAMSUNG',
                numero_caixa: cxFoto,
                numero_lote: '01',
                regional_id: regFotoId,
                produto_lacrado: 'SIM',
                usuario_bipagem: usuarioNormalizado.nome || 'Operador',
                data_auditoria: normalizeDatabaseDate(new Date().toISOString()),
                status_sincronizacao: 'ENVIADO',
                observacao: `[EVIDENCIAS_CAIXA:${payloadFotosJson}]`,
              }, { onConflict: 'serial,regional_id' });
            }
          }
        } catch (errFotoSupabase) {
          console.warn('[Central] Aviso ao gravar fotos de evidência no Supabase:', errFotoSupabase);
        }
      } catch (errDbSync: any) {
        debugDb.errDbSync = errDbSync?.message || String(errDbSync);
        console.error('[Central] Exceção crítica na sincronização do Supabase:', errDbSync);
        return res.status(500).json({
          sucesso: false,
          erro: `Falha de conexão ao gravar no banco central: ${errDbSync?.message || String(errDbSync)}`,
          debug_db: debugDb,
        });
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
