import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { db } from '../db/storage';
import handlerExcluirDuplicados from '../../api/central/excluir-duplicados';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://chvfzqekkmongsrqbwev.supabase.co';
const SUPABASE_KEY = 'sb_publishable_F-Lc83bJD87AokRbHPmltg_hp2q6Ghj';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getTestDataPaths() {
  const dataDir = path.resolve(process.cwd(), 'data', 'test_data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return {
    dbFile: path.join(dataDir, 'central_database.json'),
    tentFile: path.join(dataDir, 'central_tentativas_duplicadas.json'),
  };
}

describe('EXCLUSÃO DE PRODUTOS COM IMEI DUPLICADO NO SERVIDOR CENTRAL', () => {
  const { dbFile, tentFile } = getTestDataPaths();

  beforeEach(() => {
    db.limparTudoMemoria();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('1. Endpoint excluir-duplicados identifica e remove produtos com IMEI duplicado do banco local de fallback', async () => {
    // Configura base local de teste com 4 produtos, sendo 2 com IMEI duplicado
    const produtosTeste = [
      { id: 'p1', imei: '358900112233441', serial: '358900112233441', modelo: 'Galaxy S24', numero_caixa: 'Caixa 01' },
      { id: 'p2', imei: '358900112233442', serial: '358900112233442', modelo: 'Galaxy A55', numero_caixa: 'Caixa 01' },
      { id: 'p3-dup', imei: '358900112233441', serial: '358900112233441', modelo: 'Galaxy S24', numero_caixa: 'Caixa 02' }, // Duplicado de p1
      { id: 'p4', imei: '358900112233443', serial: '358900112233443', modelo: 'Galaxy Z Flip', numero_caixa: 'Caixa 03' },
    ];

    fs.writeFileSync(
      dbFile,
      JSON.stringify({
        produtos: produtosTeste,
        ultimaAtualizacao: new Date().toISOString(),
      }),
      'utf-8'
    );

    fs.writeFileSync(
      tentFile,
      JSON.stringify([{ id: 1, imei: '358900112233441', resultado: 'DUPLICADO' }]),
      'utf-8'
    );

    let statusCode = 0;
    let responseData: any = null;

    const mockReq = {
      method: 'POST',
      headers: { origin: 'http://localhost:5173' },
      body: { solicitante: 'Admin Test' },
    };

    const mockRes = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: any) => {
        responseData = data;
        return mockRes;
      },
      end: vi.fn(),
    };

    await handlerExcluirDuplicados(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(responseData).not.toBeNull();
    expect(responseData.sucesso).toBe(true);
    expect(responseData.removidos).toBe(1);

    // Verifica que central_database.json agora possui estritamente 3 produtos únicos
    const contentAtualizado = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    expect(contentAtualizado.produtos.length).toBe(3);
    const imeis = contentAtualizado.produtos.map((p: any) => p.imei);
    expect(imeis).toContain('358900112233441');
    expect(imeis).toContain('358900112233442');
    expect(imeis).toContain('358900112233443');

    // Logs de tentativas duplicadas foram zerados
    const tentAtualizado = JSON.parse(fs.readFileSync(tentFile, 'utf-8'));
    expect(tentAtualizado).toEqual([]);
  });

  it('2. Endpoint retorna zero remoções quando a base não contém IMEIs duplicados', async () => {
    const produtosSemDuplicados = [
      { id: 'u1', imei: 'IMEI-UNICO-01', serial: 'IMEI-UNICO-01' },
      { id: 'u2', imei: 'IMEI-UNICO-02', serial: 'IMEI-UNICO-02' },
    ];

    fs.writeFileSync(
      dbFile,
      JSON.stringify({
        produtos: produtosSemDuplicados,
        ultimaAtualizacao: new Date().toISOString(),
      }),
      'utf-8'
    );

    let statusCode = 0;
    let responseData: any = null;

    const mockReq = {
      method: 'GET',
      headers: {},
    };

    const mockRes = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: any) => {
        responseData = data;
        return mockRes;
      },
      end: vi.fn(),
    };

    await handlerExcluirDuplicados(mockReq, mockRes);

    expect(statusCode).toBe(200);
    expect(responseData.sucesso).toBe(true);
    expect(responseData.removidos).toBe(0);
    expect(responseData.mensagem).toContain('Nenhum produto com IMEI duplicado encontrado');
  });

  it('3. db.excluirProdutosImeiDuplicadoServidor() limpa registros locais com status ERRO_DUPLICADO e tentativas locais', async () => {
    // Insere produtos locais, incluindo um bloqueado por ERRO_DUPLICADO
    db.inserirProduto({
      modelo_produto: 'Galaxy S24 Ultra',
      serial: '358900112233999',
      imei: '358900112233999',
      numero_caixa: 'Caixa 01',
      regional: 'VIA VAREJO BA',
      produto_lacrado: 'SIM',
    });

    const produtoDupLocal = {
      id: 99999,
      modelo_produto: 'Galaxy A54',
      serial: '358900112233888',
      imei: '358900112233888',
      numero_caixa: 'Caixa 01',
      regional: 'VIA VAREJO BA',
      produto_lacrado: 'SIM' as const,
      data_auditoria: '24/09/2026',
      data_cadastro: '2026-09-24T12:00:00Z',
      status_sincronizacao: 'ERRO_DUPLICADO' as const,
      sync_status: 'ERRO' as const,
      created_at: '2026-09-24T12:00:00Z',
    };
    (db as any).produtos.push(produtoDupLocal);
    (db as any).serialMap.set('358900112233888', produtoDupLocal);

    db.registrarTentativaEnvioDuplicado({
      data_hora: '24/09/2026 12:00',
      usuario: 'Operador Teste',
      imei: '358900112233888',
      computador: 'PC-TEST',
      resultado: 'DUPLICADO',
    });

    expect(db.listarTentativasDuplicadas().length).toBeGreaterThan(0);
    expect(db.listarProdutos({}).some((p) => p.status_sincronizacao === 'ERRO_DUPLICADO')).toBe(true);

    // Mock fetch para simular resposta do servidor
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sucesso: true,
        mensagem: 'Expurgo concluído: 1 produto(s) com IMEI duplicado excluído(s) do servidor central.',
        removidos: 1,
        totalRestante: 64,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await db.excluirProdutosImeiDuplicadoServidor();

    expect(resultado.sucesso).toBe(true);
    expect(resultado.removidos).toBeGreaterThanOrEqual(1);

    // Produto com ERRO_DUPLICADO removido localmente
    expect(db.listarProdutos({}).some((p) => p.status_sincronizacao === 'ERRO_DUPLICADO')).toBe(false);

    // Tentativas duplicadas locais zeradas
    expect(db.listarTentativasDuplicadas().length).toBe(0);
  });

  it('4. Integridade da base Supabase PostgreSQL: 64 produtos únicos na Regional BA e 0 duplicidades', async () => {
    const { data: dbProducts, error } = await supabase
      .from('audit_products')
      .select('id, serial, imei, regional_id, data_auditoria')
      .lt('serial', '359100000000000');

    expect(error).toBeNull();
    expect(Array.isArray(dbProducts)).toBe(true);
    expect(dbProducts!.length).toBe(64);

    const imeiSet = new Set<string>();
    const serialSet = new Set<string>();
    let duplicatesCount = 0;

    for (const p of dbProducts!) {
      const imeiNorm = (p.imei || '').trim().toUpperCase();
      const serialNorm = (p.serial || '').trim().toUpperCase();

      if (imeiSet.has(imeiNorm) || serialSet.has(serialNorm)) {
        duplicatesCount++;
      }
      if (imeiNorm) imeiSet.add(imeiNorm);
      if (serialNorm) serialSet.add(serialNorm);
    }

    expect(duplicatesCount).toBe(0);
    expect(imeiSet.size).toBe(64);
  });
});
