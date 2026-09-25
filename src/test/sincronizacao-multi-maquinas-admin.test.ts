import { describe, it, expect, beforeEach } from 'vitest';

// Habilitar consulta ao Supabase em ambiente de teste
process.env.FORCE_TEST_SERVER_SYNC = 'true';

// Mock de localStorage e sessionStorage para ambiente Node/Vitest
const localMock: Record<string, string> = {};
const sessionMock: Record<string, string> = {};

(global as any).localStorage = {
  getItem: (k: string) => localMock[k] || null,
  setItem: (k: string, v: string) => { localMock[k] = String(v); },
  removeItem: (k: string) => { delete localMock[k]; },
  clear: () => { Object.keys(localMock).forEach((k) => delete localMock[k]); },
};

(global as any).sessionStorage = {
  getItem: (k: string) => sessionMock[k] || null,
  setItem: (k: string, v: string) => { sessionMock[k] = String(v); },
  removeItem: (k: string) => { delete sessionMock[k]; },
  clear: () => { Object.keys(sessionMock).forEach((k) => delete sessionMock[k]); },
};

import { db, extrairCodigoRegional, isRegistroDoDia24EmDiante } from '../db/storage';
import { ProdutoAuditoria, Usuario } from '../types';
import produtosHandler from '../../api/central/produtos';

describe('Sincronização 100% Funcional Multi-Máquinas e Multi-Redes (Operador -> Admin)', () => {
  beforeEach(() => {
    db.limparTudoMemoria();
    Object.keys(localMock).forEach((k) => delete localMock[k]);
    Object.keys(sessionMock).forEach((k) => delete sessionMock[k]);
  });

  it('1. Endpoint central de produtos retorna tanto BA quanto RJ para usuário ADMINISTRADOR', async () => {
    let statusCode = 0;
    let jsonResult: any = null;

    const req = {
      method: 'GET',
      headers: {
        authorization: 'Bearer token-admin-teste',
        'x-user-perfil': 'ADMINISTRADOR',
        'x-user-regional': 'TODAS',
      },
      query: {
        perfil: 'ADMINISTRADOR',
        regional: 'TODAS',
      },
    };

    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonResult = data; },
    };

    await produtosHandler(req, res);

    expect(statusCode).toBe(200);
    expect(jsonResult).toBeDefined();
    expect(jsonResult.sucesso).toBe(true);
    expect(Array.isArray(jsonResult.produtos)).toBe(true);

    const prods: any[] = jsonResult.produtos;
    const rjProds = prods.filter((p) => extrairCodigoRegional(p.regional) === 'RJ');
    const baProds = prods.filter((p) => extrairCodigoRegional(p.regional) === 'BA');

    expect(baProds.length).toBe(64);
    expect(rjProds.length).toBeGreaterThanOrEqual(2);

    // Valida que os seriais reais da base do RJ estão presentes
    const seriaisRJ = rjProds.map((p) => p.serial);
    expect(seriaisRJ).toContain('357445721142558');
    expect(seriaisRJ).toContain('357445721108351');
  });

  it('2. mesclarProdutosCentral ingere registros de RJ e BA sem expurgar nenhuma regional', () => {
    const produtosServidor: ProdutoAuditoria[] = [
      {
        id: 'ba-01',
        serial: '354781910322343',
        imei: '354781910322343',
        modelo_produto: 'Galaxy S24',
        fabricante: 'SAMSUNG',
        numero_caixa: 'Caixa 01',
        numero_lote: '01',
        regional: 'VIA VAREJO BA',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
        data_auditoria: '24/09/2026',
        data_cadastro: '2026-09-24T10:00:00Z',
      } as any,
      {
        id: 'rj-01',
        serial: '357445721142558',
        imei: '357445721142558',
        modelo_produto: 'Galaxy A55 5G',
        fabricante: 'SAMSUNG',
        numero_caixa: 'Caixa RJ-01',
        numero_lote: '01',
        regional: 'VIA VAREJO RJ',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
        data_auditoria: '25/09/2026',
        data_cadastro: '2026-09-25T03:54:47Z',
      } as any,
      {
        id: 'rj-02',
        serial: '357445721108351',
        imei: '357445721108351',
        modelo_produto: 'Galaxy S24 Ultra',
        fabricante: 'SAMSUNG',
        numero_caixa: 'Caixa RJ-01',
        numero_lote: '01',
        regional: 'VIA VAREJO RJ',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
        data_auditoria: '25/09/2026',
        data_cadastro: '2026-09-25T03:54:47Z',
      } as any,
    ];

    const alterou = db.mesclarProdutosCentral(produtosServidor);
    expect(alterou).toBe(true);

    const prodsMemoria = db.listarProdutos({ regional: 'TODAS' });
    expect(prodsMemoria.length).toBe(3);

    const prodsRJ = db.listarProdutos({ regional: 'VIA VAREJO RJ' });
    expect(prodsRJ.length).toBe(2);
    expect(prodsRJ.map((p) => p.serial)).toContain('357445721142558');
    expect(prodsRJ.map((p) => p.serial)).toContain('357445721108351');

    const prodsBA = db.listarProdutos({ regional: 'VIA VAREJO BA' });
    expect(prodsBA.length).toBe(1);
    expect(prodsBA[0].serial).toBe('354781910322343');
  });

  it('3. Painel Admin: Estatísticas regionais mostram dados consolidados de BA e RJ', () => {
    const adminUser: Usuario = {
      id: 1,
      nome: 'Administrador Geral',
      login: 'admin',
      senha: '123',
      perfil: 'ADMINISTRADOR',
      regional: 'TODAS',
      ativo: true,
      criado_em: new Date().toISOString(),
    };
    db.setUsuarioAtual(adminUser);

    const produtosServidor: ProdutoAuditoria[] = [
      {
        id: 'ba-01',
        serial: '354781910322343',
        imei: '354781910322343',
        modelo_produto: 'Galaxy S24',
        fabricante: 'SAMSUNG',
        numero_caixa: 'Caixa 01',
        numero_lote: '01',
        regional: 'VIA VAREJO BA',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
        data_auditoria: '24/09/2026',
        data_cadastro: '2026-09-24T10:00:00Z',
      } as any,
      {
        id: 'rj-01',
        serial: '357445721142558',
        imei: '357445721142558',
        modelo_produto: 'Galaxy A55 5G',
        fabricante: 'SAMSUNG',
        numero_caixa: 'Caixa RJ-01',
        numero_lote: '01',
        regional: 'VIA VAREJO RJ',
        produto_lacrado: 'SIM',
        status_sincronizacao: 'ENVIADO',
        data_auditoria: '25/09/2026',
        data_cadastro: '2026-09-25T03:54:47Z',
      } as any,
    ];

    db.mesclarProdutosCentral(produtosServidor);

    const stats = db.obterEstatisticasRegionais();
    const statBA = stats.find((s) => s.regional.includes('BA'))!;
    const statRJ = stats.find((s) => s.regional.includes('RJ'))!;

    expect(statBA).toBeDefined();
    expect(statBA.totalProdutos).toBe(1);

    expect(statRJ).toBeDefined();
    expect(statRJ.totalProdutos).toBe(1);

    const metricasConsolidadas = db.obterMetricasDashboard('TODAS');
    expect(metricasConsolidadas.totalAuditados).toBe(2);
  });

  it('4. Persistência e auto-recuperação preservam dados de RJ sem expurgo', async () => {
    const prodRJ: ProdutoAuditoria = {
      id: 'rj-persist-01',
      serial: '357445721142558',
      imei: '357445721142558',
      modelo_produto: 'Galaxy A55 5G',
      fabricante: 'SAMSUNG',
      numero_caixa: 'Caixa RJ-01',
      numero_lote: '01',
      regional: 'VIA VAREJO RJ',
      produto_lacrado: 'SIM',
      status_sincronizacao: 'ENVIADO',
      data_auditoria: '25/09/2026',
      data_cadastro: '2026-09-25T03:54:47Z',
    } as any;

    (db as any).produtos = [prodRJ];
    (db as any).salvarTudo();

    // Recarregar dados do localStorage
    (db as any).carregarDados();

    const produtosAposRecarga = db.listarProdutos({ regional: 'VIA VAREJO RJ' });
    expect(produtosAposRecarga.length).toBe(1);
    expect(produtosAposRecarga[0].serial).toBe('357445721142558');

    // Executar auto-recuperação e garantir que nada de RJ seja expurgado
    await db.verificarRecuperacaoIndexedDB();

    const produtosAposVerificacao = db.listarProdutos({ regional: 'VIA VAREJO RJ' });
    expect(produtosAposVerificacao.length).toBe(1);
    expect(produtosAposVerificacao[0].serial).toBe('357445721142558');
  });
});
