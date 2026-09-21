// Health check da API Central (Gate 4)
// Erradicado extendsclass.com. Conexão e monitoramento direto do Supabase PostgreSQL.

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
    console.error('[StatusAPI] Erro ao instanciar Supabase:', err);
    return null;
  }
}

function sendJson(res: any, statusCode: number, data: any) {
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.status === 'function') {
    const s = res.status(statusCode);
    if (typeof s?.json === 'function') return s.json(data);
  }
  res.statusCode = statusCode;
  return res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(204).end();
    }
    res.statusCode = 204;
    return res.end();
  }

  try {
    const supabase = getSupabaseServerAdmin();
    let total = 0;
    let modo = 'local-offline-ready';

    if (supabase) {
      try {
        const { count, error } = await supabase
          .from('audit_products')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null);

        if (!error && typeof count === 'number') {
          total = count;
          modo = 'supabase-postgresql';
        }
      } catch (errDb) {
        console.warn('[Status] Aviso ao consultar contagem no Supabase:', errDb);
      }
    }

    if (modo !== 'supabase-postgresql') {
      const dbFile = path.resolve(process.cwd(), 'data', 'central_database.json');
      if (fs.existsSync(dbFile)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
          total = Array.isArray(parsed.produtos) ? parsed.produtos.length : 0;
        } catch {}
      }
    }

    return sendJson(res, 200, {
      status: 'online',
      servidor: 'Vercel Serverless + Supabase PostgreSQL (RLS)',
      modo,
      supabaseConfigured: isSupabaseServerConfigured(),
      totalProdutos: total,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return sendJson(res, 200, { status: 'online', totalProdutos: 0, erro: err?.message || 'Erro desconhecido' });
  }
}
