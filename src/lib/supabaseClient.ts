import { createClient, SupabaseClient } from '@supabase/supabase-js';

// No navegador / frontend: estritamente URL e Anon Key pública (Row Level Security)
const DEFAULT_SUPABASE_URL = 'https://chvfzqekkmongsrqbwev.supabase.co';
const DEFAULT_SUPABASE_ANON = 'sb_publishable_F-Lc83bJD87AokRbHPmltg_hp2q6Ghj';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

