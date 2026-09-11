const CLOUD_STORAGE_URL = 'https://extendsclass.com/api/json-storage/bin/dcccfea';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const getRes = await fetch(CLOUD_STORAGE_URL);
    if (!getRes.ok) {
      return res.status(200).json({ produtos: [], historico_envios: [] });
    }
    const data = await getRes.json();
    return res.status(200).json({
      sucesso: true,
      produtos: data.produtos || [],
      historico_envios: data.historico_envios || [],
      ultimaAtualizacao: data.ultimaAtualizacao || new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Erro ao buscar produtos da nuvem:', err);
    return res.status(200).json({ produtos: [], historico_envios: [] });
  }
}
