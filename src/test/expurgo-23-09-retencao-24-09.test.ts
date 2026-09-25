import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isRegistroDoDia24EmDiante,
  db,
  extrairCodigoRegional,
} from '../db/storage';
import syncHandler from '../../api/central/sync';
import produtosHandler from '../../api/central/produtos';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://chvfzqekkmongsrqbwev.supabase.co';
const SUPABASE_KEY = 'sb_publishable_F-Lc83bJD87AokRbHPmltg_hp2q6Ghj';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

describe('EXPURGO COMPULSÓRIO DE 23/09 E RETENÇÃO ESTRITA DE 24/09 EM DIANTE', () => {
  beforeEach(() => {
    db.limparTudoMemoria();
  });

  it('1. Validador isRegistroDoDia24EmDiante deve rejeitar 23/09 e datas anteriores e aceitar 24/09 em diante', () => {
    // Rejeições obrigatórias
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '23/09/2026' })).toBe(false);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '2026-09-23' })).toBe(false);
    expect(isRegistroDoDia24EmDiante({ data_cadastro: '2026-09-23T15:30:00Z' })).toBe(false);
    expect(isRegistroDoDia24EmDiante({ data_fechamento: '23/09/2026 18:00' })).toBe(false);
    expect(isRegistroDoDia24EmDiante({ created_at: '2026-09-22T10:00:00Z' })).toBe(false);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '22/09/2026' })).toBe(false);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '21/09/2026' })).toBe(false);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '20/09/2026' })).toBe(false);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '15/08/2026' })).toBe(false);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '2025-12-31' })).toBe(false);

    // Aceitações obrigatórias (24/09 em diante)
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '24/09/2026' })).toBe(true);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '2026-09-24' })).toBe(true);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '2026-09-24T16:09:11+00:00' })).toBe(true);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '25/09/2026' })).toBe(true);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '2026-09-25' })).toBe(true);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '01/10/2026' })).toBe(true);
    expect(isRegistroDoDia24EmDiante({ data_auditoria: '2026-10-01' })).toBe(true);
  });

  it('2. Limpeza e reconciliação: registros de 23/09 são eliminados e os de 24/09 permanecem intactos', () => {
    // Simula presença em memória de produtos obsoletos de 23/09 e produtos válidos de 24/09
    const produtosMistos = [
      {
        id: 'p-antigo-1',
        serial: 'SN-ANTIGO-23-01',
        imei: 'SN-ANTIGO-23-01',
        regional: 'VIA VAREJO BA',
        data_auditoria: '23/09/2026',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
      },
      {
        id: 'p-antigo-2',
        serial: 'SN-ANTIGO-23-02',
        imei: 'SN-ANTIGO-23-02',
        regional: 'VIA VAREJO BA',
        data_auditoria: '2026-09-23',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
      },
      {
        id: 'p-valido-1',
        serial: 'SN-VALIDO-24-01',
        imei: 'SN-VALIDO-24-01',
        regional: 'VIA VAREJO BA',
        data_auditoria: '24/09/2026',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
      },
      {
        id: 'p-valido-2',
        serial: 'SN-VALIDO-24-02',
        imei: 'SN-VALIDO-24-02',
        regional: 'VIA VAREJO BA',
        data_auditoria: '2026-09-24',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
      },
    ];

    (db as any).produtos = [...produtosMistos];

    // Produtos vindos da nuvem central (apenas os de 24/09)
    const produtosNuvem = [
      {
        id: 'p-valido-1',
        serial: 'SN-VALIDO-24-01',
        imei: 'SN-VALIDO-24-01',
        regional: 'VIA VAREJO BA',
        data_auditoria: '24/09/2026',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
      },
      {
        id: 'p-valido-2',
        serial: 'SN-VALIDO-24-02',
        imei: 'SN-VALIDO-24-02',
        regional: 'VIA VAREJO BA',
        data_auditoria: '2026-09-24',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
      },
    ];

    db.mesclarProdutosCentral(produtosNuvem as any);

    const produtosAposCarga = (db as any).produtos;
    const seriaisApos = produtosAposCarga.map((p: any) => p.serial);

    // Verifica que nenhum item de 23/09 sobrevive
    expect(seriaisApos).not.toContain('SN-ANTIGO-23-01');
    expect(seriaisApos).not.toContain('SN-ANTIGO-23-02');

    // Verifica que os de 24/09 permanecem intactos
    expect(seriaisApos).toContain('SN-VALIDO-24-01');
    expect(seriaisApos).toContain('SN-VALIDO-24-02');
    expect(produtosAposCarga.length).toBe(2);
  });

  it('3. Ingestão Central: Sync descarta automaticamente itens de 23/09/2026', async () => {
    let statusCode = 0;
    let jsonResult: any = null;
    const uid = Date.now().toString().slice(-6);

    const req = {
      method: 'POST',
      headers: {
        origin: 'https://sistema-auditoria-solutions.vercel.app',
      },
      body: {
        usuario: {
          nome: 'Operador Teste Expurgador',
          login: 'op_expurgo',
          perfil: 'OPERADOR',
          regional: 'VIA VAREJO BA',
        },
        regional: 'VIA VAREJO BA',
        computador: {
          id: 'PC-BA-EXP',
          nome: 'Estação Expurgo',
          regional: 'VIA VAREJO BA',
        },
        produtos: [
          {
            id: `item-rejeitado-23-${uid}`,
            serial: `35990000023${uid}`,
            imei: `35990000023${uid}`,
            sku: '5370760',
            modelo_produto: 'TEST OLD',
            fabricante: 'MOTOROLA',
            numero_lote: 'LOTE 1',
            numero_caixa: 'Caixa 01',
            produto_lacrado: 'SIM',
            data_auditoria: '23/09/2026',
          },
          {
            id: `item-aceito-24-${uid}`,
            serial: `35990000024${uid}`,
            imei: `35990000024${uid}`,
            sku: '5370760',
            modelo_produto: 'TEST NEW',
            fabricante: 'MOTOROLA',
            numero_lote: 'LOTE 1',
            numero_caixa: 'Caixa 01',
            produto_lacrado: 'SIM',
            data_auditoria: '24/09/2026',
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
    // Apenas o item de 24/09 foi sincronizado; o de 23/09 foi expurgado
    expect(jsonResult.sincronizados).toBe(1);
  });

  it('4. Consulta Central: API de produtos não retorna nenhum registro de 23/09', async () => {
    let statusCode = 0;
    let jsonResult: any = null;

    const req = {
      method: 'GET',
      headers: {
        origin: 'https://sistema-auditoria-solutions.vercel.app',
        'x-user-perfil': 'ADMINISTRADOR',
        'x-user-regional': 'VIA VAREJO BA',
      },
      query: {
        perfil: 'ADMINISTRADOR',
        regional: 'VIA VAREJO BA',
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

    await produtosHandler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonResult.sucesso).toBe(true);
    expect(Array.isArray(jsonResult.produtos)).toBe(true);

    for (const p of jsonResult.produtos) {
      expect(p.data_auditoria).not.toContain('23/09');
      expect(p.data_auditoria).not.toContain('2026-09-23');
      expect(isRegistroDoDia24EmDiante(p)).toBe(true);
    }
  });

  it('5. Base Oficial Supabase: estritamente 64 produtos na BA de 24/09/2026 e 0 de 23/09', async () => {
    const { data: dbProducts, error, count } = await supabase
      .from('audit_products')
      .select('id, serial, data_auditoria, regional_id, regions(codigo, nome)', { count: 'exact' })
      .lt('serial', '359100000000000');

    expect(error).toBeNull();
    expect(count).toBe(64);
    expect(dbProducts).toBeDefined();
    expect(dbProducts?.length).toBe(64);

    for (const p of dbProducts || []) {
      expect(p.data_auditoria).toBe('2026-09-24');
      const regCod = (p.regions as any)?.codigo || (Array.isArray(p.regions) ? (p.regions as any)[0]?.codigo : null);
      expect(regCod).toBe('BA');
    }
  });
});
