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

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    let getRes = await fetch(`${CLOUD_STORAGE_URL}?_t=${Date.now()}`);
    if (!getRes.ok) {
      getRes = await fetch(`${CLOUD_STORAGE_BACKUP_URL}?_t=${Date.now()}`);
    }
    if (!getRes.ok) {
      return res.status(200).json({ produtos: [], fotos: [], historico_envios: [], tentativas_duplicadas: [], reset_timestamp: null });
    }
    const data = await getRes.json();
    return res.status(200).json({
      sucesso: true,
      produtos: data.produtos || [],
      fotos: data.fotos || [],
      historico_envios: data.historico_envios || [],
      tentativas_duplicadas: data.tentativas_duplicadas || [],
      reset_timestamp: data.reset_timestamp || null,
      ultimaAtualizacao: data.ultimaAtualizacao || new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Erro ao buscar produtos da nuvem:', err);
    return res.status(200).json({ produtos: [], fotos: [], historico_envios: [], tentativas_duplicadas: [], reset_timestamp: null });
  }
}
