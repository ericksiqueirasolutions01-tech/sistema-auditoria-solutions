// Endpoint Central de Consulta de Referência de IMEI por Regional
// Prompt Mestre: Consulta O(1) de referência para preenchimento automático na bipagem.

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
    console.error('[ReferenciaLookupAPI] Erro ao instanciar Supabase:', err);
    return null;
  }
}

const ALLOWED_ORIGINS = [
  'https://sistema-auditoria-solutions.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function normalizeImei(val?: string | number | null): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\D/g, '');
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

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const regional = String(req.query?.regional || req.body?.regional || '').trim().toUpperCase();
  const rawImei = String(req.query?.imei || req.body?.imei || '');
  const imeiNorm = normalizeImei(rawImei);

  if (!imeiNorm) {
    return res.status(400).json({
      sucesso: false,
      erro: 'IMEI de 15 dígitos é obrigatório para a consulta.',
    });
  }

  const supabase = getSupabaseServerAdmin();
  if (!supabase) {
    return res.status(200).json({ sucesso: true, encontrado: false, item: null });
  }

  try {
    const colsWithNf = 'id, regional, import_batch_id, imei_normalized, sku, model_description, brand, origin_invoice, nf_origem_samsung, dealer_raw, dealer_normalized, source_file_name, is_active';
    const colsWithoutNf = 'id, regional, import_batch_id, imei_normalized, sku, model_description, brand, origin_invoice, dealer_raw, dealer_normalized, source_file_name, is_active';

    const buildQuery = (cols: string) => {
      let q = supabase
        .from('regional_inventory_reference')
        .select(cols)
        .eq('imei_normalized', imeiNorm)
        .eq('is_active', true);

      if (regional && regional !== 'TODAS') {
        const regUpper = regional.trim().toUpperCase();
        const regClean = regUpper.replace(/^VIA VAREJO\s*[-]?\s*/, '').trim();
        const regionaisValidas = Array.from(new Set([regUpper, `VIA VAREJO ${regClean}`, regClean])).filter(Boolean);
        if (regionaisValidas.length === 1) {
          q = q.eq('regional', regionaisValidas[0]);
        } else if (regionaisValidas.length > 1) {
          q = q.in('regional', regionaisValidas);
        }
      }
      return q;
    };

    let { data, error } = await buildQuery(colsWithNf).limit(1).maybeSingle();

    if (error && (error.code === '42703' || error.message?.includes('nf_origem_samsung'))) {
      const fallbackResult = await buildQuery(colsWithoutNf).limit(1).maybeSingle();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) throw error;

    if (!data) {
      return res.status(200).json({ sucesso: true, encontrado: false, item: null });
    }

    const itemData = data as any;
    return res.status(200).json({
      sucesso: true,
      encontrado: true,
      item: {
        ...itemData,
        nf_origem_samsung: itemData.nf_origem_samsung || itemData.origin_invoice || null,
        origin_invoice: itemData.origin_invoice || itemData.nf_origem_samsung || null,
      },
    });
  } catch (err: any) {
    console.error('[ReferenciaLookupAPI] Erro ao consultar:', err);
    return res.status(500).json({ sucesso: false, erro: err.message });
  }
}

