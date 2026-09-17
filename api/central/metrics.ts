import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { observability } from '../../src/services/observability';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'central_database.json');
const DEVICES_FILE = path.join(DATA_DIR, 'central_devices.json');
const TENTATIVAS_FILE = path.join(DATA_DIR, 'central_tentativas_duplicadas.json');

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ erro: 'Método não permitido. Utilize GET.' }));
  }

  // Validação de autorização para métricas do sistema
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token && process.env.NODE_ENV === 'production') {
    res.statusCode = 401;
    return res.end(JSON.stringify({ erro: 'Não autorizado. Autenticação obrigatória para acessar métricas.' }));
  }

  try {
    let produtos: any[] = [];
    let fotos: any[] = [];
    let dispositivos: any[] = [];

    if (fs.existsSync(DB_FILE)) {
      const dbContent = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      produtos = dbContent.produtos || [];
      fotos = dbContent.fotos || [];
    }

    if (fs.existsSync(DEVICES_FILE)) {
      dispositivos = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8'));
    }

    // Filtra produtos pendentes de confirmação ou com status pendente
    const produtosPendentes = produtos.filter((p) => p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE');
    const fotosPendentesCount = fotos.filter((f) => f.sync_status === 'PENDENTE' || !f.sincronizado).length;

    const metricas = observability.coletarMetricas({
      produtosPendentes,
      dispositivos,
      fotosPendentesCount,
    });

    const auditLogs = observability.listarAuditLogs();

    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        status: 'OK',
        timestamp: new Date().toISOString(),
        metrics: metricas,
        audit_trail_count: auditLogs.length,
        recent_audit_events: auditLogs.slice(-10),
      })
    );
  } catch (error: any) {
    observability.logDbFailure('read_metrics', error?.message || 'Erro desconhecido');
    res.statusCode = 500;
    return res.end(JSON.stringify({ erro: 'Erro interno ao compilar métricas operacionais.' }));
  }
}

