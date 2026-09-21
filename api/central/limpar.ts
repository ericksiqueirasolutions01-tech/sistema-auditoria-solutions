// Endpoint Central Seguro de Limpeza Administrativa (Gate 6)
// Erradicado extendsclass.com. Conexão exclusiva ao Supabase PostgreSQL com trilha de auditoria append-only.

import fs from 'fs';
import path from 'path';
import { getSupabaseServerAdmin } from './_supabaseServer';

const ALLOWED_ORIGINS = [
  'https://sistema-auditoria-solutions.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function obterCaminhosCentrais() {
  const dataDir = path.resolve(process.cwd(), 'data');
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
    // Requisição mesma origem
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GATE 1: NUNCA permitir GET para operações destrutivas. Exclusivamente POST.
  if (req.method !== 'POST') {
    return res.status(405).json({
      sucesso: false,
      erro: 'Método não permitido. O endpoint de limpeza rejeita chamadas GET e exige POST autenticado com confirmação explícita.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {}
  }

  // Verificação de Autorização Administrativa (Token Bearer / Secret)
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const adminSecret = process.env.ADMIN_CLEANUP_SECRET;

  if (adminSecret && token !== adminSecret) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Acesso não autorizado. Token administrativo ausente ou inválido.',
    });
  }

  // Exigência de frase de confirmação explícita para evitar acionamentos involuntários
  const CONFIRMACAO_ESPERADA = 'CONFIRMAR_EXCLUSAO_TOTAL_BASE_DADOS';
  if (body?.confirmacao !== CONFIRMACAO_ESPERADA) {
    return res.status(400).json({
      sucesso: false,
      erro: `Operação rejeitada. É obrigatório fornecer o payload de confirmação: "${CONFIRMACAO_ESPERADA}".`,
    });
  }

  try {
    const agora = new Date().toISOString();
    const supabase = getSupabaseServerAdmin();

    // 1. Limpeza segura no Supabase se configurado
    if (supabase) {
      try {
        // Soft delete em audit_products e lots
        await supabase
          .from('audit_products')
          .update({ deleted_at: agora })
          .is('deleted_at', null);

        await supabase
          .from('lots')
          .update({ deleted_at: agora })
          .is('deleted_at', null);

        // Trilha imutável append-only
        await supabase.from('audit_log').insert({
          actor_user_id: body?.usuario || 'ADMINISTRADOR',
          device_id: 'PAINEL_ADMIN_WEB',
          action: 'LIMPEZA_TOTAL_BASE',
          entity_type: 'BASE_DADOS',
          entity_id: 'ALL',
          regional: 'GLOBAL',
          reason: body?.motivo || 'Limpeza autorizada da base de dados central',
          detalhes: 'Todos os produtos e lotes ativos foram marcados como excluídos.',
        });
      } catch (errDb) {
        console.error('[LimparAPI] Erro ao limpar no Supabase:', errDb);
      }
    }

    // 2. Limpeza do armazenamento local / fallback
    const { dbFile, logsFile, tentFile } = obterCaminhosCentrais();
    try {
      if (fs.existsSync(dbFile)) {
        fs.writeFileSync(
          dbFile,
          JSON.stringify({ produtos: [], fotos: [], ultimaAtualizacao: agora }, null, 2),
          'utf-8'
        );
      }
      if (fs.existsSync(logsFile)) {
        fs.writeFileSync(logsFile, JSON.stringify([], null, 2), 'utf-8');
      }
      if (fs.existsSync(tentFile)) {
        fs.writeFileSync(tentFile, JSON.stringify([], null, 2), 'utf-8');
      }
    } catch (eDisk) {
      console.warn('[LimparAPI] Aviso ao resetar arquivos locais:', eDisk);
    }

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Base central online zerada com sucesso mediante autorização e confirmação.',
      reset_timestamp: agora,
      timestamp: agora,
    });
  } catch (err: any) {
    console.error('[LimparAPI] Erro ao zerar base central:', err);
    return res.status(500).json({
      sucesso: false,
      erro: err.message || 'Erro interno ao zerar base central.',
    });
  }
}
