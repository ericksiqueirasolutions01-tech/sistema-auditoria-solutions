// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  enfileirarEventoOutbox,
  listarEventosPendentes,
  marcarEventoSincronizado,
  contarEventosPendentes,
} from '../db/syncOutbox';
import { idb } from '../db/indexedDb';
import syncDeltaHandler from '../../api/central/sync-delta';

describe('GATE 5: Sincronização Delta / Outbox Engine com Idempotência e Concorrência', () => {
  beforeEach(async () => {
    await idb.sync_outbox.clear();
    await idb.produtos.clear();
    localStorage.clear();
  });

  describe('1. Fila Outbox Local Durável (Gate 9.1)', () => {
    it('deve gerar evento Outbox durável com UUID, idempotency_key, payload e revisão', async () => {
      const evento = await enfileirarEventoOutbox({
        device_id: 'PC-RJ-BANCADA-01',
        entity_type: 'PRODUTO',
        entity_id: 'PROD-1001',
        operation: 'INSERT',
        base_revision: 1,
        payload: {
          imei: '354897001122999',
          serial: '354897001122999',
          numero_lote: 'LOTE-OUTBOX-01',
          regional: 'VIA VAREJO RJ',
        },
      });

      expect(evento.event_id).toBeDefined();
      expect(evento.event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(evento.idempotency_key).toBe(`PC-RJ-BANCADA-01_INSERT_${evento.event_id}`);
      expect(evento.status).toBe('PENDENTE');
      expect(evento.attempts).toBe(0);

      // Consulta no IndexedDB
      const pendentes = await listarEventosPendentes();
      expect(pendentes.length).toBe(1);
      expect(pendentes[0].event_id).toBe(evento.event_id);
      expect(pendentes[0].payload.imei).toBe('354897001122999');

      // Marcar como sincronizado
      await marcarEventoSincronizado(evento.event_id);
      const totalPendentes = await contarEventosPendentes();
      expect(totalPendentes).toBe(0);
    });
  });

  describe('2. Idempotência e Replay Seguro (Gate 9.2)', () => {
    it('deve aceitar replay com mesma idempotency_key sem duplicar registros no servidor central', async () => {
      const eventId = `EVT-IDEMP-${Date.now()}`;
      const idempKey = `PC-RJ-01_INSERT_${eventId}`;
      const serialUnico = `IMEI-IDEMP-${Date.now()}`;

      const mockReq = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'operador_rj', nome: 'Operador Rio', perfil: 'OPERADOR', regional: 'VIA VAREJO RJ' },
          computador: { id: 'PC-RJ-01', nome: 'Bancada 01', status: 'ATIVO' },
          eventos: [
            {
              event_id: eventId,
              idempotency_key: idempKey,
              device_id: 'PC-RJ-01',
              entity_type: 'PRODUTO',
              entity_id: '1',
              operation: 'INSERT',
              base_revision: 1,
              payload: {
                imei: serialUnico,
                serial: serialUnico,
                numero_lote: 'L1',
                regional: 'VIA VAREJO RJ',
              },
            },
          ],
        },
      };

      let status1 = 0;
      let body1: any = null;
      const res1 = {
        setHeader: () => res1,
        status: (c: number) => {
          status1 = c;
          return { json: (d: any) => (body1 = d) };
        },
      };

      // Primeiro Envio: Inserção com sucesso
      await syncDeltaHandler(mockReq, res1);
      expect(status1).toBe(200);
      expect(body1.sucesso).toBe(true);
      expect(body1.processados).toBe(1);

      // Reenvio imediato do MESMO evento (Simulando retry por timeout de rede)
      let status2 = 0;
      let body2: any = null;
      const res2 = {
        setHeader: () => res2,
        status: (c: number) => {
          status2 = c;
          return { json: (d: any) => (body2 = d) };
        },
      };

      await syncDeltaHandler(mockReq, res2);
      expect(status2).toBe(200);
      expect(body2.replaysEvitados).toBe(1);
      expect(body2.resultados[0].status).toBe('REPLAY_IDENTICO_ACEITO');
    });
  });

  describe('3. Resolução de Conflitos e Tombstone (Gate 9.3)', () => {
    it('deve recusar inserção em lote finalizado no servidor por operador comum', async () => {
      // Simula lote já finalizado no banco central
      const dataDir = path.resolve(process.cwd(), 'data');
      const dbFile = path.join(dataDir, 'central_database.json');
      fs.writeFileSync(
        dbFile,
        JSON.stringify(
          {
            produtos: [],
            lotes: [{ numero_lote: 'LOTE-BLOQUEADO-01', status: 'FINALIZADO', regional: 'VIA VAREJO RJ' }],
            fotos: [],
            ultimaAtualizacao: new Date().toISOString(),
          },
          null,
          2
        )
      );

      const mockReq = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'operador_rj', nome: 'Operador Rio', perfil: 'OPERADOR', regional: 'VIA VAREJO RJ' },
          computador: { id: 'PC-RJ-01', nome: 'Bancada 01', status: 'ATIVO' },
          eventos: [
            {
              event_id: `EVT-LOTE-FECHADO-${Date.now()}`,
              entity_type: 'PRODUTO',
              entity_id: '99',
              operation: 'INSERT',
              base_revision: 1,
              payload: {
                imei: '354897001199888',
                serial: '354897001199888',
                numero_lote: 'LOTE-BLOQUEADO-01',
                regional: 'VIA VAREJO RJ',
              },
            },
          ],
        },
      };

      let statusCode = 0;
      let body: any = null;
      const mockRes = {
        setHeader: () => mockRes,
        status: (c: number) => {
          statusCode = c;
          return { json: (d: any) => (body = d) };
        },
      };

      await syncDeltaHandler(mockReq, mockRes);
      expect(statusCode).toBe(200);
      expect(body.sucesso).toBe(false);
      expect(body.conflitos).toBe(1);
      expect(body.resultados[0].status).toBe('CONFLITO_LOTE_FECHADO');
    });

    it('deve criar tombstone em caso de exclusão lógica auditável', async () => {
      const serialItem = `IMEI-DELETE-${Date.now()}`;

      // Inserção inicial
      const reqInsert = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'admin', nome: 'Admin Central', perfil: 'ADMINISTRADOR' },
          computador: { id: 'PC-ADMIN', status: 'ATIVO' },
          eventos: [
            {
              event_id: `EVT-INS-${Date.now()}`,
              entity_type: 'PRODUTO',
              entity_id: '1',
              operation: 'INSERT',
              base_revision: 1,
              payload: { imei: serialItem, serial: serialItem, numero_lote: 'L1', regional: 'VIA VAREJO RJ' },
            },
          ],
        },
      };
      await syncDeltaHandler(reqInsert, { setHeader: () => {}, status: () => ({ json: () => {} }) });

      // Evento de Delete
      const reqDelete = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'admin', nome: 'Admin Central', perfil: 'ADMINISTRADOR' },
          computador: { id: 'PC-ADMIN', status: 'ATIVO' },
          eventos: [
            {
              event_id: `EVT-DEL-${Date.now()}`,
              entity_type: 'PRODUTO',
              entity_id: '1',
              operation: 'DELETE',
              base_revision: 1,
              payload: { imei: serialItem, serial: serialItem },
            },
          ],
        },
      };

      let statusCode = 0;
      let body: any = null;
      const resDelete = {
        setHeader: () => resDelete,
        status: (c: number) => {
          statusCode = c;
          return { json: (d: any) => (body = d) };
        },
      };

      await syncDeltaHandler(reqDelete, resDelete);
      expect(statusCode).toBe(200);
      expect(body.resultados[0].status).toBe('SUCESSO_TOMBSTONE');
    });
  });

  describe('4. Teste de Corrida de Duplicidade Concorrente (Gate 9.4)', () => {
    it('ao simular 2 estações enviando o mesmo IMEI simultaneamente: exatamente 1 aceito e 1 bloqueado com log', async () => {
      const imeiCorrida = `35489700998877${Math.floor(Math.random() * 10)}`;

      const reqEstacao1 = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'operador_rj1', nome: 'Operador B1', perfil: 'OPERADOR', regional: 'VIA VAREJO RJ' },
          computador: { id: 'PC-RJ-BANCADA-01', nome: 'Bancada 01', status: 'ATIVO' },
          eventos: [
            {
              event_id: `EVT-RACE-1-${Date.now()}`,
              entity_type: 'PRODUTO',
              entity_id: 'P1',
              operation: 'INSERT',
              base_revision: 1,
              payload: { imei: imeiCorrida, serial: imeiCorrida, numero_lote: 'L1', regional: 'VIA VAREJO RJ' },
            },
          ],
        },
      };

      const reqEstacao2 = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'operador_rj2', nome: 'Operador B2', perfil: 'OPERADOR', regional: 'VIA VAREJO RJ' },
          computador: { id: 'PC-RJ-BANCADA-02', nome: 'Bancada 02', status: 'ATIVO' },
          eventos: [
            {
              event_id: `EVT-RACE-2-${Date.now()}`,
              entity_type: 'PRODUTO',
              entity_id: 'P2',
              operation: 'INSERT',
              base_revision: 1,
              payload: { imei: imeiCorrida, serial: imeiCorrida, numero_lote: 'L1', regional: 'VIA VAREJO RJ' },
            },
          ],
        },
      };

      let resp1: any = null;
      let resp2: any = null;

      const mockRes1 = {
        setHeader: () => mockRes1,
        status: () => ({ json: (d: any) => (resp1 = d) }),
      };

      const mockRes2 = {
        setHeader: () => mockRes2,
        status: () => ({ json: (d: any) => (resp2 = d) }),
      };

      // Disparo SIMULTÂNEO via Promise.all para simular concorrência real de rede
      await Promise.all([
        syncDeltaHandler(reqEstacao1, mockRes1),
        syncDeltaHandler(reqEstacao2, mockRes2),
      ]);

      const statuses = [
        resp1.resultados[0].status,
        resp2.resultados[0].status,
      ];

      // Exatamente um deve ser SUCESSO_INSERT
      const sucessos = statuses.filter((s) => s === 'SUCESSO_INSERT');
      expect(sucessos.length).toBe(1);

      // Exatamente um deve ser bloqueado por duplicidade / conflito de concorrência
      const bloqueados = statuses.filter(
        (s) => s === 'DUPLICADO_BLOQUEADO' || s === 'CONFLITO_CONCORRENCIA_DUPLICADO'
      );
      expect(bloqueados.length).toBe(1);
    }, 15000);
  });

  afterAll(() => {
    // Restaura banco central limpo de teste
    const dataDir = path.resolve(process.cwd(), 'data');
    try {
      fs.writeFileSync(
        path.join(dataDir, 'central_database.json'),
        JSON.stringify({ produtos: [], lotes: [], fotos: [], ultimaAtualizacao: '2026-09-14T12:00:00.000Z' }, null, 2),
        'utf-8'
      );
      fs.writeFileSync(path.join(dataDir, 'central_envios.json'), JSON.stringify([], null, 2), 'utf-8');
      fs.writeFileSync(path.join(dataDir, 'central_tentativas_duplicadas.json'), JSON.stringify([], null, 2), 'utf-8');
      fs.writeFileSync(path.join(dataDir, 'central_idempotency.json'), JSON.stringify({}, null, 2), 'utf-8');
    } catch {}
  });
});

