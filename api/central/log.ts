// Endpoint Central para Registro de Erros Críticos e Telemetria Operacional
// Registra na tabela audit_log do Supabase: usuário, computador, horário, erro, operação.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_FALLBACK_URL = 'https://chvfzqekkmongsrqbwev.supabase.co';
const SUPABASE_FALLBACK_KEY = 'sb_publishable_F-Lc83bJD87AokRbHPmltg_hp2q6Ghj';

function getSupabaseUrl(): string {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.URL_SUPABASE ||
    SUPABASE_FALLBACK_URL;
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
    console.error('[LogAPI] Erro ao instanciar Supabase:', err);
    return null;
  }
}

const ALLOWED_ORIGINS = [
  'https://sistema-auditoria-solutions.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, erro: 'Método não permitido. Utilize POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const usuario = body.usuario?.nome || body.usuario?.login || body.usuario || 'DESCONHECIDO';
    const computador = body.computador?.id || body.computador?.nome || body.computador || 'PC-DESCONHECIDO';
    const horario = body.horario || new Date().toISOString();
    const erro = body.erro || 'Erro não especificado';
    const operacao = body.operacao || 'OPERACAO';
    const regional = body.regional || body.usuario?.regional || 'GERAL';
    const detalhes = body.detalhes || null;

    const supabase = getSupabaseServerAdmin();
    if (supabase) {
      const payloadLog = {
        actor_user_id: String(usuario).slice(0, 100),
        device_id: String(computador).slice(0, 100),
        action: 'ERRO_CRITICO',
        entity_type: String(operacao).slice(0, 50),
        entity_id: `ERR-${Date.now()}`,
        regional: String(regional).slice(0, 100),
        detalhes: JSON.stringify({
          erro: String(erro).slice(0, 500),
          detalhes,
          horario,
        }),
      };

      const { error: insErr } = await supabase.from('audit_log').insert(payloadLog);
      if (insErr) {
        console.warn('[LogAPI] Aviso ao gravar em audit_log:', insErr);
      }
    }

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Log de erro registrado com sucesso.',
      registrado_em: horario,
    });
  } catch (err: any) {
    console.error('[LogAPI] Exceção ao registrar erro:', err);
    return res.status(500).json({ sucesso: false, erro: err?.message || 'Falha ao processar log' });
  }
}
