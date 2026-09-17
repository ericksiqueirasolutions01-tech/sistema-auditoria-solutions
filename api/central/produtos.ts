// Endpoint Central Seguro de Consulta de Produtos (Gate 4)
// Eliminado JSON-bin de terceiros. Exige autenticação e aplica escopo regional (RLS).

import fs from 'fs';
import path from 'path';

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
