// Motor de Sincronização Delta e Fila Outbox Local (Gate 5)
// Garante que toda mutação local gera um evento durável e idempotente

import { idb, type OutboxEvent } from './indexedDb';
import { gerarUUID } from '../utils/crypto';

export interface CriarEventoOutboxInput {
  device_id: string;
  entity_type: 'PRODUTO' | 'LOTE' | 'FOTO' | 'CAIXA';
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  base_revision?: number;
  payload: Record<string, any>;
}

export async function enfileirarEventoOutbox(input: CriarEventoOutboxInput): Promise<OutboxEvent> {
  const event_id = gerarUUID();
  const idempotency_key = `${input.device_id}_${input.operation}_${event_id}`;

  const evento: OutboxEvent = {
    event_id,
    idempotency_key,
    device_id: input.device_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    operation: input.operation,
    base_revision: input.base_revision || 1,
    payload: input.payload,
    created_at: new Date().toISOString(),
    attempts: 0,
    status: 'PENDENTE',
    last_error: null,
    synced_at: null,
  };

  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      await idb.sync_outbox.put(evento);
    }
  } catch (err) {
    console.error('[Outbox] Falha ao persistir evento no IndexedDB:', err);
    throw new Error(`Falha crítica na fila Outbox: ${err instanceof Error ? err.message : String(err)}`);
  }

  return evento;
}

export async function listarEventosPendentes(limite = 100): Promise<OutboxEvent[]> {
  try {
    if (typeof window === 'undefined' || !window.indexedDB) return [];
    return await idb.sync_outbox
      .where('status')
      .equals('PENDENTE')
      .limit(limite)
      .toArray();
  } catch (err) {
    console.error('[Outbox] Falha ao consultar eventos pendentes:', err);
    return [];
  }
}

export async function marcarEventoSincronizado(eventId: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    await idb.sync_outbox.update(eventId, {
      status: 'SINCRONIZADO',
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Outbox] Falha ao atualizar status de sincronizado:', err);
  }
}

export async function marcarEventoConflito(eventId: string, erro: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    await idb.sync_outbox.update(eventId, {
      status: 'CONFLITO',
      last_error: erro,
    });
  } catch (err) {
    console.error('[Outbox] Falha ao registrar conflito no evento:', err);
  }
}

export async function marcarEventoErro(eventId: string, erro: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    const ev = await idb.sync_outbox.get(eventId);
    if (ev) {
      await idb.sync_outbox.update(eventId, {
        attempts: ev.attempts + 1,
        last_error: erro,
      });
    }
  } catch (err) {
    console.error('[Outbox] Falha ao registrar erro no evento:', err);
  }
}

export async function contarEventosPendentes(): Promise<number> {
  try {
    if (typeof window === 'undefined' || !window.indexedDB) return 0;
    return await idb.sync_outbox.where('status').equals('PENDENTE').count();
  } catch {
    return 0;
  }
}

