// Health check da API Central (Gate 4)
// Erradicado extendsclass.com. Conexão e monitoramento direto do Supabase PostgreSQL.

import fs from 'fs';
import path from 'path';
import { getSupabaseServerAdmin, isSupabaseServerConfigured } from './_supabaseServer';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
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

    return res.status(200).json({
      status: 'online',
      servidor: 'Vercel Serverless + Supabase PostgreSQL (RLS)',
      modo,
      supabaseConfigured: isSupabaseServerConfigured(),
      totalProdutos: total,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(200).json({ status: 'online', totalProdutos: 0, erro: err.message });
  }
}
