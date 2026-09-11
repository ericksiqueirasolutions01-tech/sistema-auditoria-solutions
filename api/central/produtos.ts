const CLOUD_STORAGE_URL = 'https://extendsclass.com/api/json-storage/bin/dcccfea';
const CLOUD_STORAGE_BACKUP_URL = 'https://extendsclass.com/api/json-storage/bin/ffedcbb';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    let getRes = await fetch(`${CLOUD_STORAGE_URL}?_t=${Date.now()}`);
    if (!getRes.ok) {
      getRes = await fetch(`${CLOUD_STORAGE_BACKUP_URL}?_t=${Date.now()}`);
    }
    if (!getRes.ok) {
      return res.status(200).json({ produtos: [], fotos: [], historico_envios: [] });
    }
    const data = await getRes.json();
    return res.status(200).json({
      sucesso: true,
      produtos: data.produtos || [],
      fotos: data.fotos || [],
      historico_envios: data.historico_envios || [],
      ultimaAtualizacao: data.ultimaAtualizacao || new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Erro ao buscar produtos da nuvem:', err);
    return res.status(200).json({ produtos: [], fotos: [], historico_envios: [] });
  }
}
