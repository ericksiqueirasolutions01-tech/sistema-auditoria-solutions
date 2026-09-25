// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/storage';
import type { Usuario } from '../types';

describe('REGRAS DE REGIONAL (PRODUTO VS USUÁRIO) E TRAVA DE CAIXA POR NF ORIGEM', () => {
  const operadorRJ: Usuario = {
    id: 101,
    login: 'operador_rj',
    nome: 'Operador Rio de Janeiro',
    senha: 'hash',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const operadorMG: Usuario = {
    id: 102,
    login: 'operador_mg',
    nome: 'Operador Minas Gerais',
    senha: 'hash',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO MG',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  beforeEach(() => {
    db.limparTudoMemoria();
  });

  // =========================================================================
  // 1. Usuário RJ cadastrando produto CAJAMAR: PERMITIDO
  // =========================================================================
  it('1. Usuário RJ cadastrando produto CAJAMAR: PERMITIDO', async () => {
    db.setUsuarioAtual(operadorRJ);

    // Cadastrar referência de produto com origem CAJAMAR
    (db as any).regionalReferences.push({
      id: 'ref-cajamar-01',
      regional: 'CAJAMAR',
      import_batch_id: 'batch-01',
      imei_normalized: '357445721108351',
      sku: '5328772',
      model_description: 'CEL SAMSUNG GALAXY S25ULTRA 5G 256GB PRETO',
      brand: 'SAMSUNG',
      origin_invoice: '004271584-1',
      nf_origem_samsung: '004271584-1',
      dealer_normalized: 'SAMSUNG ELETRONICA DA AMAZONIA LTDA',
      source_file_name: 'Cópia de CB Consolidado.xlsx',
      source_row: 2,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    (db as any).reconstruirMapaReferencia();

    const resultado = db.inserirProduto({
      serial: '357445721108351',
      imei: '357445721108351',
      modelo_produto: 'CEL SAMSUNG GALAXY S25ULTRA 5G 256GB PRETO',
      sku: '5328772',
      numero_caixa: 'Caixa 01',
      numero_lote: 'LOTE 01',
      produto_lacrado: 'SIM',
      data_auditoria: '2026-09-25',
    });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.erro).toBeUndefined();
    expect(resultado.produto).toBeDefined();

    // Validação da separação das regionais
    expect(resultado.produto?.regional_usuario).toBe('VIA VAREJO RJ');
    expect(resultado.produto?.regional_produto).toBe('CAJAMAR');
    expect(resultado.produto?.regional).toBe('VIA VAREJO RJ');
  });

  // =========================================================================
  // 2. Usuário MG cadastrando produto BA: PERMITIDO
  // =========================================================================
  it('2. Usuário MG cadastrando produto BA: PERMITIDO', async () => {
    db.setUsuarioAtual(operadorMG);

    // Cadastrar referência de produto com origem BA
    (db as any).regionalReferences.push({
      id: 'ref-ba-01',
      regional: 'BA',
      import_batch_id: 'batch-ba',
      imei_normalized: '358999111222333',
      sku: '5311223',
      model_description: 'GALAXY A55 5G 128GB',
      brand: 'SAMSUNG',
      origin_invoice: '003988112-2',
      nf_origem_samsung: '003988112-2',
      dealer_normalized: 'VIA VAREJO',
      source_file_name: 'Inventario_BA.xlsx',
      source_row: 5,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    (db as any).reconstruirMapaReferencia();

    const resultado = db.inserirProduto({
      serial: '358999111222333',
      imei: '358999111222333',
      modelo_produto: 'GALAXY A55 5G 128GB',
      sku: '5311223',
      numero_caixa: 'Caixa 01',
      numero_lote: 'LOTE 01',
      produto_lacrado: 'SIM',
      data_auditoria: '2026-09-25',
    });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.erro).toBeUndefined();
    expect(resultado.produto).toBeDefined();

    // Validação da separação das regionais
    expect(resultado.produto?.regional_usuario).toBe('VIA VAREJO MG');
    expect(resultado.produto?.regional_produto).toBe('BA');
    expect(resultado.produto?.regional).toBe('VIA VAREJO MG');
  });

  // =========================================================================
  // 3. Produtos mesma NF na caixa: PERMITIDO
  // =========================================================================
  it('3. Produtos mesma NF na caixa: PERMITIDO', async () => {
    db.setUsuarioAtual(operadorRJ);

    // Produto 1 na Caixa 01 com NF 004271584-1
    const res1 = db.inserirProduto({
      serial: '357000000000001',
      imei: '357000000000001',
      modelo_produto: 'GALAXY S24 ULTRA',
      sku: '5001',
      numero_caixa: 'Caixa 01',
      numero_lote: 'LOTE 01',
      nf_origem_samsung: '004271584-1',
      produto_lacrado: 'SIM',
      data_auditoria: '2026-09-25',
    });
    expect(res1.sucesso).toBe(true);

    // Produto 2 na Caixa 01 com a MESMA NF 004271584-1
    const res2 = db.inserirProduto({
      serial: '357000000000002',
      imei: '357000000000002',
      modelo_produto: 'GALAXY S24',
      sku: '5002',
      numero_caixa: 'Caixa 01',
      numero_lote: 'LOTE 01',
      nf_origem_samsung: '004271584-1',
      produto_lacrado: 'SIM',
      data_auditoria: '2026-09-25',
    });
    expect(res2.sucesso).toBe(true);
    expect(res2.erro).toBeUndefined();

    const produtos = db.listarProdutos({ caixa: 'Caixa 01' });
    expect(produtos.length).toBe(2);
    expect(produtos[0].nf_origem_samsung).toBe('004271584-1');
    expect(produtos[1].nf_origem_samsung).toBe('004271584-1');
  });

  // =========================================================================
  // 4. Produtos NF diferente na caixa: BLOQUEADO
  // =========================================================================
  it('4. Produtos NF diferente na caixa: BLOQUEADO com "CAIXA BLOQUEADA: NF Origem Samsung diferente da caixa atual."', async () => {
    db.setUsuarioAtual(operadorRJ);

    // Primeiro produto define a NF da Caixa 01 como "004271584-1"
    const res1 = db.inserirProduto({
      serial: '357000000000010',
      imei: '357000000000010',
      modelo_produto: 'GALAXY S24 ULTRA',
      sku: '5001',
      numero_caixa: 'Caixa 01',
      numero_lote: 'LOTE 01',
      nf_origem_samsung: '004271584-1',
      produto_lacrado: 'SIM',
      data_auditoria: '2026-09-25',
    });
    expect(res1.sucesso).toBe(true);

    // Segundo produto tenta entrar na Caixa 01 com NF diferente "009999888-1"
    const res2 = db.inserirProduto({
      serial: '357000000000020',
      imei: '357000000000020',
      modelo_produto: 'GALAXY A54',
      sku: '5003',
      numero_caixa: 'Caixa 01',
      numero_lote: 'LOTE 01',
      nf_origem_samsung: '009999888-1',
      produto_lacrado: 'SIM',
      data_auditoria: '2026-09-25',
    });

    expect(res2.sucesso).toBe(false);
    expect(res2.erro).toBe('CAIXA BLOQUEADA: NF Origem Samsung diferente da caixa atual.');
  });
});
