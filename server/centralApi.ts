import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'central_database.json');
const LOGS_FILE = path.join(DATA_DIR, 'central_envios.json');
const TENTATIVAS_FILE = path.join(DATA_DIR, 'central_tentativas_duplicadas.json');

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
  if (!fs.existsSync(TENTATIVAS_FILE)) {
    fs.writeFileSync(TENTATIVAS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readCentralTentativasDuplicadas(): any[] {
  ensureDataFiles();
  try {
    const content = fs.readFileSync(TENTATIVAS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function appendCentralTentativaDuplicada(item: any) {
  ensureDataFiles();
  try {
    const logs = readCentralTentativasDuplicadas();
    logs.unshift(item);
    if (logs.length > 1000) logs.splice(1000);
    fs.writeFileSync(TENTATIVAS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (e) {
    console.error('[CentralServer] Erro ao gravar tentativa duplicada:', e);
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
const CLOUD_STORAGE_BACKUP_URL = 'https://extendsclass.com/api/json-storage/bin/ffedcbb';

function writeCentralDb(data: CentralData) {
  ensureDataFiles();
  try {
    data.ultimaAtualizacao = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');

    // Sanitizar fotos para a nuvem evitando estouro de limite
    const fotosLeves = (data.fotos || []).map((f: any) => ({
      ...f,
      fotoDataUri:
        f.fotoDataUri && f.fotoDataUri.startsWith('data:image') && f.fotoDataUri.length > 2000
          ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90" fill="%230F172A"/><text x="60" y="45" fill="%2338BDF8" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="middle">FOTO REGISTRADA</text></svg>'
          : f.fotoDataUri,
    }));

    const cloudPayload = JSON.stringify({
      system: 'GRUPO SOLUTIONS AUDITORIA SAMSUNG',
      produtos: data.produtos,
      fotos: fotosLeves,
      historico_envios: readCentralLogs(),
      ultimaAtualizacao: data.ultimaAtualizacao,
    });

    fetch(CLOUD_STORAGE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: cloudPayload,
    })
      .then((res) => {
        if (!res.ok) {
          return fetch(CLOUD_STORAGE_BACKUP_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: cloudPayload,
          });
        }
      })
      .catch(() => {});
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

  // 3.1 GET /api/central/tentativas-duplicadas
  if (endpoint === '/api/central/tentativas-duplicadas' && req.method === 'GET') {
    const logs = readCentralTentativasDuplicadas();
    res.statusCode = 200;
    res.end(JSON.stringify({ sucesso: true, logs }));
    return;
  }

  // 3.2 POST /api/central/verificar-duplicidades
  if (endpoint === '/api/central/verificar-duplicidades' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const seriais: string[] = Array.isArray(payload.seriais) ? payload.seriais : [];
        const db = readCentralDb();
        const existentesMap = new Map<string, any>();
        for (const p of db.produtos) {
          if (p && p.serial) {
            existentesMap.set(p.serial.trim().toUpperCase(), p);
          }
        }
        const duplicados: any[] = [];
        for (const s of seriais) {
          const norm = (s || '').trim().toUpperCase();
          if (existentesMap.has(norm)) {
            const ex = existentesMap.get(norm);
            duplicados.push({
              imei: s,
              serial: s,
              modelo_produto: ex.modelo_produto || '',
              numero_caixa: ex.numero_caixa || '',
              data_cadastro_existente: ex.data_cadastro || ex.data_auditoria || ex.recebido_em || 'Data anterior não informada',
              usuario_existente: ex.usuario_cadastro || ex.usuario || 'Outro Colaborador',
              computador_existente: ex.computador_nome || ex.computador_id || 'Estação Remota',
              regional_existente: ex.regional || '',
              status: 'DUPLICADO NO SERVIDOR',
            });
          }
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ sucesso: true, duplicados }));
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ sucesso: false, erro: err.message || 'Erro ao verificar duplicidades' }));
      }
    });
    return;
  }

  // 4. POST /api/central/sync (Recepção de novos seriais com validação de duplicidade contra a base oficial)
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
        const existentesMap = new Map<string, any>();

        // Indexar todos os seriais/IMEIs já cadastrados na base central oficial
        for (const p of db.produtos) {
          if (p && p.serial) {
            existentesMap.set(p.serial.trim().toUpperCase(), p);
          }
        }

        let adicionados = 0;
        const agora = new Date().toISOString();
        const agoraFormatada = new Date().toLocaleString('pt-BR');
        const idsGravados: (string | number)[] = [];
        const duplicadosList: any[] = [];

        for (const p of novosProdutos) {
          const serialNorm = (p.serial || '').trim().toUpperCase();
          if (!serialNorm) continue;

          // Se já existe no servidor central, bloquear envio e detalhar duplicidade
          if (existentesMap.has(serialNorm)) {
            const existente = existentesMap.get(serialNorm);
            const detalheDuplicado = {
              imei: p.serial,
              serial: p.serial,
              modelo_produto: p.modelo_produto || existente.modelo_produto || '',
              numero_caixa: p.numero_caixa || existente.numero_caixa || '',
              data_cadastro_existente:
                existente.data_cadastro ||
                existente.data_auditoria ||
                existente.data_sincronizacao ||
                existente.recebido_em ||
                'Data anterior não informada',
              usuario_existente:
                existente.usuario_cadastro ||
                existente.usuario_criacao ||
                existente.usuario ||
                'Outro Colaborador',
              computador_existente:
                existente.computador_nome ||
                existente.computador_id ||
                'Outra Estação',
              regional_existente: existente.regional || 'Geral',
              status: 'DUPLICADO NO SERVIDOR',
              id_local: p.id,
            };
            duplicadosList.push(detalheDuplicado);

            // Gravar log de tentativa de envio duplicado no servidor central
            appendCentralTentativaDuplicada({
              id: Date.now() + Math.floor(Math.random() * 1000),
              usuario: usuario,
              data_hora: agoraFormatada,
              imei: p.serial,
              computador: `${computador.id} - ${computador.nome}`,
              resultado: 'BLOQUEADO: IMEI JÁ CADASTRADO NO SERVIDOR',
              regional: regional,
              data_cadastro_existente: detalheDuplicado.data_cadastro_existente,
              usuario_existente: detalheDuplicado.usuario_existente,
            });
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
          existentesMap.set(serialNorm, registroCentral);
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
        if (adicionados > 0 || fotosAdicionadas > 0 || duplicadosList.length > 0) {
          appendCentralLog({
            id: Date.now(),
            data_envio: agoraFormatada,
            regional: regional,
            computador_id: computador.id,
            computador_nome: computador.nome,
            quantidade_enviada: adicionados,
            fotos_enviadas: fotosAdicionadas,
            duplicados_rejeitados: duplicadosList.length,
            status: 'OK',
            detalhes:
              duplicadosList.length > 0
                ? `${adicionados} novos seriais e ${fotosAdicionadas} fotos sincronizados na base central. ${duplicadosList.length} IMEI(s) rejeitado(s) por duplicidade no servidor.`
                : `${adicionados} novos seriais e ${fotosAdicionadas} fotos sincronizados na base central com sucesso pelo ${computador.nome}.`,
            produtos_ids: idsGravados,
          });
        }

        console.log(
          `[CentralServer] Sync recebido de ${computador.nome} (${computador.id}): ${adicionados} adicionados, ${fotosAdicionadas} fotos, ${duplicadosList.length} duplicados bloqueados. Total central: ${db.produtos.length} produtos.`
        );

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            sucesso: true,
            sincronizados: adicionados,
            fotosSincronizadas: fotosAdicionadas,
            duplicadosEvitados: duplicadosList.length,
            itensDuplicados: duplicadosList,
            totalCentral: db.produtos.length,
            produtosCentral: db.produtos,
            fotosCentral: db.fotos,
            timestamp: agora,
            mensagem:
              duplicadosList.length > 0
                ? `${adicionados} novos seriais sincronizados online. ${duplicadosList.length} IMEI(s) não foram enviados pois já existem no servidor.`
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
  if (endpoint === '/api/central/limpar' && (req.method === 'POST' || req.method === 'GET')) {
    const agora = new Date().toISOString();
    writeCentralDb({ produtos: [], fotos: [], ultimaAtualizacao: agora });
    try {
      fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf-8');
      fs.writeFileSync(TENTATIVAS_FILE, JSON.stringify([], null, 2), 'utf-8');
    } catch {}

    const cleanPayload = JSON.stringify({
      system: 'GRUPO SOLUTIONS AUDITORIA SAMSUNG',
      produtos: [],
      fotos: [],
      historico_envios: [],
      tentativas_duplicadas: [],
      ultimaAtualizacao: agora,
    });

    fetch(CLOUD_STORAGE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: cleanPayload,
    })
      .then((r) => {
        if (!r.ok) {
          return fetch(CLOUD_STORAGE_BACKUP_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: cleanPayload,
          });
        }
      })
      .catch(() => {});

    res.statusCode = 200;
    res.end(JSON.stringify({ sucesso: true, mensagem: 'Base central limpa com sucesso: 0 produtos, 0 fotos, 0 sincronizações.' }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ erro: 'Rota não encontrada' }));
}

