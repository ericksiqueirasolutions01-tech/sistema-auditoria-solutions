// Endpoint Central de Importação de Planilhas Regionais (ADMIN ONLY)
// Prompt Mestre: Importação e ativação exclusiva de administradores com HTTP 403 para não-admins.
// NUNCA processa nem persiste a coluna I (Data da NF).

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
    console.error('[ReferenciaImportAPI] Erro ao instanciar Supabase:', err);
    return null;
  }
}

const ALLOWED_ORIGINS = [
  'https://sistema-auditoria-solutions.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function normalizeDealer(val?: string | null): string {
  if (!val) return 'SEM DEALER';
  const clean = String(val).trim().toUpperCase().replace(/\s+/g, ' ');
  return clean || 'SEM DEALER';
}

function normalizeImei(val?: string | number | null): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\D/g, '');
}

function extrairCodigoRegional(regional: string): string {
  const r = (regional || '').trim().toUpperCase();
  if (r.startsWith('VIA VAREJO ')) {
    return r.replace('VIA VAREJO ', '').trim();
  }
  return r || 'GERAL';
}

const CADASTRO_MESTRE_SKU: Record<string, string> = {
  // Motorola
  '5370760': 'MOTOROLA',
  'XT2601': 'MOTOROLA',
  'XT2601-3': 'MOTOROLA',
  'XT2347-1': 'MOTOROLA',
  'XT2347': 'MOTOROLA',
  'XT2335': 'MOTOROLA',
  'XT2335-1': 'MOTOROLA',
  'XT2331': 'MOTOROLA',
  'XT2321': 'MOTOROLA',
  'XT2403': 'MOTOROLA',
  'XT2409': 'MOTOROLA',
  'XT2413': 'MOTOROLA',
  'XT2417': 'MOTOROLA',
  'XT2423': 'MOTOROLA',
  'XT2427': 'MOTOROLA',
  // Samsung
  'SM-S928BZKQZTO': 'SAMSUNG',
  'SM-S928B': 'SAMSUNG',
  'SM-A546EZGLZTO': 'SAMSUNG',
  'SM-A546E': 'SAMSUNG',
  'SM-G990E': 'SAMSUNG',
  'SM-G990EZVRZTO': 'SAMSUNG',
  'SM-A155M': 'SAMSUNG',
  'SM-A256E': 'SAMSUNG',
  'SM-A356E': 'SAMSUNG',
  'SM-A556E': 'SAMSUNG',
  'SM-S921B': 'SAMSUNG',
  'SM-S926B': 'SAMSUNG',
  'SM-F731B': 'SAMSUNG',
  'SM-F946B': 'SAMSUNG',
  'SM-F741B': 'SAMSUNG',
  'SM-F956B': 'SAMSUNG',
  // Oppo
  'CPH2579': 'OPPO',
  'CPH2599': 'OPPO',
  'CPH2607': 'OPPO',
  'CPH2625': 'OPPO',
  // Jovi
  'JOVI-01': 'JOVI',
  'JOVI-02': 'JOVI',
};

function consultarMarcaPorSku(sku?: string | null): string | null {
  if (!sku) return null;
  const clean = String(sku).trim().toUpperCase();
  if (!clean) return null;
  if (CADASTRO_MESTRE_SKU[clean]) return CADASTRO_MESTRE_SKU[clean];
  const semZeros = clean.replace(/^0+/, '');
  if (semZeros && CADASTRO_MESTRE_SKU[semZeros]) return CADASTRO_MESTRE_SKU[semZeros];
  return null;
}

function inferirFabricante(
  modelo?: string | null,
  fallbackMarca?: string | null,
  sku?: string | null
): string {
  // 1. SKU -> MARCA do cadastro mestre / base estruturada (prioridade 1 absoluta)
  const marcaSku = consultarMarcaPorSku(sku);
  if (marcaSku) return marcaSku;

  const m = (modelo || '').trim().toUpperCase();

  // 2. Análise do Modelo / Descrição por palavras-chave de fabricante
  if (
    m.includes('MOTOROLA') ||
    m.includes('MOTO ') ||
    m.startsWith('MOTO') ||
    m.includes('MOTO-') ||
    m.includes('XT2') ||
    m.includes('XT3')
  ) {
    return 'MOTOROLA';
  }
  if (m.includes('OPPO') || m.startsWith('CPH')) return 'OPPO';
  if (m.includes('JOVI')) return 'JOVI';
  if (m.includes('APPLE') || m.includes('IPHONE')) return 'APPLE';
  if (m.includes('XIAOMI') || m.includes('REDMI') || m.includes('POCO')) return 'XIAOMI';
  if (
    m.includes('SAMSUNG') ||
    m.includes('GALAXY') ||
    m.startsWith('SM-') ||
    m.includes('SM-')
  ) {
    return 'SAMSUNG';
  }

  // 3. Campo estruturado de marca da referência importada (somente se confiável)
  if (fallbackMarca && fallbackMarca.trim()) {
    const fb = fallbackMarca.trim().toUpperCase();
    if (fb && fb !== 'SEM MARCA' && fb !== 'OUTRA MARCA' && fb !== 'FABRICANTE NÃO IDENTIFICADO') {
      return fb;
    }
  }

  // 4. Se fallback for 'OUTRA MARCA', respeitar
  if (fallbackMarca && fallbackMarca.trim().toUpperCase() === 'OUTRA MARCA') {
    return 'OUTRA MARCA';
  }

  // 5. Se não houver fonte confiável: FABRICANTE NÃO IDENTIFICADO (NUNCA assumir Samsung)
  return 'FABRICANTE NÃO IDENTIFICADO';
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // mesma origem
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ sucesso: false, erro: 'Payload JSON inválido.' });
    }
  }

  // GET: listar histórico de versões da regional e carregar referências ativas
  if (req.method === 'GET') {
    const regional = req.query?.regional ? String(req.query.regional).trim().toUpperCase() : '';
    const supabase = getSupabaseServerAdmin();
    if (!supabase) {
      return res.status(200).json({ sucesso: true, batches: [], references: [] });
    }
    try {
      let query = supabase.from('inventory_import_batches').select('*').order('version', { ascending: false });
      const regUpper = (regional || '').trim().toUpperCase();
      const regClean = regUpper.replace(/^VIA VAREJO\s*[-]?\s*/, '').trim();
      const regionaisValidas = Array.from(new Set([regUpper, `VIA VAREJO ${regClean}`, regClean])).filter(Boolean);

      if (regional && regional !== 'TODAS') {
        if (regionaisValidas.length === 1) {
          query = query.eq('regional', regionaisValidas[0]);
        } else {
          query = query.in('regional', regionaisValidas);
        }
      }
      const { data, error } = await query;
      if (error) throw error;

      let references: any[] = [];
      if (req.query?.ativos === 'true' || req.query?.incluir_itens === 'true') {
        let refQuery = supabase
          .from('regional_inventory_reference')
          .select('id, regional, import_batch_id, imei_normalized, sku, model_description, brand, origin_invoice, dealer_raw, dealer_normalized, source_file_name, is_active')
          .eq('is_active', true);
        if (regional && regional !== 'TODAS') {
          if (regionaisValidas.length === 1) {
            refQuery = refQuery.eq('regional', regionaisValidas[0]);
          } else {
            refQuery = refQuery.in('regional', regionaisValidas);
          }
        }
        const { data: refData, error: refErr } = await refQuery;
        if (!refErr && Array.isArray(refData)) {
          references = refData;
        }
      }

      return res.status(200).json({ sucesso: true, batches: data || [], references });
    } catch (err: any) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, erro: 'Método não permitido. Use POST.' });
  }

  // 1. RBAC estrito (ADMIN ONLY): Verificação do usuário
  const usuario = body?.usuario;
  const perfil = (usuario?.perfil || '').trim().toUpperCase();
  const isAdmin = perfil === 'ADMINISTRADOR' || perfil === 'SUPER_ADMIN';

  if (!isAdmin) {
    return res.status(403).json({
      sucesso: false,
      erro: 'Acesso negado (403): Apenas Administradores do Sistema têm permissão para importar planilhas e ativar versões de referência regional.',
    });
  }

  const regional = (body?.regional || '').trim().toUpperCase();
  if (!regional) {
    return res.status(400).json({ sucesso: false, erro: 'Regional é obrigatória.' });
  }

  const fileName = (body?.fileName || body?.file_name || 'planilha_importada.xlsx').trim();
  const itens = body?.itens;
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ sucesso: false, erro: 'A lista de itens da planilha está vazia.' });
  }

  const supabase = getSupabaseServerAdmin();
  const regCod = extrairCodigoRegional(regional);
  const totalLinhas = itens.length;

  let imeisValidos = 0;
  let imeisInvalidos = 0;
  let duplicadosPlanilha = 0;
  let linhasSkuVazio = 0;
  let linhasModeloVazio = 0;
  let linhasDealerVazio = 0;
  const seenImeis = new Set<string>();
  const validRefs: any[] = [];
  const exemplosInvalidos: { linha: number; imei: string; motivo: string }[] = [];

  const batchId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `batch-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

  itens.forEach((item: any, idx: number) => {
    const rowNum = item.source_row || idx + 2;
    const imeiNorm = normalizeImei(item.imei);

    if (!imeiNorm || !/^\d{15}$/.test(imeiNorm)) {
      imeisInvalidos++;
      if (exemplosInvalidos.length < 10) {
        exemplosInvalidos.push({
          linha: rowNum,
          imei: String(item.imei || ''),
          motivo: 'IMEI não possui exatamente 15 dígitos numéricos.',
        });
      }
      return;
    }

    if (seenImeis.has(imeiNorm)) {
      duplicadosPlanilha++;
      if (exemplosInvalidos.length < 10) {
        exemplosInvalidos.push({
          linha: rowNum,
          imei: imeiNorm,
          motivo: 'IMEI duplicado dentro da própria planilha.',
        });
      }
      return;
    }
    seenImeis.add(imeiNorm);

    const sku = (item.sku ? String(item.sku) : '').trim();
    if (!sku) linhasSkuVazio++;

    const modelDesc = (item.model_description ? String(item.model_description) : '').trim();
    if (!modelDesc) linhasModeloVazio++;

    const dealerRaw = item.dealer !== undefined && item.dealer !== null ? String(item.dealer).trim() : '';
    if (!dealerRaw) linhasDealerVazio++;
    const dealerNorm = normalizeDealer(dealerRaw);

    // Coluna H preservada; Coluna I (Data da NF) estritamente omitida e jamais persistida
    const originInvoice = item.origin_invoice !== undefined && item.origin_invoice !== null ? String(item.origin_invoice).trim() : null;
    const brand = inferirFabricante(modelDesc, item.brand, sku);

    imeisValidos++;
    validRefs.push({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ref-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
      regional,
      import_batch_id: batchId,
      imei_normalized: imeiNorm,
      sku: sku || 'SEM SKU',
      model_description: modelDesc || 'MODELO NÃO ESPECIFICADO',
      brand,
      origin_invoice: originInvoice,
      dealer_raw: dealerRaw || null,
      dealer_normalized: dealerNorm,
      source_file_name: fileName,
      source_row: rowNum,
      is_active: true,
      created_at: new Date().toISOString(),
    });
  });

  if (validRefs.length === 0) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Nenhum IMEI válido de 15 dígitos numéricos foi encontrado no arquivo.',
    });
  }

  let proximaVersao = 1;
  if (supabase) {
    try {
      const { data: ultimosBatches } = await supabase
        .from('inventory_import_batches')
        .select('version')
        .eq('regional', regional)
        .order('version', { ascending: false })
        .limit(1);

      if (ultimosBatches && ultimosBatches.length > 0) {
        proximaVersao = (ultimosBatches[0].version || 0) + 1;
      }

      // Arquivar versão ativa anterior no Supabase
      await supabase
        .from('inventory_import_batches')
        .update({ status: 'HISTORICA', updated_at: new Date().toISOString() })
        .eq('regional', regional)
        .eq('status', 'ATIVA');

      await supabase
        .from('regional_inventory_reference')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('regional', regional)
        .eq('is_active', true);

      // Inserir novo batch
      const newBatchData = {
        id: batchId,
        regional,
        file_name: fileName,
        imported_by: usuario.nome || usuario.login || 'ADMINISTRADOR',
        imported_at: new Date().toISOString(),
        row_count: totalLinhas,
        valid_count: validRefs.length,
        invalid_count: totalLinhas - validRefs.length,
        status: 'ATIVA',
        version: proximaVersao,
      };

      const { error: batchErr } = await supabase.from('inventory_import_batches').insert(newBatchData);
      if (batchErr) throw batchErr;

      // Inserir referências em chunks de 100
      for (let i = 0; i < validRefs.length; i += 100) {
        const chunk = validRefs.slice(i, i + 100);
        const { error: chunkErr } = await supabase.from('regional_inventory_reference').insert(chunk);
        if (chunkErr) throw chunkErr;
      }

      // Inserir trilha append-only no audit_log
      await supabase.from('audit_log').insert({
        actor_user_id: usuario.login || usuario.nome || 'ADMINISTRADOR',
        device_id: 'WEB-ADMIN',
        action: 'IMPORTAR_PLANILHA_REGIONAL',
        entity_type: 'INVENTORY_IMPORT_BATCH',
        entity_id: batchId,
        regional,
        detalhes: `Importada versão v${proximaVersao} da regional ${regional} com ${validRefs.length} itens válidos a partir do arquivo ${fileName}`,
      });
    } catch (errDb: any) {
      console.error('[ReferenciaImportAPI] Erro ao salvar no Supabase:', errDb);
      return res.status(500).json({ sucesso: false, erro: 'Falha ao persistir no banco de dados central: ' + errDb.message });
    }
  }

  const batch = {
    id: batchId,
    regional,
    file_name: fileName,
    imported_by: usuario.nome || usuario.login || 'ADMINISTRADOR',
    imported_at: new Date().toISOString(),
    row_count: totalLinhas,
    valid_count: validRefs.length,
    invalid_count: totalLinhas - validRefs.length,
    status: 'ATIVA' as const,
    version: proximaVersao,
  };

  const metricas = {
    nomeArquivo: fileName,
    regional,
    totalLinhas,
    imeisValidos,
    imeisInvalidos,
    duplicadosPlanilha,
    linhasSkuVazio,
    linhasModeloVazio,
    linhasDealerVazio,
    exemplosInvalidos,
    exemplosValidos: validRefs.slice(0, 5),
  };

  return res.status(200).json({
    sucesso: true,
    batch,
    totalImportados: validRefs.length,
    metricas,
  });
}

