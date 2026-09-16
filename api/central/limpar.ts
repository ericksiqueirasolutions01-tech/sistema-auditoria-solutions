const CLOUD_STORAGE_URL = 'https://extendsclass.com/api/json-storage/bin/dcccfea';
const CLOUD_STORAGE_BACKUP_URL = 'https://extendsclass.com/api/json-storage/bin/ffedcbb';

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
    const cleanPayload = JSON.stringify({
      system: 'GRUPO SOLUTIONS AUDITORIA SAMSUNG',
      produtos: [],
      fotos: [],
      historico_envios: [],
      tentativas_duplicadas: [],
      reset_timestamp: agora,
      ultimaAtualizacao: agora,
    });

    let ok1 = false;
    let ok2 = false;

    // 1. Zerar storage principal com até 2 tentativas
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const putRes1 = await fetch(CLOUD_STORAGE_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: cleanPayload,
        });
        if (putRes1.ok) {
          ok1 = true;
          break;
        }
      } catch (e1) {
        console.error(`[LimparAPI] Tentativa ${attempt} falhou no storage principal:`, e1);
      }
    }

    // 2. Zerar storage de backup com até 2 tentativas
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const putRes2 = await fetch(CLOUD_STORAGE_BACKUP_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: cleanPayload,
        });
        if (putRes2.ok) {
          ok2 = true;
          break;
        }
      } catch (e2) {
        console.error(`[LimparAPI] Tentativa ${attempt} falhou no storage backup:`, e2);
      }
    }

    return res.status(200).json({
      sucesso: ok1 || ok2,
      mensagem: ok1 || ok2
        ? 'Base central online zerada com sucesso mediante autorização e confirmação.'
        : 'Falha ao contatar storages de nuvem.',
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
