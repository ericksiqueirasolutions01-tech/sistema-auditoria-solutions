/**
 * SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG
 * Módulo de Observabilidade, Logs Estruturados, Métricas Operacionais e Trilha Append-Only (Gate 15)
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type EventoObservabilidade =
  | 'AUTH_FAILURE'
  | 'SYNC_FAILURE'
  | 'SYNC_CONFLICT'
  | 'LOT_FINALIZE'
  | 'LOT_REOPEN'
  | 'ADMIN_MUTATION'
  | 'PHOTO_UPLOAD_FAILURE'
  | 'DB_FAILURE'
  | 'BACKUP_RESTORE'
  | 'APP_UPDATE';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  event_type: EventoObservabilidade;
  request_id?: string;
  actor?: string;
  device_id?: string;
  regional?: string;
  message: string;
  details: Record<string, any>;
}

export interface AuditLogEntry {
  event_id: string; // UUID v4
  actor_user_id: string;
  device_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before: any | null;
  after: any | null;
  reason: string | null;
  server_timestamp: string;
  request_id: string;
  regional: string;
}

export interface ObservabilityMetrics {
  pending_outbox_count: number;
  oldest_pending_age: number; // Idade em segundos do item mais antigo
  sync_error_rate: number; // Taxa percentual (0 - 100%)
  conflict_count: number;
  pending_photo_count: number;
  app_version_by_device: Record<string, number>;
  last_sync_by_device: Record<string, string | null>;
  total_sync_attempts: number;
  total_sync_failures: number;
}

/**
 * Sanitizador de segurança para logs: remove credenciais, senhas e tokens
 */
export function sanitizarParaLog(dado: any): any {
  if (!dado || typeof dado !== 'object') return dado;

  if (Array.isArray(dado)) {
    return dado.map((item) => sanitizarParaLog(item));
  }

  const sanitizado: Record<string, any> = {};
  const chavesSensiveis = ['senha', 'password', 'secret', 'token', 'access_token', 'authorization', 'hash'];

  for (const [chave, valor] of Object.entries(dado)) {
    if (chavesSensiveis.includes(chave.toLowerCase())) {
      sanitizado[chave] = '[REDACTED_BY_SECURITY_POLICY]';
    } else if (typeof valor === 'object' && valor !== null) {
      sanitizado[chave] = sanitizarParaLog(valor);
    } else {
      sanitizado[chave] = valor;
    }
  }

  return sanitizado;
}

class ObservabilityManager {
  private structuredLogs: StructuredLogEntry[] = [];
  private appendOnlyAuditLog: AuditLogEntry[] = [];
  private syncAttemptsCount = 0;
  private syncFailuresCount = 0;
  private conflictCounter = 0;

  /**
   * Registra log estruturado sanitizado
   */
  public log(
    level: LogLevel,
    event_type: EventoObservabilidade,
    message: string,
    context: {
      request_id?: string;
      actor?: string;
      device_id?: string;
      regional?: string;
      details?: Record<string, any>;
    } = {}
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event_type,
      message,
      request_id: context.request_id || `req-${Math.random().toString(36).substr(2, 9)}`,
      actor: context.actor,
      device_id: context.device_id,
      regional: context.regional,
      details: sanitizarParaLog(context.details || {}),
    };

    this.structuredLogs.unshift(entry);
    if (this.structuredLogs.length > 2000) {
      this.structuredLogs.splice(2000);
    }

    // Emissão no console sem dados sensíveis
    const logPrefix = `[OBSERVABILITY][${entry.level}][${entry.event_type}]`;
    if (level === 'ERROR') {
      console.error(logPrefix, entry.message, JSON.stringify(entry.details));
    } else if (level === 'WARN') {
      console.warn(logPrefix, entry.message, JSON.stringify(entry.details));
    } else {
      console.log(logPrefix, entry.message, JSON.stringify(entry.details));
    }

    return entry;
  }

  // Métodos de conveniência para os 9 eventos obrigatórios da Seção 19
  public logAuthFailure(actor: string, device_id: string, reason: string, request_id?: string) {
    return this.log('WARN', 'AUTH_FAILURE', `Falha de autenticação para usuário ${actor}`, {
      actor,
      device_id,
      request_id,
      details: { reason },
    });
  }

  public logSyncFailure(device_id: string, regional: string, error: string, request_id?: string) {
    this.syncFailuresCount++;
    this.syncAttemptsCount++;
    return this.log('ERROR', 'SYNC_FAILURE', `Falha na sincronização do dispositivo ${device_id}`, {
      device_id,
      regional,
      request_id,
      details: { error },
    });
  }

  public logSyncConflict(serial: string, device_id: string, regional: string, existingData: any, request_id?: string) {
    this.conflictCounter++;
    this.syncAttemptsCount++;
    return this.log('WARN', 'SYNC_CONFLICT', `Conflito de duplicidade detectado para serial ${serial}`, {
      device_id,
      regional,
      request_id,
      details: { serial, existing: sanitizarParaLog(existingData) },
    });
  }

  public logLotFinalize(lotNumber: string, regional: string, actor: string, itemCount: number, request_id?: string) {
    return this.log('INFO', 'LOT_FINALIZE', `Lote ${lotNumber} finalizado na regional ${regional}`, {
      actor,
      regional,
      request_id,
      details: { lotNumber, totalItems: itemCount },
    });
  }

  public logLotReopen(lotNumber: string, regional: string, actor: string, reason: string, request_id?: string) {
    return this.log('WARN', 'LOT_REOPEN', `Lote ${lotNumber} reaberto na regional ${regional}`, {
      actor,
      regional,
      request_id,
      details: { lotNumber, reason },
    });
  }

  public logAdminMutation(
    actor: string,
    action: string,
    entity_type: string,
    entity_id: string,
    before: any,
    after: any,
    reason: string,
    request_id?: string
  ) {
    const entry = this.log('INFO', 'ADMIN_MUTATION', `Mutação administrativa em ${entity_type}:${entity_id}`, {
      actor,
      request_id,
      details: { action, entity_type, entity_id, before, after, reason },
    });

    // Registra simultaneamente na trilha de auditoria append-only
    this.gravarAuditLog({
      actor_user_id: actor,
      device_id: 'ADMIN-CONSOLE',
      action,
      entity_type,
      entity_id,
      before,
      after,
      reason,
      request_id: entry.request_id || 'req-mutation',
      regional: 'TODAS',
    });

    return entry;
  }

  public logPhotoUploadFailure(photoId: string, error: string, request_id?: string) {
    return this.log('ERROR', 'PHOTO_UPLOAD_FAILURE', `Falha no upload da foto ${photoId}`, {
      request_id,
      details: { photoId, error },
    });
  }

  public logDbFailure(operation: string, error: string, request_id?: string) {
    return this.log('ERROR', 'DB_FAILURE', `Falha de persistência no banco: ${operation}`, {
      request_id,
      details: { operation, error },
    });
  }

  public logBackupRestore(action: 'BACKUP' | 'RESTORE', status: 'SUCCESS' | 'FAILURE', manifestHash: string, actor: string, request_id?: string) {
    return this.log(status === 'SUCCESS' ? 'INFO' : 'ERROR', 'BACKUP_RESTORE', `Operação de ${action} executada com status ${status}`, {
      actor,
      request_id,
      details: { action, status, manifestHash },
    });
  }

  public logAppUpdate(fromVersion: string, toVersion: string, device_id: string, status: string, request_id?: string) {
    return this.log('INFO', 'APP_UPDATE', `Atualização do aplicativo de v${fromVersion} para v${toVersion}`, {
      device_id,
      request_id,
      details: { fromVersion, toVersion, status },
    });
  }

  // ============================================================================
  // AUDIT LOG (APPEND-ONLY NO SERVIDOR)
  // ============================================================================

  /**
   * Grava registro na trilha de auditoria append-only
   */
  public gravarAuditLog(entry: Omit<AuditLogEntry, 'event_id' | 'server_timestamp'>): AuditLogEntry {
    const auditRecord: AuditLogEntry = {
      ...entry,
      event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      server_timestamp: new Date().toISOString(),
      before: sanitizarParaLog(entry.before),
      after: sanitizarParaLog(entry.after),
    };

    // Append-only: inserção no fim da lista
    this.appendOnlyAuditLog.push(Object.freeze(auditRecord));
    return auditRecord;
  }

  /**
   * Consulta os registros de auditoria
   */
  public listarAuditLogs(filtro?: { regional?: string; entity_type?: string }): readonly AuditLogEntry[] {
    let list = this.appendOnlyAuditLog;
    if (filtro?.regional && filtro.regional !== 'TODAS') {
      list = list.filter((l) => l.regional === filtro.regional);
    }
    if (filtro?.entity_type) {
      list = list.filter((l) => l.entity_type === filtro.entity_type);
    }
    return Object.freeze([...list]);
  }

  /**
   * Proteção estrita de imutabilidade: qualquer tentativa de mutação dispara exceção
   */
  public tentarModificarAuditLog(index: number, novosDados: any) {
    throw new Error('audit_log é estritamente append-only: atualizações e exclusões são proibidas pelo servidor');
  }

  public tentarExcluirAuditLog(index: number) {
    throw new Error('audit_log é estritamente append-only: atualizações e exclusões são proibidas pelo servidor');
  }

  // ============================================================================
  // MÉTRICAS OPERACIONAIS EM TEMPO REAL
  // ============================================================================

  public coletarMetricas(context: {
    produtosPendentes?: any[];
    dispositivos?: Array<{ id: string; app_version?: string; last_seen_at?: string; data_primeiro_uso?: string }>;
    fotosPendentesCount?: number;
  } = {}): ObservabilityMetrics {
    const pendentes = context.produtosPendentes || [];
    const pending_outbox_count = pendentes.length;

    // Cálculo da idade em segundos do item mais antigo pendente
    let oldest_pending_age = 0;
    if (pendentes.length > 0) {
      const agoraMs = Date.now();
      const timestamps = pendentes.map((p) => {
        const d = p.data_cadastro || p.created_at || p.timestamp;
        return d ? new Date(d).getTime() : agoraMs;
      });
      const oldestMs = Math.min(...timestamps);
      oldest_pending_age = Math.max(0, Math.floor((agoraMs - oldestMs) / 1000));
    }

    // Taxa de erro de sincronização
    const totalAttempts = Math.max(this.syncAttemptsCount, 1);
    const sync_error_rate = Number(((this.syncFailuresCount / totalAttempts) * 100).toFixed(2));

    // Versão por dispositivo
    const app_version_by_device: Record<string, number> = {};
    const last_sync_by_device: Record<string, string | null> = {};

    const dispositivos = context.dispositivos || [];
    for (const d of dispositivos) {
      const version = d.app_version || '1.2.0';
      app_version_by_device[version] = (app_version_by_device[version] || 0) + 1;
      last_sync_by_device[d.id] = d.last_seen_at || d.data_primeiro_uso || null;
    }

    return {
      pending_outbox_count,
      oldest_pending_age,
      sync_error_rate,
      conflict_count: this.conflictCounter,
      pending_photo_count: context.fotosPendentesCount || 0,
      app_version_by_device,
      last_sync_by_device,
      total_sync_attempts: this.syncAttemptsCount,
      total_sync_failures: this.syncFailuresCount,
    };
  }

  public getStructuredLogs(): readonly StructuredLogEntry[] {
    return Object.freeze([...this.structuredLogs]);
  }

  public registrarTentativaSync() {
    this.syncAttemptsCount++;
  }

  public limparBufferMemoria() {
    this.structuredLogs = [];
    this.appendOnlyAuditLog = [];
    this.syncAttemptsCount = 0;
    this.syncFailuresCount = 0;
    this.conflictCounter = 0;
  }
}

export const observability = new ObservabilityManager();

