import { describe, it, expect, beforeEach } from 'vitest';

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

import { db, REGIONAIS_PADRAO } from '../db/storage';
import { ProdutoAuditoria } from '../types';

describe('Dashboard Estrito aos 4 Polos e Coluna Regional de Origem', () => {
  beforeEach(() => {
    db.limparTudoMemoria();
    Object.keys(localMock).forEach((k) => delete localMock[k]);
    Object.keys(sessionMock).forEach((k) => delete sessionMock[k]);
  });

  it('1. db.listarRegionais() retorna estritamente os 4 polos oficiais (sem AM ou origens)', () => {
    const regionais = db.listarRegionais();
    expect(regionais).toEqual(REGIONAIS_PADRAO);
    expect(regionais).not.toContain('AM');
    expect(regionais).not.toContain('CAJAMAR');
  });

  it('2. Lançamento no RJ com produto originário de AM: contabiliza sob VIA VAREJO RJ e preserva regional_produto AM', () => {
    db.setUsuarioAtual({
      id: 101,
      login: 'operador_rj',
      senha: '123',
      criado_em: '2026-09-25',
      nome: 'Operador RJ',
      perfil: 'OPERADOR',
      regional: 'VIA VAREJO RJ',
      ativo: true,
    });

    const res = db.inserirProduto({
      serial: '357445721142558',
      imei: '357445721142558',
      modelo_produto: 'GALAXY S24 ULTRA',
      ean: '7891234567890',
      numero_caixa: 'Caixa 01',
      numero_lote: 'LOTE 01',
      regional: 'AM',
      regional_produto: 'AM',
      regional_usuario: 'VIA VAREJO RJ',
      produto_lacrado: 'SIM',
      data_auditoria: '2026-09-25',
      observacao: 'Auditoria estação RJ',
    });

    expect(res.sucesso).toBe(true);

    const prods = db.listarProdutos();
    expect(prods.length).toBe(1);
    const p = prods[0];

    // O polo operacional deve ser estritamente VIA VAREJO RJ
    expect(p.regional).toBe('VIA VAREJO RJ');
    // A regional de origem do produto deve ser AM
    expect(p.regional_produto).toBe('AM');

    // Estatísticas regionais do Dashboard:
    db.setUsuarioAtual({
      id: 102,
      login: 'admin',
      senha: '123',
      criado_em: '2026-09-25',
      nome: 'Administrador',
      perfil: 'ADMINISTRADOR',
      regional: 'TODAS',
      ativo: true,
    });

    const stats = db.obterEstatisticasRegionais();
    // Somente os 4 polos devem existir no painel
    expect(stats.length).toBe(4);
    const nomesRegionais = stats.map((s) => s.regional);
    expect(nomesRegionais).toEqual(REGIONAIS_PADRAO);
    expect(nomesRegionais).not.toContain('AM');

    // RJ deve ter 1 produto contabilizado
    const rjStats = stats.find((s) => s.regional === 'VIA VAREJO RJ');
    expect(rjStats?.totalProdutos).toBe(1);
  });

  it('3. mesclarProdutosCentral normaliza regional recebida como AM para polo operacional RJ', () => {
    db.setUsuarioAtual({
      id: 103,
      login: 'admin',
      senha: '123',
      criado_em: '2026-09-25',
      nome: 'Administrador',
      perfil: 'ADMINISTRADOR',
      regional: 'TODAS',
      ativo: true,
    });

    const produtoRemotoAM: any = {
      id: 999,
      id_servidor: 'SRV-999',
      serial: '359998887776665',
      imei: '359998887776665',
      modelo_produto: 'GALAXY A55 5G',
      ean: '7899988877766',
      numero_caixa: 'Caixa 02',
      numero_lote: 'LOTE 01',
      regional: 'AM', // vindo incorretamente como AM do servidor
      regional_produto: 'AM',
      regional_usuario: 'VIA VAREJO RJ',
      produto_lacrado: 'SIM',
      data_auditoria: '2026-09-25',
      data_cadastro: '2026-09-25T10:00:00.000Z',
      status_sincronizacao: 'ENVIADO',
      sync_status: 'ENVIADO',
    };

    db.mesclarProdutosCentral([produtoRemotoAM]);

    const prods = db.listarProdutos();
    expect(prods.length).toBe(1);
    expect(prods[0].regional).toBe('VIA VAREJO RJ');
    expect(prods[0].regional_produto).toBe('AM');

    const stats = db.obterEstatisticasRegionais();
    expect(stats.length).toBe(4);
    const rjStats = stats.find((s) => s.regional === 'VIA VAREJO RJ');
    expect(rjStats?.totalProdutos).toBe(1);
    expect(stats.find((s) => s.regional === 'AM')).toBeUndefined();
  });
});
