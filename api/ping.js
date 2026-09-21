export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const payload = { ok: true, timestamp: new Date().toISOString(), server: 'Vercel Serverless' };
  if (typeof res.status === 'function') {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(payload));
}
