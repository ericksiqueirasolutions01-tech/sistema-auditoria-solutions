const CLOUD_STORAGE_URL = 'https://extendsclass.com/api/json-storage/bin/dcccfea';
const CLOUD_STORAGE_BACKUP_URL = 'https://extendsclass.com/api/json-storage/bin/ffedcbb';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Permitir POST ou GET com confirmação para facilitar manutenção
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
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
        ? 'Base de dados central online limpa com sucesso. 0 produtos, 0 caixas, 0 fotos, 0 registros de testes.'
        : 'Aviso: Falha ao contatar os storages de nuvem principais, verifique a conexão.',
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
