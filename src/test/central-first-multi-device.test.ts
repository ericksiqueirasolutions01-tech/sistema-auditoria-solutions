import { describe, it, expect, vi, afterAll } from 'vitest';
import { db, normalizeDatabaseDate, formatarDataParaExibicaoBR } from '../db/storage';
import syncHandler from '../../api/central/sync';
import produtosHandler from '../../api/central/produtos';
import referenciaImportHandler from '../../api/central/referencia-import';
import referenciaLookupHandler from '../../api/central/referencia-lookup';
import { createClient } from '@supabase/supabase-js';

const TEST_IMEI = '358999000111222';
const TEST_REGIONAL = 'VIA VAREJO BA';

const SUPABASE_FALLBACK_URL = 'https://chvfzqekkmongsrqbwev.supabase.co';
const SUPABASE_FALLBACK_KEY = 'sb_publishable_F-Lc83bJD87AokRbHPmltg_hp2q6Ghj';
const supabase = createClient(SUPABASE_FALLBACK_URL, SUPABASE_FALLBACK_KEY);

describe('CORREÇÃO 6 — Teste de Integridade: Arquitetura Central-First Multi-Dispositivos', () => {
  afterAll(async () => {
    // Limpeza dos dados de teste no Supabase
    await supabase.from('audit_products').delete().eq('serial', TEST_IMEI);
    await supabase.from('regional_inventory_reference').delete().eq('imei_normalized', TEST_IMEI);
    await supabase.from('inventory_import_batches').delete().eq('file_name', 'teste_e2e_central_first.xlsx');
  });

  it('1. Admin importa uma base e persiste no banco central Supabase', async () => {
    let statusCode = 0;
    let jsonResult: any = null;

    const req = {
      method: 'POST',
      headers: {
        origin: 'https://sistema-auditoria-solutions.vercel.app',
      },
      body: {
        usuario: {
          nome: 'Administrador Master',
          login: 'admin',
          perfil: 'ADMINISTRADOR',
        },
        regional: TEST_REGIONAL,
        fileName: 'teste_e2e_central_first.xlsx',
        itens: [
          {
            imei: TEST_IMEI,
            sku: '5370760',
            model_description: 'MOTO EDGE 70 INTEGRATION TEST',
            brand: 'MOTOROLA',
            dealer: 'SAMSUNG',
            origin_invoice: 'NF-987654',
          },
        ],
      },
    };

    const res = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return { json: (d: any) => { jsonResult = d; return d; } };
      },
    };

    await referenciaImportHandler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonResult.sucesso).toBe(true);
    expect(jsonResult.totalImportados).toBe(1);

    // Conferir gravação no Supabase
    const { data: supaRef } = await supabase
      .from('regional_inventory_reference')
      .select('*')
      .eq('imei_normalized', TEST_IMEI)
      .eq('is_active', true)
      .maybeSingle();

    expect(supaRef).toBeDefined();
    expect(supaRef?.imei_normalized).toBe(TEST_IMEI);
    expect(supaRef?.model_description).toBe('MOTO EDGE 70 INTEGRATION TEST');
  });

  it('2. Outro computador limpo (sem base local) consulta IMEI e encontra no Supabase', async () => {
    // Simula computador 2 chamando /api/central/referencia-lookup
    let statusCode = 0;
    let jsonResult: any = null;

    const req = {
      method: 'GET',
      headers: {
        origin: 'https://sistema-auditoria-solutions.vercel.app',
      },
      query: {
        regional: TEST_REGIONAL,
        imei: TEST_IMEI,
      },
    };

    const res = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return { json: (d: any) => { jsonResult = d; return d; } };
      },
    };

    await referenciaLookupHandler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonResult.sucesso).toBe(true);
    expect(jsonResult.encontrado).toBe(true);
    expect(jsonResult.item).toBeDefined();
    expect(jsonResult.item.imei_normalized).toBe(TEST_IMEI);
    expect(jsonResult.item.model_description).toBe('MOTO EDGE 70 INTEGRATION TEST');
    expect(jsonResult.item.sku).toBe('5370760');
  });

  it('3. Colaborador bipa com data DD/MM/YYYY e envia online para o banco central', async () => {
    // Data informada no padrão brasileiro pelo operador
    const dataOperador = '23/09/2026';
    const dataNormalizada = normalizeDatabaseDate(dataOperador);
    expect(dataNormalizada).toBe('2026-09-23');

    let statusCode = 0;
    let jsonResult: any = null;

    const req = {
      method: 'POST',
      headers: {
        origin: 'https://sistema-auditoria-solutions.vercel.app',
      },
      body: {
        usuario: {
          nome: 'Operador PC 02',
          login: 'operador_pc2',
          perfil: 'OPERADOR',
          regional: TEST_REGIONAL,
        },
        regional: TEST_REGIONAL,
        computador: {
          id: 'PC-BA-002',
          nome: 'Bancada 02',
          regional: TEST_REGIONAL,
        },
        produtos: [
          {
            id: 'local-pc2-item-1',
            serial: TEST_IMEI,
            imei: TEST_IMEI,
            sku: '5370760',
            modelo_produto: 'MOTO EDGE 70 INTEGRATION TEST',
            fabricante: 'MOTOROLA',
            numero_lote: 'LOTE 1',
            numero_caixa: 'Caixa 01',
            produto_lacrado: 'SIM',
            data_auditoria: dataOperador,
            source_type: 'LISTED',
            dealer: 'SAMSUNG',
          },
        ],
      },
    };

    const res = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return { json: (d: any) => { jsonResult = d; return d; } };
      },
    };

    await syncHandler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonResult.sucesso).toBe(true);
    expect(jsonResult.sincronizados).toBe(1);

    // Conferir que no Supabase a coluna DATE foi salva exatamente como 2026-09-23
    const { data: supaProd } = await supabase
      .from('audit_products')
      .select('serial, modelo, data_auditoria, status_sincronizacao, regional_id')
      .eq('serial', TEST_IMEI)
      .maybeSingle();

    expect(supaProd).toBeDefined();
    expect(supaProd?.serial).toBe(TEST_IMEI);
    expect(supaProd?.data_auditoria).toBe('2026-09-23');
    expect(supaProd?.status_sincronizacao).toBe('ENVIADO');
  });

  it('4. Painel Admin consulta banco central e enxerga produto enviado pelo colaborador', async () => {
    let statusCode = 0;
    let jsonResult: any = null;

    const req = {
      method: 'GET',
      headers: {
        origin: 'https://sistema-auditoria-solutions.vercel.app',
        'x-user-perfil': 'ADMINISTRADOR',
        'x-user-regional': 'TODAS',
      },
      query: {
        perfil: 'ADMINISTRADOR',
        regional: 'TODAS',
      },
    };

    const res = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return { json: (d: any) => { jsonResult = d; return d; } };
      },
    };

    await produtosHandler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonResult.sucesso).toBe(true);
    expect(jsonResult.origem).toBe('SUPABASE_POSTGRES');
    expect(Array.isArray(jsonResult.produtos)).toBe(true);

    const prodEncontrado = jsonResult.produtos.find((p: any) => p.serial === TEST_IMEI);
    expect(prodEncontrado).toBeDefined();
    expect(prodEncontrado.serial).toBe(TEST_IMEI);
    expect(prodEncontrado.modelo_produto).toBe('MOTO EDGE 70 INTEGRATION TEST');
    expect(prodEncontrado.data_auditoria).toBe('23/09/2026'); // Formatado para exibição brasileira
    expect(prodEncontrado.status_sincronizacao).toBe('ENVIADO');
  });
});
