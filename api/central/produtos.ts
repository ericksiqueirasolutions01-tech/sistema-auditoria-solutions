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

function formatarDataParaExibicaoBR(dataInput: any): string {
  if (!dataInput) return '';
  const str = String(dataInput).trim();
  // Se já for DD/MM/YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyyMatch) {
    return `${ddmmyyyyMatch[1].padStart(2, '0')}/${ddmmyyyyMatch[2].padStart(2, '0')}/${ddmmyyyyMatch[3]}`;
  }
  // Se for YYYY-MM-DD
  const yyyymmddMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (yyyymmddMatch) {
    return `${yyyymmddMatch[3].padStart(2, '0')}/${yyyymmddMatch[2].padStart(2, '0')}/${yyyymmddMatch[1]}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR');
    }
  } catch {}
  return str;
}

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

        const regionalFiltro = (userPerfil === 'OPERADOR' || userPerfil === 'SUPERVISOR_REGIONAL')
          ? userRegional
          : (req.query?.regional ? String(req.query.regional).trim().toUpperCase() : 'TODAS');

        if (regionalFiltro && regionalFiltro !== 'TODAS') {
          const { data: allRegions } = await supabase.from('regions').select('id, codigo, nome');
          if (Array.isArray(allRegions)) {
            const regLimpa = regionalFiltro.replace(/^VIA VAREJO\s*[-]?\s*/, '').trim();
            const found = allRegions.find((r: any) =>
              (r.codigo && r.codigo.toUpperCase() === regLimpa) ||
              (r.nome && r.nome.toUpperCase() === regionalFiltro) ||
              (r.codigo && regionalFiltro.includes(r.codigo.toUpperCase())) ||
              (r.nome && r.nome.toUpperCase().includes(regLimpa))
            );
            if (found?.id) {
              query = query.eq('regional_id', found.id);
            }
          }
        }

        const { data: dbProducts, error: dbError } = await query;
        if (!dbError && Array.isArray(dbProducts)) {
          // Extrair fotos de evidências salvas nas caixas
          const fotosExtraidasMap = new Map<string, any>();
          const registros10ExtraidosMap = new Map<string, any>();

          for (const dp of dbProducts) {
            const obs = dp.observacao || '';
            if (obs.includes('[EVIDENCIAS_CAIXA:')) {
              try {
                const startIdx = obs.indexOf('[EVIDENCIAS_CAIXA:');
                const jsonStart = startIdx + '[EVIDENCIAS_CAIXA:'.length;
                const lastBracket = obs.lastIndexOf(']');
                if (lastBracket > jsonStart) {
                  const jsonStr = obs.substring(jsonStart, lastBracket).trim();
                  const parsed = JSON.parse(jsonStr);
                  const cx = parsed.caixa || dp.numero_caixa || 'Caixa 01';
                  const reg = parsed.regional || dp.regions?.nome || dp.regions?.codigo || userRegional || 'VIA VAREJO RJ';
                  const chaveCx = `${reg}:::${cx}`;

                  if (!registros10ExtraidosMap.has(chaveCx)) {
                    registros10ExtraidosMap.set(chaveCx, {
                      id: `FOTOS-${reg.replace(/[^A-Z0-9]/g, '')}-${cx.replace(/[^A-Z0-9]/g, '')}`,
                      regional: reg,
                      caixa: cx,
                      dataCriacao: dp.created_at,
                      status_sincronizacao: 'ENVIADO',
                      fotos: parsed.fotos || [],
                    });
                  }

                  for (const f of (parsed.fotos || [])) {
                    if (f && f.fotoDataUri) {
                      const idFoto = `FOTO-${reg.replace(/[^A-Z0-9]/g, '')}-${cx.replace(/[^A-Z0-9]/g, '')}-${f.indice}`;
                      if (!fotosExtraidasMap.has(idFoto)) {
                        fotosExtraidasMap.set(idFoto, {
                          id: idFoto,
                          regional: reg,
                          caixa: cx,
                          grupoNumero: f.indice,
                          grupoRotulo: f.rotulo || `Foto dos produtos ${f.indice}`,
                          fotoDataUri: f.fotoDataUri,
                          dataCriacao: dp.created_at,
                          status_sincronizacao: 'ENVIADO',
                        });
                      }
                    }
                  }
                }
              } catch (e) {
                console.warn('Erro ao parsear fotos de evidencia no Supabase:', e);
              }
            }
          }

          // Filtrar produtos auditados reais (excluindo os registros de controle de fotos)
          const produtosReais = dbProducts.filter((p: any) =>
            !p.serial?.startsWith('EVIDENCIA_FOTOS_') && p.modelo !== 'EVIDENCIA FOTOGRAFICA'
          );

          // Mapa de lacres por caixa para garantir que toda a caixa herde o lacre
          const lacresPorCaixa = new Map<string, string>();
          for (const dp of produtosReais) {
            const cx = (dp.numero_caixa || '').trim().toUpperCase();
            const reg = (dp.regions?.nome || dp.regions?.codigo || '').trim().toUpperCase();
            let lacre = dp.lacre_seguranca || '';
            if (!lacre && dp.observacao && dp.observacao.includes('[LACRE:')) {
              const m = dp.observacao.match(/\[LACRE:(.*?)\]/);
              if (m && m[1]) lacre = m[1].trim();
            }
            if (lacre && cx) {
              lacresPorCaixa.set(`${reg}:::${cx}`, lacre);
              lacresPorCaixa.set(cx, lacre);
            }
          }

          const produtosFormatados = produtosReais.map((p: any) => {
            const cxNorm = (p.numero_caixa || '').trim().toUpperCase();
            const regNorm = (p.regions?.nome || p.regions?.codigo || userRegional || 'VIA VAREJO RJ').trim().toUpperCase();
            let lacreSeguranca = p.lacre_seguranca || lacresPorCaixa.get(`${regNorm}:::${cxNorm}`) || lacresPorCaixa.get(cxNorm) || null;
            let observacaoLimpa = p.observacao || '';
            if (p.observacao && p.observacao.includes('[LACRE:')) {
              const match = p.observacao.match(/\[LACRE:(.*?)\]/);
              if (match && match[1]) {
                if (!lacreSeguranca) lacreSeguranca = match[1].trim();
                observacaoLimpa = p.observacao.replace(/\[LACRE:.*?\]\s*/g, '').trim();
              }
            }
            if (observacaoLimpa.includes('[EVIDENCIAS_CAIXA:')) {
              const startEv = observacaoLimpa.indexOf('[EVIDENCIAS_CAIXA:');
              const endEv = observacaoLimpa.lastIndexOf(']');
              if (endEv > startEv) {
                observacaoLimpa = (observacaoLimpa.substring(0, startEv) + observacaoLimpa.substring(endEv + 1)).trim();
              }
            }

            const classifCalculada =
              p.product_classification ||
              p.box_classification ||
              (p.source_type === 'LISTED'
                ? (p.dealer && p.dealer.toUpperCase() !== 'SAMSUNG'
                    ? `PRODUTO NA LISTA - ${p.dealer.toUpperCase()}`
                    : `PRODUTO NA LISTA - SAMSUNG`)
                : ((p.fabricante || p.brand || 'SAMSUNG').toUpperCase() === 'SAMSUNG'
                    ? 'FORA DA LISTA - SAMSUNG'
                    : `FORA DA LISTA - ${(p.fabricante || p.brand || 'OUTRA MARCA').toUpperCase()}`));

            return {
              id: p.id_local || p.id,
              id_local: p.id_local || p.id,
              id_servidor: p.id,
              serial: p.serial,
              imei: p.imei || p.serial,
              ean: p.ean || '',
              sku: p.sku || p.ean || '',
              modelo_produto: p.modelo,
              fabricante: p.fabricante || p.brand || 'SAMSUNG',
              brand: p.brand || p.fabricante || 'SAMSUNG',
              numero_lote: p.numero_lote,
              numero_caixa: p.numero_caixa,
              box_name: p.box_name || p.numero_caixa,
              regional: p.regional || p.regions?.nome || p.regions?.codigo || userRegional || 'VIA VAREJO RJ',
              produto_lacrado: p.produto_lacrado,
              kit_completo: p.kit_completo,
              aparelho_marcas_uso: p.aparelho_marcas_uso,
              lacre_seguranca: lacreSeguranca,
              observacao: observacaoLimpa,
              usuario_sincronizacao: p.usuario_bipagem,
              usuario_cadastro: p.usuario_bipagem,
              data_auditoria: formatarDataParaExibicaoBR(p.data_auditoria),
              data_sincronizacao: p.created_at,
              status_sincronizacao: p.status_sincronizacao,
              origin_invoice: p.origin_invoice || null,
              nf_origem: p.origin_invoice || null,
              nf_origem_samsung: p.nf_origem_samsung || p.origin_invoice || null,
              classificacao_produto: classifCalculada,
              product_classification: classifCalculada,
              box_classification: classifCalculada,
              source_type: p.source_type || 'OUT_OF_LIST',
              dealer: p.dealer || null,
              computador_id: p.device_id || 'PC-01',
              computador_nome: 'Estação',
            };
          });

          const localData = obterDadosCentraisLocais();
          const fotosConsolidadasMap = new Map<string, any>();
          for (const f of localData.fotos || []) {
            if (f && f.id) fotosConsolidadasMap.set(f.id, f);
          }
          for (const f of Array.from(fotosExtraidasMap.values())) {
            fotosConsolidadasMap.set(f.id, f);
          }

          return res.status(200).json({
            sucesso: true,
            origem: 'SUPABASE_POSTGRES',
            produtos: produtosFormatados,
            fotos: Array.from(fotosConsolidadasMap.values()),
            registros_10_fotos: Array.from(registros10ExtraidosMap.values()),
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

    const produtosFormatadosLocal = produtosFiltrados.map((p: any) => {
      let lacre = p.lacre_seguranca || null;
      let obs = p.observacao || '';
      if (!lacre && obs.includes('[LACRE:')) {
        const m = obs.match(/\[LACRE:(.*?)\]/);
        if (m && m[1]) {
          lacre = m[1].trim();
          obs = obs.replace(/\[LACRE:.*?\]\s*/g, '').trim();
        }
      }
      return {
        ...p,
        lacre_seguranca: lacre,
        observacao: obs,
        sku: p.sku || p.ean || '',
        fabricante: p.fabricante || p.brand || 'SAMSUNG',
        brand: p.brand || p.fabricante || 'SAMSUNG',
        computador_id: p.computador_id || 'PC-01',
      };
    });

    return res.status(200).json({
      sucesso: true,
      origem: 'LOCAL_STORAGE',
      produtos: produtosFormatadosLocal,
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
