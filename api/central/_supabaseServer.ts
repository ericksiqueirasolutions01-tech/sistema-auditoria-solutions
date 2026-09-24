import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.URL_SUPABASE || '';
  return url.trim();
}

export function getSupabaseServiceKey(): string {
  const key =
    process.env.SUPABASE_SERVER_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  return key.trim();
}

export function isSupabaseServerConfigured(): boolean {
  if (
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' ||
      Boolean(process.env.VITEST) ||
      Boolean(process.env.CI) ||
      Boolean(process.env.GITHUB_ACTIONS))
  ) {
    return false;
  }
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseServerAdmin(): SupabaseClient | null {
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
    console.error('[SupabaseServer] Falha ao inicializar cliente Supabase:', err);
    return null;
  }
}
