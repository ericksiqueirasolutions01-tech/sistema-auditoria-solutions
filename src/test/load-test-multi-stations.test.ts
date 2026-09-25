import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest';
import syncHandler from '../../api/central/sync';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_FALLBACK_URL = 'https://chvfzqekkmongsrqbwev.supabase.co';
const SUPABASE_FALLBACK_KEY = 'sb_publishable_F-Lc83bJD87AokRbHPmltg_hp2q6Ghj';
const supabase = createClient(SUPABASE_FALLBACK_URL, SUPABASE_FALLBACK_KEY);

const TOTAL_STATIONS = 10;
const PRODUCTS_PER_STATION = 100;
const TOTAL_EXPECTED = TOTAL_STATIONS * PRODUCTS_PER_STATION; // 1.000 produtos

const LOAD_TEST_REGIONAL = 'VIA VAREJO BA';
const LOAD_TEST_DATE = '24/09/2026';

// Gerar seriais únicos para o teste de carga
function gerarImeiCarga(stationIdx: number, itemIdx: number): string {
  // Ex: 3591 + 2 digitos estacao + 4 digitos item + zeros = 15 digitos
  const stStr = String(stationIdx + 1).padStart(2, '0');
  const itStr = String(itemIdx + 1).padStart(4, '0');
  return `3591${stStr}00000${itStr}`;
}

const todosImeisGerados: string[] = [];
for (let s = 0; s < TOTAL_STATIONS; s++) {
  for (let p = 0; p < PRODUCTS_PER_STATION; p++) {
    todosImeisGerados.push(gerarImeiCarga(s, p));
  }
}

describe('Item 6: Teste de Carga de Alta Concorrência (10 Computadores x 100 Auditorias = 1.000 Itens)', () => {
  beforeAll(async () => {
    process.env.FORCE_TEST_SERVER_SYNC = 'true';
    // Limpar quaisquer resíduos anteriores
    await supabase.from('audit_products').delete().gte('serial', '359100000000000').lte('serial', '359199999999999');
  }, 30000);

  afterAll(async () => {
    // Limpeza após o teste
    await supabase.from('audit_products').delete().gte('serial', '359100000000000').lte('serial', '359199999999999');
    delete process.env.FORCE_TEST_SERVER_SYNC;
  }, 30000);

  it('deve processar 10 computadores enviando 100 produtos simultaneamente sem perda nem conflito', async () => {
    // Preparar os 10 pacotes concorrentes
    const promessasEnvio = Array.from({ length: TOTAL_STATIONS }, (_, sIdx) => {
      const stationId = `PC-LOAD-${String(sIdx + 1).padStart(2, '0')}`;
      const operadorNome = `Operador Concorrente ${sIdx + 1}`;
      
      const prodsDaEstacao = Array.from({ length: PRODUCTS_PER_STATION }, (_, pIdx) => {
        const imei = gerarImeiCarga(sIdx, pIdx);
        const isSamsung = pIdx % 2 === 0;
        return {
          id: `load-prod-${stationId}-${pIdx}`,
          serial: imei,
          imei,
          sku: isSamsung ? '5370761' : '5370760',
          modelo_produto: isSamsung ? 'GALAXY S24 ULTRA 512GB' : 'MOTO EDGE 50 ULTRA 512GB',
          fabricante: isSamsung ? 'SAMSUNG' : 'MOTOROLA',
          brand: isSamsung ? 'SAMSUNG' : 'MOTOROLA',
          numero_lote: `LOTE LOAD ${stationId}`,
          numero_caixa: `Caixa ${String(Math.floor(pIdx / 10) + 1).padStart(2, '0')}`,
          produto_lacrado: 'SIM',
          data_auditoria: LOAD_TEST_DATE,
          source_type: 'LISTED',
          dealer: isSamsung ? 'SAMSUNG' : 'OUTRA MARCA',
        };
      });

      const req = {
        method: 'POST',
        headers: {
          origin: 'https://sistema-auditoria-solutions.vercel.app',
        },
        body: {
          usuario: {
            nome: operadorNome,
            login: `op_load_${sIdx + 1}`,
            perfil: 'OPERADOR',
            regional: LOAD_TEST_REGIONAL,
          },
          regional: LOAD_TEST_REGIONAL,
          computador: {
            id: stationId,
            nome: `Bancada ${stationId}`,
            regional: LOAD_TEST_REGIONAL,
          },
          produtos: prodsDaEstacao,
        },
      };

      let statusCode = 0;
      let jsonResult: any = null;

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

      return syncHandler(req, res).then(() => ({
        stationId,
        statusCode,
        jsonResult,
      }));
    });

    // Disparar os 10 envios SIMULTANEAMENTE via Promise.all
    const inicio = Date.now();
    const resultados = await Promise.all(promessasEnvio);
    const duracaoTotal = Date.now() - inicio;

    console.log(`[Teste de Carga] 10 estações simultâneas concluídas em ${duracaoTotal}ms.`);

    // 1. Validar que todas as 10 requisições retornaram HTTP 200 e sucesso
    for (const r of resultados) {
      expect(r.statusCode).toBe(200);
      expect(r.jsonResult.sucesso).toBe(true);
      expect(r.jsonResult.sincronizados).toBe(PRODUCTS_PER_STATION);
      expect(r.jsonResult.duplicadosEvitados).toBe(0);
    }

    // 2. Validar que o Supabase recebeu EXATAMENTE 1.000 produtos
    const { count, error } = await supabase
      .from('audit_products')
      .select('*', { count: 'exact', head: true })
      .gte('serial', '359100000000000')
      .lte('serial', '359199999999999');

    expect(error).toBeNull();
    expect(count).toBe(TOTAL_EXPECTED);
  }, 60000);

  it('deve reenviar as 10 estações simultâneas e rejeitar 100% das duplicatas com 0 inserções adicionais', async () => {
    // Reenviar exatamente os mesmos pacotes
    const promessasReenvio = Array.from({ length: TOTAL_STATIONS }, (_, sIdx) => {
      const stationId = `PC-LOAD-${String(sIdx + 1).padStart(2, '0')}`;
      const operadorNome = `Operador Concorrente ${sIdx + 1}`;
      
      const prodsDaEstacao = Array.from({ length: PRODUCTS_PER_STATION }, (_, pIdx) => {
        const imei = gerarImeiCarga(sIdx, pIdx);
        return {
          id: `load-prod-dup-${stationId}-${pIdx}`,
          serial: imei,
          imei,
          data_auditoria: LOAD_TEST_DATE,
        };
      });

      const req = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { nome: operadorNome, perfil: 'OPERADOR', regional: LOAD_TEST_REGIONAL },
          regional: LOAD_TEST_REGIONAL,
          computador: { id: stationId, regional: LOAD_TEST_REGIONAL },
          produtos: prodsDaEstacao,
        },
      };

      let statusCode = 0;
      let jsonResult: any = null;

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

      return syncHandler(req, res).then(() => ({
        stationId,
        statusCode,
        jsonResult,
      }));
    });

    const resultadosReenvio = await Promise.all(promessasReenvio);

    for (const r of resultadosReenvio) {
      expect(r.statusCode).toBe(200);
      expect(r.jsonResult.sucesso).toBe(true);
      expect(r.jsonResult.sincronizados).toBe(0);
      expect(r.jsonResult.duplicadosEvitados).toBe(PRODUCTS_PER_STATION);
    }

    // Conferir que o banco ainda tem exatamente 1.000 produtos (sem duplicidade)
    const { count } = await supabase
      .from('audit_products')
      .select('*', { count: 'exact', head: true })
      .gte('serial', '359100000000000')
      .lte('serial', '359199999999999');

    expect(count).toBe(TOTAL_EXPECTED);
  }, 60000);
});
