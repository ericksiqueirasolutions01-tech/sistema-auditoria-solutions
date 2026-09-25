import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizarDataParaPostgresDate, formatarDataParaExibicaoBR } from '../db/storage';
import syncHandler from '../../api/central/sync';

describe('Data Normalization for Central Sync & PostgreSQL', () => {
  it('should normalize Brazilian DD/MM/YYYY dates to PostgreSQL YYYY-MM-DD format', () => {
    expect(normalizarDataParaPostgresDate('23/09/2026')).toBe('2026-09-23');
    expect(normalizarDataParaPostgresDate('01/01/2026')).toBe('2026-01-01');
    expect(normalizarDataParaPostgresDate('5/9/2026')).toBe('2026-09-05');
  });

  it('should preserve and normalize ISO YYYY-MM-DD dates', () => {
    expect(normalizarDataParaPostgresDate('2026-09-23')).toBe('2026-09-23');
    expect(normalizarDataParaPostgresDate('2026-03-15T12:00:00.000Z')).toBe('2026-03-15');
  });

  it('should format ISO dates back to Brazilian display DD/MM/YYYY', () => {
    expect(formatarDataParaExibicaoBR('2026-09-23')).toBe('23/09/2026');
    expect(formatarDataParaExibicaoBR('2026-01-05')).toBe('05/01/2026');
    expect(formatarDataParaExibicaoBR('23/09/2026')).toBe('23/09/2026');
  });

  it('should handle sync API payload with Brazilian dates without throwing or rejecting', async () => {
    let statusCode = 0;
    let jsonResult: any = null;

    const req = {
      method: 'POST',
      headers: {
        origin: 'https://sistema-auditoria-solutions.vercel.app',
      },
      body: {
        usuario: {
          nome: 'Operador Teste',
          login: 'op_teste',
          perfil: 'OPERADOR',
          regional: 'VIA VAREJO BA',
        },
        regional: 'VIA VAREJO BA',
        computador: {
          id: 'PC-BA-001',
          nome: 'Estacao BA',
          regional: 'VIA VAREJO BA',
        },
        produtos: [
          {
            id: 'local-test-date-1',
            serial: '999988887777661',
            imei: '999988887777661',
            sku: '5370760',
            modelo_produto: 'TEST MODEL',
            fabricante: 'MOTOROLA',
            numero_lote: 'LOTE 1',
            numero_caixa: 'Caixa 01',
            produto_lacrado: 'SIM',
            data_auditoria: '24/09/2026',
            source_type: 'OUT_OF_LIST',
          },
        ],
      },
    };

    const res = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonResult = data;
            return data;
          },
        };
      },
    };

    await syncHandler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonResult.sucesso).toBe(true);
    expect(jsonResult.sincronizados).toBe(1);
  });
});

