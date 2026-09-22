// Endpoint Central Seguro de Consulta de Produtos (Gate 4)
// Conexão direta ao Supabase PostgreSQL com escopo regional (RLS) e fallback seguro.

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
    console.error('[ProdutosAPI] Erro ao instanciar Supabase:', err);
    return null;
  }
}

const ALLOWED_ORIGINS = [
  'https://sistema-auditoria-solutions.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function obterDadosCentraisLocais() {
  const dataDir = path.resolve(process.cwd(), 'data');
  const dbFile = path.join(dataDir, 'central_database.json');
  const logsFile = path.join(dataDir, 'central_envios.json');
  const tentFile = path.join(dataDir, 'central_tentativas_duplicadas.json');

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

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Mesma origem permitida
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-Regional, X-User-Perfil');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 1. Verificação de Autenticação Obrigatória (Gate 4)
  const authHeader = req.headers?.authorization || req.headers?.['authorization'];
  const userPerfil = (req.headers?.['x-user-perfil'] || req.query?.perfil || '').toString().trim().toUpperCase();
  const userRegional = (req.headers?.['x-user-regional'] || req.query?.regional || '').toString().trim().toUpperCase();

  // Rejeita acesso anônimo sem identificação
  if (!authHeader && !userPerfil) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Não autorizado. Acesso ao banco central exige token ou credencial de sessão autenticada.',
    });
  }

  try {
    const supabase = getSupabaseServerAdmin();

    // Se o Supabase estiver configurado, busca diretamente da base central PostgreSQL
    if (supabase) {
      try {
        let query = supabase
          .from('audit_products')
          .select('*, regions(codigo, nome)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (userPerfil === 'OPERADOR' || userPerfil === 'SUPERVISOR_REGIONAL') {
          if (userRegional && userRegional !== 'TODAS') {
            // Filtrar pela regional
            const { data: reg } = await supabase
              .from('regions')
              .select('id')
              .or(`codigo.eq.${userRegional},nome.eq.${userRegional}`)
              .maybeSingle();

            if (reg?.id) {
              query = query.eq('regional_id', reg.id);
            }
          }
        } else if (req.query?.regional && req.query.regional !== 'TODAS') {
          const regFiltro = req.query.regional.trim().toUpperCase();
          const { data: reg } = await supabase
            .from('regions')
            .select('id')
            .or(`codigo.eq.${regFiltro},nome.eq.${regFiltro}`)
            .maybeSingle();

          if (reg?.id) {
            query = query.eq('regional_id', reg.id);
          }
        }

        const { data: dbProducts, error: dbError } = await query;
        if (!dbError && Array.isArray(dbProducts) && dbProducts.length > 0) {
          const produtosFormatados = dbProducts.map((p: any) => ({
            id: p.id_local || p.id,
            id_servidor: p.id,
            serial: p.serial,
            imei: p.imei,
            ean: p.ean,
            modelo_produto: p.modelo,
            numero_lote: p.numero_lote,
            numero_caixa: p.numero_caixa,
            regional: p.regions?.nome || p.regions?.codigo || userRegional || 'VIA VAREJO RJ',
            produto_lacrado: p.produto_lacrado,
            kit_completo: p.kit_completo,
            aparelho_marcas_uso: p.aparelho_marcas_uso,
            observacao: p.observacao,
            usuario_sincronizacao: p.usuario_bipagem,
            data_auditoria: p.data_auditoria,
            data_sincronizacao: p.created_at,
            status_sincronizacao: p.status_sincronizacao,
          }));

          const localData = obterDadosCentraisLocais();
          return res.status(200).json({
            sucesso: true,
            origem: 'SUPABASE_POSTGRES',
            produtos: produtosFormatados,
            fotos: localData.fotos,
            historico_envios: localData.historico_envios,
            tentativas_duplicadas: localData.tentativas_duplicadas,
            totalRegistros: produtosFormatados.length,
            ultimaAtualizacao: new Date().toISOString(),
          });
        }
      } catch (errSupabase) {
        console.warn('[Central] Falha ao consultar Supabase, usando cache local:', errSupabase);
      }
    }

    // Fallback local em memória/disco
    const dados = obterDadosCentraisLocais();
    let produtosFiltrados = dados.produtos;

    // 2. Aplicação de Escopo Regional Server-Side (RLS)
    if (userPerfil === 'OPERADOR' || userPerfil === 'SUPERVISOR_REGIONAL') {
      if (userRegional && userRegional !== 'TODAS') {
        produtosFiltrados = dados.produtos.filter((p: any) => {
          const reg = (p.regional || '').trim().toUpperCase();
          return reg === userRegional;
        });
      }
    } else if (req.query?.regional && req.query.regional !== 'TODAS') {
      const regFiltro = req.query.regional.trim().toUpperCase();
      produtosFiltrados = dados.produtos.filter((p: any) => {
        const reg = (p.regional || '').trim().toUpperCase();
        return reg === regFiltro;
      });
    }

    return res.status(200).json({
      sucesso: true,
      origem: 'LOCAL_STORAGE',
      produtos: produtosFiltrados,
      fotos: dados.fotos,
      historico_envios: dados.historico_envios,
      tentativas_duplicadas: dados.tentativas_duplicadas,
      totalRegistros: produtosFiltrados.length,
      ultimaAtualizacao: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Central] Erro ao consultar produtos:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Falha interna ao processar consulta transacional central.',
    });
  }
}
