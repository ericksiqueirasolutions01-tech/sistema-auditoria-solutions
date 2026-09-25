import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import produtosHandler from '../../api/central/produtos';
import syncHandler from '../../api/central/sync';

describe('GATE 4: Banco Central Transacional (PostgreSQL + RLS)', () => {
  const schemaPath = path.resolve(process.cwd(), 'src/db/schema-central-postgres.sql');

  describe('1. Verificação Estática de DDL e Constraints do PostgreSQL', () => {
    it('deve existir o arquivo de esquema oficial do PostgreSQL com todas as tabelas requeridas', () => {
      expect(fs.existsSync(schemaPath)).toBe(true);
      const sql = fs.readFileSync(schemaPath, 'utf-8');

      // 9 tabelas obrigatórias
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS regions/i);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS profiles/i);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS devices/i);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS lots/i);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS audit_products/i);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS lot_photos/i);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS sync_events/i);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS audit_log/i);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS app_releases/i);
    });

    it('deve utilizar Chaves Primárias UUID e extensões criptográficas', () => {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/i);
      expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS "pgcrypto"/i);
      expect(sql).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/i);
    });

    it('deve possuir constraints de integridade referencial (FK), checagens de status e unicidade de serial/IMEI', () => {
      const sql = fs.readFileSync(schemaPath, 'utf-8');

      // FKs
      expect(sql).toMatch(/REFERENCES regions\(id\)/i);
      expect(sql).toMatch(/REFERENCES devices\(id\)/i);

      // CHECKs de status
      expect(sql).toMatch(/CHECK \(status IN \('ATIVO', 'PENDENTE', 'REVOGADO'\)\)/i);
      expect(sql).toMatch(/CHECK \(status IN \('ABERTO', 'FINALIZADO'\)\)/i);
      expect(sql).toMatch(/CHECK \(perfil IN \('SUPER_ADMIN', 'ADMINISTRADOR', 'SUPERVISOR_REGIONAL', 'OPERADOR'\)\)/i);

      // Unicidade de serial por regional
      expect(sql).toMatch(/uq_audit_products_serial_regional UNIQUE \(serial, regional_id\)/i);
    });

    it('deve habilitar Row Level Security (RLS) e políticas de acesso por perfil e regional', () => {
      const sql = fs.readFileSync(schemaPath, 'utf-8');

      // Habilitação do RLS
      expect(sql).toMatch(/ALTER TABLE regions ENABLE ROW LEVEL SECURITY;/i);
      expect(sql).toMatch(/ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;/i);
      expect(sql).toMatch(/ALTER TABLE devices ENABLE ROW LEVEL SECURITY;/i);
      expect(sql).toMatch(/ALTER TABLE lots ENABLE ROW LEVEL SECURITY;/i);
      expect(sql).toMatch(/ALTER TABLE audit_products ENABLE ROW LEVEL SECURITY;/i);

      // Políticas RLS para escopo de operador e supervisor
      expect(sql).toMatch(/CREATE POLICY "audit_products_select_scoped"/i);
      expect(sql).toMatch(/CREATE POLICY "audit_products_insert_scoped"/i);
      expect(sql).toMatch(/CREATE POLICY "lots_select_scoped"/i);
      expect(sql).toMatch(/CREATE POLICY "devices_admin_only"/i);
    });
  });

  describe('2. Endpoint Central de Produtos: Autenticação e RLS Server-Side', () => {
    it('deve rejeitar requisição anônima sem credenciais no endpoint de produtos (HTTP 401)', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const mockReq = {
        method: 'GET',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        query: {},
      };

      const mockRes = {
        setHeader: () => mockRes,
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
            end: () => {},
          };
        },
      };

      await produtosHandler(mockReq, mockRes);
      expect(statusCode).toBe(401);
      expect(responseBody?.sucesso).toBe(false);
      expect(responseBody?.erro).toMatch(/Não autorizado/i);
    });

    it('deve permitir consulta com credencial autenticada e filtrar pelo escopo regional do usuário', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const mockReq = {
        method: 'GET',
        headers: {
          origin: 'https://sistema-auditoria-solutions.vercel.app',
          authorization: 'Bearer token_teste_operador',
          'x-user-perfil': 'OPERADOR',
          'x-user-regional': 'VIA VAREJO SP',
        },
        query: {},
      };

      const mockRes = {
        setHeader: () => mockRes,
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
            end: () => {},
          };
        },
      };

      await produtosHandler(mockReq, mockRes);
      expect(statusCode).toBe(200);
      expect(responseBody?.sucesso).toBe(true);
      expect(Array.isArray(responseBody?.produtos)).toBe(true);

      // Todos os produtos retornados devem respeitar o escopo regional
      if (responseBody.produtos.length > 0) {
        for (const p of responseBody.produtos) {
          expect(p.regional.toUpperCase()).toBe('VIA VAREJO SP');
        }
      }
    });
  });

  describe('3. Endpoint Central de Sync: Integridade e Tratamento Real de Fotos', () => {
    it('não deve substituir fotos reais por placeholders SVG falsos (Regra 12)', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const mockReq = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'operador_rj', nome: 'Operador Rio', perfil: 'OPERADOR', regional: 'VIA VAREJO RJ' },
          computador: { id: 'PC-RJ-01', nome: 'Bancada 01', status: 'ATIVO' },
          produtos: [],
          fotos: [
            {
              id: 'FOTO-TESTE-REAL-001',
              fotoDataUri: 'data:image/jpeg;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
              rotulo: 'Foto Frente Caixa',
            },
          ],
        },
      };

      const mockRes = {
        setHeader: () => mockRes,
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      };

      await syncHandler(mockReq, mockRes);
      expect(statusCode).toBe(200);
      expect(responseBody?.sucesso).toBe(true);

      const fotoSalva = responseBody.fotosCentral?.find((f: any) => f.id === 'FOTO-TESTE-REAL-001');
      expect(fotoSalva).toBeDefined();
      expect(fotoSalva.fotoDataUri).not.toMatch(/<svg/i); // Jamais deve ser convertido em SVG falso
    });

    it('deve identificar duplicidades de IMEI e registrar detalhes sem sobrescrever a base', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const itemUnico = `IMEI-GATE4-${Date.now()}`;

      // Primeiro envio: sucesso
      const req1 = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'operador_rj', nome: 'Operador Rio', perfil: 'OPERADOR', regional: 'VIA VAREJO RJ' },
          computador: { id: 'PC-RJ-01', nome: 'Bancada 01', status: 'ATIVO' },
          produtos: [{ imei: itemUnico, serial: itemUnico, numero_lote: 'L1', regional: 'VIA VAREJO RJ' }],
        },
      };

      const res1 = {
        setHeader: () => res1,
        status: (code: number) => ({ json: (data: any) => {} }),
      };
      await syncHandler(req1, res1);

      // Segundo envio com o MESMO IMEI: deve detectar duplicidade no servidor
      const req2 = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'operador_rj', nome: 'Operador Rio', perfil: 'OPERADOR', regional: 'VIA VAREJO RJ' },
          computador: { id: 'PC-RJ-01', nome: 'Bancada 01', status: 'ATIVO' },
          produtos: [{ imei: itemUnico, serial: itemUnico, numero_lote: 'L1', regional: 'VIA VAREJO RJ' }],
        },
      };

      const res2 = {
        setHeader: () => res2,
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      };

      await syncHandler(req2, res2);
      expect(statusCode).toBe(200);
      expect(responseBody.duplicadosEvitados).toBe(1);
      expect(responseBody.itensDuplicados.length).toBe(1);
      expect(responseBody.itensDuplicados[0].status).toBe('DUPLICADO NO SERVIDOR');
    });

    afterAll(() => {
      const dataDir = path.resolve(process.cwd(), 'data', 'test_data');
      try {
        if (fs.existsSync(dataDir)) {
          fs.rmSync(dataDir, { recursive: true, force: true });
        }
      } catch {}
    });
  });
});

