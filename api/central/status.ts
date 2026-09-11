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
      return res.status(200).json({ status: 'online', totalProdutos: 0, modo: 'cloud-serverless' });
    }
    const data = await getRes.json();
    const total = Array.isArray(data.produtos) ? data.produtos.length : 0;
    return res.status(200).json({
      status: 'online',
      servidor: 'Vercel Serverless + ExtendsClass Cloud Storage',
      totalProdutos: total,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(200).json({ status: 'online', totalProdutos: 0, erro: err.message });
  }
}
