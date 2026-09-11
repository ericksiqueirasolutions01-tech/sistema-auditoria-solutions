import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'central_database.json');
const LOGS_FILE = path.join(DATA_DIR, 'central_envios.json');

// Interface for Central Store
interface CentralData {
  produtos: any[];
  fotos?: any[];
  ultimaAtualizacao: string;
}

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial: CentralData = {
      produtos: [],
      fotos: [],
      ultimaAtualizacao: new Date().toISOString(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readCentralDb(): CentralData {
  ensureDataFiles();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.fotos)) {
      parsed.fotos = [];
    }
    return parsed;
  } catch (e) {
    console.error('[CentralServer] Erro ao ler banco central:', e);
    return { produtos: [], fotos: [], ultimaAtualizacao: new Date().toISOString() };
  }
}

const CLOUD_STORAGE_URL = 'https://extendsclass.com/api/json-storage/bin/dcccfea';

function writeCentralDb(data: CentralData) {
  ensureDataFiles();
  try {
    data.ultimaAtualizacao = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    fetch(CLOUD_STORAGE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'GRUPO SOLUTIONS AUDITORIA SAMSUNG',
        produtos: data.produtos,
        fotos: data.fotos || [],
        historico_envios: readCentralLogs(),
      }),
    }).catch(() => {});
  } catch (e) {
    console.error('[CentralServer] Erro ao gravar banco central:', e);
  }
}

function readCentralLogs(): any[] {
  ensureDataFiles();
  try {
    const content = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function appendCentralLog(logItem: any) {
  ensureDataFiles();
  try {
    const logs = readCentralLogs();
    logs.unshift(logItem);
    if (logs.length > 500) logs.splice(500);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (e) {
    console.error('[CentralServer] Erro ao gravar log de envio:', e);
  }
}

export function centralApiMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url || '';

  // Only handle /api/central routes
  if (!url.startsWith('/api/central')) {
    return next();
  }

  // Set standard CORS and JSON headers so any cell phone or LAN computer can access smoothly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const endpoint = url.split('?')[0];

  // 1. GET /api/central/status
  if (endpoint === '/api/central/status' && req.method === 'GET') {
    const db = readCentralDb();
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        online: true,
        servidor: 'Servidor Central Solutions (Ativo)',
        totalProdutos: db.produtos.length,
        ultimaAtualizacao: db.ultimaAtualizacao,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // 2. GET /api/central/produtos
  if (endpoint === '/api/central/produtos' && req.method === 'GET') {
    const db = readCentralDb();
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        sucesso: true,
        total: db.produtos.length,
        produtos: db.produtos,
        fotos: db.fotos || [],
        ultimaAtualizacao: db.ultimaAtualizacao,
      })
    );
    return;
  }

  // 3. GET /api/central/historico-envios
  if (endpoint === '/api/central/historico-envios' && req.method === 'GET') {
    const logs = readCentralLogs();
    res.statusCode = 200;
    res.end(JSON.stringify({ sucesso: true, logs }));
    return;
  }

  // 4. POST /api/central/sync (Recepção de novos seriais vindos de celulares ou outros PCs)
  if (endpoint === '/api/central/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const novosProdutos = Array.isArray(payload.produtos) ? payload.produtos : [];
        const computador = payload.computador || { id: 'DISPOSITIVO-REMOTO', nome: 'Aparelho Conectado' };
        const usuario = payload.usuario || 'Operador';
        const regional = payload.regional || 'VIA VAREJO RJ';

        const db = readCentralDb();
        const existentesMap = new Set<string>();

        // Re-index seriais por regional para validação estrita de duplicidade
        for (const p of db.produtos) {
          const chave = `${(p.regional || 'VIA VAREJO RJ').trim().toUpperCase()}:::${p.serial.trim().toUpperCase()}`;
          existentesMap.add(chave);
        }

        let adicionados = 0;
        let duplicados = 0;
        const agora = new Date().toISOString();
        const agoraFormatada = new Date().toLocaleString('pt-BR');
        const idsGravados: (string | number)[] = [];

        for (const p of novosProdutos) {
          const chave = `${(p.regional || regional).trim().toUpperCase()}:::${p.serial.trim().toUpperCase()}`;
          if (existentesMap.has(chave)) {
            duplicados++;
            continue;
          }

          // Prepara registro central com carimbos e metadados de auditoria
          const registroCentral = {
            ...p,
            id_servidor: `SRV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            regional: p.regional || regional,
            computador_id: p.computador_id || computador.id,
            computador_nome: p.computador_nome || computador.nome,
            status_sincronizacao: 'ENVIADO',
            sync_status: 'ENVIADO',
            data_sincronizacao: agora,
            recebido_em: agora,
          };

          db.produtos.unshift(registroCentral);
          existentesMap.add(chave);
          adicionados++;
          idsGravados.push(registroCentral.id || registroCentral.id_servidor);
        }

        // Processa fotos de evidência enviadas (10 em 10 produtos)
        const novasFotos = Array.isArray(payload.fotos) ? payload.fotos : [];
        if (!Array.isArray(db.fotos)) {
          db.fotos = [];
        }
        let fotosAdicionadas = 0;
        const fotosMap = new Map<string, any>();
        for (const f of db.fotos) {
          if (f && f.id) fotosMap.set(f.id, f);
        }
        for (const f of novasFotos) {
          if (f && f.id) {
            if (!fotosMap.has(f.id)) fotosAdicionadas++;
            fotosMap.set(f.id, { ...f, status_sincronizacao: 'ENVIADO', data_sincronizacao: agora });
          }
        }
        db.fotos = Array.from(fotosMap.values());

        // Grava no disco da máquina hospedeira
        writeCentralDb(db);

        // Registra o envio no log central
        if (adicionados > 0 || fotosAdicionadas > 0 || duplicados > 0) {
          appendCentralLog({
            id: Date.now(),
            data_envio: agoraFormatada,
            regional: regional,
            computador_id: computador.id,
            computador_nome: computador.nome,
            quantidade_enviada: adicionados,
            fotos_enviadas: fotosAdicionadas,
            duplicados_rejeitados: duplicados,
            status: 'OK',
            detalhes:
              duplicados > 0
                ? `${adicionados} novos seriais e ${fotosAdicionadas} fotos sincronizados na base central. ${duplicados} seriais rejeitados por duplicidade.`
                : `${adicionados} novos seriais e ${fotosAdicionadas} fotos sincronizados na base central com sucesso pelo ${computador.nome}.`,
            produtos_ids: idsGravados,
          });
        }

        console.log(
          `[CentralServer] Sync recebido de ${computador.nome} (${computador.id}): ${adicionados} adicionados, ${fotosAdicionadas} fotos, ${duplicados} duplicados. Total central: ${db.produtos.length} produtos, ${db.fotos.length} fotos.`
        );

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            sucesso: true,
            sincronizados: adicionados,
            fotosSincronizadas: fotosAdicionadas,
            duplicadosEvitados: duplicados,
            totalCentral: db.produtos.length,
            produtosCentral: db.produtos,
            fotosCentral: db.fotos,
            timestamp: agora,
            mensagem:
              duplicados > 0
                ? `${adicionados} novos seriais e ${fotosAdicionadas} foto(s) gravados no servidor central! (${duplicados} rejeitados por já constarem no banco).`
                : `${adicionados} novos seriais e ${fotosAdicionadas} foto(s) gravados no servidor central com sucesso!`,
          })
        );
      } catch (err: any) {
        console.error('[CentralServer] Erro no processamento do sync:', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ sucesso: false, erro: err.message || 'Erro ao processar sincronização' }));
      }
    });
    return;
  }

  // 5. POST /api/central/limpar (Apenas para testes/reset se admin)
  if (endpoint === '/api/central/limpar' && req.method === 'POST') {
    writeCentralDb({ produtos: [], fotos: [], ultimaAtualizacao: new Date().toISOString() });
    try {
      fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf-8');
    } catch {}
    res.statusCode = 200;
    res.end(JSON.stringify({ sucesso: true, mensagem: 'Base central limpa com sucesso: 0 produtos, 0 fotos, 0 sincronizações.' }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ erro: 'Rota não encontrada' }));
}

