// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/storage';
import { ProdutoAuditoria } from '../types';

describe('Funcionalidade: Lacre de Segurança por Caixa e Integração com Espelho', () => {
  const operador = {
    id: 10,
    login: 'operador.teste',
    nome: 'Operador Teste',
    senha: '123',
    perfil: 'OPERADOR' as const,
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  beforeEach(async () => {
    db.setUsuarioAtual(operador);
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    (db as any).produtos = [];
    (db as any).serialMap.clear();
    await db.limparBaseOperacional();
  });

  it('1. Deve definir e obter o lacre de segurança por caixa e regional', () => {
    expect(db.obterLacreCaixa('Caixa 01', 'VIA VAREJO RJ')).toBe('');

    db.definirLacreCaixa('Caixa 01', 'LACRE-123456', 'VIA VAREJO RJ');
    expect(db.obterLacreCaixa('Caixa 01', 'VIA VAREJO RJ')).toBe('LACRE-123456');

    // Outra caixa deve estar vazia
    expect(db.obterLacreCaixa('Caixa 02', 'VIA VAREJO RJ')).toBe('');
  });

  it('2. Deve herdar o lacre de segurança ao cadastrar produtos na caixa', () => {
    db.definirLacreCaixa('Caixa 01', 'LACRE-SAMSUNG-99', 'VIA VAREJO RJ');

    const res = db.inserirProduto({
      serial: '357847400000001',
      imei: '357847400000001',
      modelo_produto: 'GALAXY S24 ULTRA',
      ean: '7891234567890',
      sku: '7891234567890',
      numero_caixa: 'Caixa 01',
      numero_lote: '01',
      produto_lacrado: 'SIM',
      regional: 'VIA VAREJO RJ',
    });

    expect(res.sucesso).toBe(true);
    const p = db.buscarPorSerial('357847400000001');
    expect(p).toBeDefined();
    expect(p?.lacre_seguranca).toBe('LACRE-SAMSUNG-99');
  });

  it('3. Deve atualizar em lote todos os produtos da caixa ao definir o lacre posteriormente', () => {
    // Insere 2 produtos antes de definir o lacre
    db.inserirProduto({
      serial: '357847400000002',
      imei: '357847400000002',
      modelo_produto: 'GALAXY A55 5G',
      ean: '7891234567891',
      sku: '7891234567891',
      numero_caixa: 'Caixa 05',
      numero_lote: '01',
      produto_lacrado: 'SIM',
      regional: 'VIA VAREJO RJ',
    });

    db.inserirProduto({
      serial: '357847400000003',
      imei: '357847400000003',
      modelo_produto: 'GALAXY A55 5G',
      ean: '7891234567891',
      sku: '7891234567891',
      numero_caixa: 'Caixa 05',
      numero_lote: '01',
      produto_lacrado: 'SIM',
      regional: 'VIA VAREJO RJ',
    });

    expect(db.buscarPorSerial('357847400000002')?.lacre_seguranca).toBeFalsy();

    // Define o lacre para a Caixa 05
    db.definirLacreCaixa('Caixa 05', 'LACRE-LOTE-55', 'VIA VAREJO RJ');

    // Ambos os produtos devem ter recebido o lacre atualizado
    expect(db.buscarPorSerial('357847400000002')?.lacre_seguranca).toBe('LACRE-LOTE-55');
    expect(db.buscarPorSerial('357847400000003')?.lacre_seguranca).toBe('LACRE-LOTE-55');
  });

  it('4. Deve retornar lacre_seguranca em obterConfiguracaoCaixa', () => {
    db.definirLacreCaixa('Caixa 07', 'LACRE-007', 'VIA VAREJO RJ');
    const cfg = db.obterConfiguracaoCaixa('Caixa 07', 'VIA VAREJO RJ');
    expect(cfg.lacre_seguranca).toBe('LACRE-007');
  });

  it('5. Deve permitir atualizar lacre_seguranca individualmente via atualizarProduto', () => {
    db.inserirProduto({
      serial: '357847400000004',
      imei: '357847400000004',
      modelo_produto: 'GALAXY S23',
      ean: '7891234567892',
      sku: '7891234567892',
      numero_caixa: 'Caixa 08',
      numero_lote: '01',
      produto_lacrado: 'SIM',
      regional: 'VIA VAREJO RJ',
    });

    const p = db.buscarPorSerial('357847400000004')!;
    const res = db.atualizarProduto(p.id, {
      lacre_seguranca: 'LACRE-NOVO-88',
    });

    expect(res.sucesso).toBe(true);
    expect(db.buscarPorSerial('357847400000004')?.lacre_seguranca).toBe('LACRE-NOVO-88');
  });
});

