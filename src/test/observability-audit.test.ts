import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  observability,
  sanitizarParaLog,
  type StructuredLogEntry,
  type AuditLogEntry,
  type ObservabilityMetrics,
} from '../services/observability';
import metricsHandler from '../../api/central/metrics';

describe('GATE 15: Observabilidade, Métricas Operacionais e Trilha de Auditoria Append-Only', () => {
  beforeEach(() => {
    observability.limparBufferMemoria();
  });

  // ============================================================================
  // 1. LOGS ESTRUTURADOS E SANITIZAÇÃO DE SEGREDOS
  // ============================================================================
  describe('1. Logs Estruturados sem Vazamento de Dados Sensíveis (Seção 19.1)', () => {
    it('deve sanitizar senhas, segredos e tokens de qualquer objeto antes de logar', () => {
      const objetoSensivel = {
        usuario: 'operador_rj',
        senha: 'super-secret-password-123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token',
        detalhes: {
          secret: 'service-key-xyz',
          chaveNormal: '12345',
        },
      };

      const sanitizado = sanitizarParaLog(objetoSensivel);
      expect(sanitizado.usuario).toBe('operador_rj');
      expect(sanitizado.senha).toBe('[REDACTED_BY_SECURITY_POLICY]');
      expect(sanitizado.token).toBe('[REDACTED_BY_SECURITY_POLICY]');
      expect(sanitizado.detalhes.secret).toBe('[REDACTED_BY_SECURITY_POLICY]');
      expect(sanitizado.detalhes.chaveNormal).toBe('12345');
    });

    it('deve emitir logs estruturados com todos os 9 eventos obrigatórios', () => {
      // 1. auth failure
      const logAuth = observability.logAuthFailure('operador_teste', 'PC-01', 'Credenciais inválidas');
      expect(logAuth.event_type).toBe('AUTH_FAILURE');
      expect(logAuth.level).toBe('WARN');

      // 2. sync failure
      const logSyncFail = observability.logSyncFailure('PC-01', 'VIA VAREJO RJ', 'Connection timed out');
      expect(logSyncFail.event_type).toBe('SYNC_FAILURE');
      expect(logSyncFail.level).toBe('ERROR');

      // 3. sync conflict
      const logConflict = observability.logSyncConflict('357847400012345', 'PC-02', 'VIA VAREJO SP', {
        serial: '357847400012345',
        cadastrado_por: 'Estação RJ',
      });
      expect(logConflict.event_type).toBe('SYNC_CONFLICT');

      // 4. lot finalize / reopen
      const logLotFinalize = observability.logLotFinalize('01', 'VIA VAREJO RJ', 'Carlos Supervisor', 40);
      expect(logLotFinalize.event_type).toBe('LOT_FINALIZE');

      const logLotReopen = observability.logLotReopen('01', 'VIA VAREJO RJ', 'Carlos Supervisor', 'Ajuste de caixa 02');
      expect(logLotReopen.event_type).toBe('LOT_REOPEN');

      // 5. admin mutation
      const logMutation = observability.logAdminMutation(
        'admin_master',
        'ATUALIZAR_REGIONAL',
        'PRODUTO',
        'SRV-999',
        { regional: 'RJ' },
        { regional: 'SP' },
        'Correção de despacho físico'
      );
      expect(logMutation.event_type).toBe('ADMIN_MUTATION');

      // 6. photo upload failure
      const logPhotoFail = observability.logPhotoUploadFailure('FOTO-001', 'Storage quota exceeded');
      expect(logPhotoFail.event_type).toBe('PHOTO_UPLOAD_FAILURE');

      // 7. DB failure
      const logDbFail = observability.logDbFailure('INSERT INTO audit_products', 'Constraint violation');
      expect(logDbFail.event_type).toBe('DB_FAILURE');

      // 8. backup/restore
      const logBackup = observability.logBackupRestore('BACKUP', 'SUCCESS', 'sha256-abc12345', 'admin_master');
      expect(logBackup.event_type).toBe('BACKUP_RESTORE');

      // 9. app update
      const logUpdate = observability.logAppUpdate('1.1.0', '1.2.0', 'PC-RJ-01', 'SUCCESS');
      expect(logUpdate.event_type).toBe('APP_UPDATE');

      // Total de logs gerados no buffer estruturado
      const logs = observability.getStructuredLogs();
      expect(logs.length).toBe(10);
    });
  });

  // ============================================================================
  // 2. MÉTRICAS OPERACIONAIS
  // ============================================================================
  describe('2. Métricas Operacionais em Tempo Real (Seção 19.2)', () => {
    it('deve calcular corretamente todas as 7 métricas operacionais requeridas', () => {
      // Simular tentativas e erros de sincronização
      observability.registrarTentativaSync();
      observability.registrarTentativaSync();
      observability.logSyncFailure('PC-01', 'VIA VAREJO RJ', 'Falha de conexão');
      observability.logSyncConflict('357847400012345', 'PC-02', 'VIA VAREJO SP', {});

      // Simular produtos pendentes
      const trintaSegundosAtras = new Date(Date.now() - 30000).toISOString();
      const produtosPendentes = [
        { id: 1, serial: '357847400011111', data_cadastro: trintaSegundosAtras },
        { id: 2, serial: '357847400022222', data_cadastro: new Date().toISOString() },
      ];

      // Simular dispositivos registrados
      const dispositivos = [
        { id: 'PC-RJ-01', app_version: '1.2.0', last_seen_at: '2026-09-17T08:00:00Z' },
        { id: 'PC-RJ-02', app_version: '1.2.0', last_seen_at: '2026-09-17T08:15:00Z' },
        { id: 'PC-SP-01', app_version: '1.1.9', last_seen_at: '2026-09-16T18:00:00Z' },
      ];

      const metricas: ObservabilityMetrics = observability.coletarMetricas({
        produtosPendentes,
        dispositivos,
        fotosPendentesCount: 4,
      });

      // 1. pending_outbox_count
      expect(metricas.pending_outbox_count).toBe(2);

      // 2. oldest_pending_age (deve ser ~30 segundos)
      expect(metricas.oldest_pending_age).toBeGreaterThanOrEqual(29);

      // 3. sync_error_rate
      expect(metricas.sync_error_rate).toBeGreaterThan(0);

      // 4. conflict_count
      expect(metricas.conflict_count).toBe(1);

      // 5. pending_photo_count
      expect(metricas.pending_photo_count).toBe(4);

      // 6. app_version_by_device
      expect(metricas.app_version_by_device['1.2.0']).toBe(2);
      expect(metricas.app_version_by_device['1.1.9']).toBe(1);

      // 7. last_sync_by_device
      expect(metricas.last_sync_by_device['PC-RJ-01']).toBe('2026-09-17T08:00:00Z');
      expect(metricas.last_sync_by_device['PC-SP-01']).toBe('2026-09-16T18:00:00Z');
    });
  });

  // ============================================================================
  // 3. AUDIT LOG APPEND-ONLY NO SERVIDOR
  // ============================================================================
  describe('3. Trilha de Auditoria Append-Only no Servidor (Seção 19.3)', () => {
    it('deve registrar cada evento de auditoria com os 12 campos obrigatórios', () => {
      const entry = observability.gravarAuditLog({
        actor_user_id: 'usr-admin-01',
        device_id: 'DEV-001',
        action: 'UPDATE_IMEI_CORRECTION',
        entity_type: 'AUDIT_PRODUCT',
        entity_id: 'PROD-1029',
        before: { serial: '357847400012340', modelo: 'Galaxy S24' },
        after: { serial: '357847400012345', modelo: 'Galaxy S24' },
        reason: 'Correção de dígito verificador solicitada pela auditoria central',
        request_id: 'req-corr-999',
        regional: 'VIA VAREJO RJ',
      });

      // Validação dos 12 campos exatos do Gate 15
      expect(entry.event_id).toBeDefined();
      expect(entry.actor_user_id).toBe('usr-admin-01');
      expect(entry.device_id).toBe('DEV-001');
      expect(entry.action).toBe('UPDATE_IMEI_CORRECTION');
      expect(entry.entity_type).toBe('AUDIT_PRODUCT');
      expect(entry.entity_id).toBe('PROD-1029');
      expect(entry.before).toEqual({ serial: '357847400012340', modelo: 'Galaxy S24' });
      expect(entry.after).toEqual({ serial: '357847400012345', modelo: 'Galaxy S24' });
      expect(entry.reason).toBe('Correção de dígito verificador solicitada pela auditoria central');
      expect(entry.server_timestamp).toBeDefined();
      expect(entry.request_id).toBe('req-corr-999');
      expect(entry.regional).toBe('VIA VAREJO RJ');
    });

    it('deve impedir qualquer mutação ou exclusão nos registros (garantia append-only)', () => {
      observability.gravarAuditLog({
        actor_user_id: 'usr-01',
        device_id: 'DEV-01',
        action: 'INSERT',
        entity_type: 'LOT',
        entity_id: 'LOT-01',
        before: null,
        after: { numero: '01' },
        reason: 'Abertura de lote',
        request_id: 'req-1',
        regional: 'VIA VAREJO SP',
      });

      // Tentativa de mutação deve falhar e disparar erro
      expect(() => {
        observability.tentarModificarAuditLog(0, { action: 'MODIFICADO_ILEGALMENTE' });
      }).toThrow(/estritamente append-only/i);

      // Tentativa de exclusão deve falhar e disparar erro
      expect(() => {
        observability.tentarExcluirAuditLog(0);
      }).toThrow(/estritamente append-only/i);

      const logs = observability.listarAuditLogs();
      expect(logs.length).toBe(1);
    });

    it('deve conter no esquema oficial do PostgreSQL a tabela audit_log com as 12 colunas e trigger append-only', () => {
      const schemaPath = path.resolve(process.cwd(), 'src/db/schema-central-postgres.sql');
      const sql = fs.readFileSync(schemaPath, 'utf8');

      // Tabela e colunas obrigatórias
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS audit_log/i);
      expect(sql).toMatch(/event_id\s+UUID/i);
      expect(sql).toMatch(/actor_user_id\s+VARCHAR/i);
      expect(sql).toMatch(/device_id\s+VARCHAR/i);
      expect(sql).toMatch(/action\s+VARCHAR/i);
      expect(sql).toMatch(/entity_type\s+VARCHAR/i);
      expect(sql).toMatch(/entity_id\s+VARCHAR/i);
      expect(sql).toMatch(/before\s+JSONB/i);
      expect(sql).toMatch(/after\s+JSONB/i);
      expect(sql).toMatch(/reason\s+TEXT/i);
      expect(sql).toMatch(/server_timestamp\s+TIMESTAMPTZ/i);
      expect(sql).toMatch(/request_id\s+VARCHAR/i);
      expect(sql).toMatch(/regional\s+VARCHAR/i);

      // Trigger append-only
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION prevent_audit_log_modification\(\)/i);
      expect(sql).toMatch(/CREATE TRIGGER trg_audit_log_append_only/i);
      expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON audit_log/i);
    });
  });

  // ============================================================================
  // 4. ENDPOINT CENTRAL DE MÉTRICAS (/api/central/metrics)
  // ============================================================================
  describe('4. Endpoint Central de Métricas (/api/central/metrics)', () => {
    it('deve responder com status 200 e fornecer estrutura consolidada de métricas', async () => {
      const req: any = {
        method: 'GET',
        headers: {
          authorization: 'Bearer token-admin-test',
        },
      };

      let responseBody = '';
      const res: any = {
        statusCode: 0,
        setHeader: () => {},
        end: (data: string) => {
          responseBody = data;
        },
      };

      metricsHandler(req, res);

      expect(res.statusCode).toBe(200);
      const parsed = JSON.parse(responseBody);
      expect(parsed.status).toBe('OK');
      expect(parsed.metrics).toBeDefined();
      expect(parsed.metrics.pending_outbox_count).toBeDefined();
      expect(parsed.metrics.oldest_pending_age).toBeDefined();
      expect(parsed.metrics.sync_error_rate).toBeDefined();
      expect(parsed.metrics.conflict_count).toBeDefined();
    });
  });
});

