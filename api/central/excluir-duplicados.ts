// Endpoint Central para Exclusão de Produtos com IMEI Duplicado no Servidor (Supabase PostgreSQL + JSON Fallback)
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
    console.error('[ExcluirDuplicadosAPI] Erro ao instanciar Supabase:', err);
    return null;
  }
}

const ALLOWED_ORIGINS = [
  'https://sistema-auditoria-solutions.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

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

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Mesma origem permitida
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const supabase = getSupabaseServerAdmin();
    let removidosSupabaseCount = 0;
    const duplicadosIdentificados: any[] = [];
    let totalRestante = 0;

    // 1. DEDUPLICAÇÃO NO SUPABASE POSTGRESQL (Base Oficial em Nuvem)
    if (supabase) {
      try {
        const { data: dbProducts, error: selectErr } = await supabase
          .from('audit_products')
          .select('id, serial, imei, modelo, numero_caixa, data_auditoria, created_at, regional_id')
          .order('created_at', { ascending: true }); // Preserva o registro original mais antigo/oficial

        if (!selectErr && Array.isArray(dbProducts)) {
          const mapaChaves = new Map<string, any>();
          const idsParaExcluir: string[] = [];

          for (const p of dbProducts) {
            const imeiNorm = (p.imei || '').trim().toUpperCase();
            const serialNorm = (p.serial || '').trim().toUpperCase();
            const chave = imeiNorm || serialNorm;

            if (!chave) continue;

            if (mapaChaves.has(chave)) {
              // Encontrou duplicado! Marcar o ID redundante para exclusão permanente
              idsParaExcluir.push(p.id);
              duplicadosIdentificados.push({
                id: p.id,
                imei: p.imei,
                serial: p.serial,
                modelo: p.modelo,
                caixa: p.numero_caixa,
                data_auditoria: p.data_auditoria,
                data_cadastro: p.created_at,
                mantido_id: mapaChaves.get(chave).id,
              });
            } else {
              mapaChaves.set(chave, p);
              if (serialNorm && serialNorm !== chave) mapaChaves.set(serialNorm, p);
              if (imeiNorm && imeiNorm !== chave) mapaChaves.set(imeiNorm, p);
            }
          }

          if (idsParaExcluir.length > 0) {
            for (const idDel of idsParaExcluir) {
              await supabase.from('audit_products').delete().eq('id', idDel);
            }
            removidosSupabaseCount = idsParaExcluir.length;
          }

          const { count } = await supabase.from('audit_products').select('*', { count: 'exact', head: true });
          totalRestante = count || 0;
        }

        // Limpar eventos de log de duplicidade para zerar contadores obsoletos
        await supabase.from('sync_events').delete().eq('event_type', 'SYNC_CONFLICT');
      } catch (errDb) {
        console.error('[ExcluirDuplicadosAPI] Erro ao expurgar duplicados do Supabase:', errDb);
      }
    }

    // 2. DEDUPLICAÇÃO NO ARQUIVO LOCAL DE FALLBACK (central_database.json)
    const { dbFile, tentFile } = obterCaminhosCentrais();
    let removidosLocalCount = 0;

    try {
      if (fs.existsSync(dbFile)) {
        const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
        const produtosAtuais = parsed.produtos || [];
        const seenKeys = new Set<string>();
        const produtosUnicos: any[] = [];

        for (const p of produtosAtuais) {
          const imei = (p.imei || p.serial || '').trim().toUpperCase();
          if (imei && seenKeys.has(imei)) {
            removidosLocalCount++;
          } else {
            if (imei) seenKeys.add(imei);
            produtosUnicos.push(p);
          }
        }

        if (removidosLocalCount > 0) {
          parsed.produtos = produtosUnicos;
          parsed.ultimaAtualizacao = new Date().toISOString();
          fs.writeFileSync(dbFile, JSON.stringify(parsed, null, 2), 'utf-8');
        }

        if (!totalRestante) {
          totalRestante = produtosUnicos.length;
        }
      }

      // Zerar arquivo de logs de tentativas duplicadas
      if (fs.existsSync(tentFile)) {
        fs.writeFileSync(tentFile, JSON.stringify([], null, 2), 'utf-8');
      }
    } catch (eFile) {
      console.warn('[ExcluirDuplicadosAPI] Aviso ao processar arquivos locais:', eFile);
    }

    const totalExcluidos = Math.max(removidosSupabaseCount, removidosLocalCount);

    return res.status(200).json({
      sucesso: true,
      mensagem: totalExcluidos > 0
        ? `Expurgo concluído: ${totalExcluidos} produto(s) com IMEI duplicado excluído(s) do servidor central.`
        : 'Nenhum produto com IMEI duplicado encontrado no servidor central. Base 100% íntegra e sem duplicidades.',
      removidos: totalExcluidos,
      duplicadosIdentificados,
      totalRestante,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[ExcluirDuplicadosAPI] Falha:', err);
    return res.status(500).json({
      sucesso: false,
      erro: err.message || 'Falha interna ao excluir produtos com IMEI duplicado.',
    });
  }
}

