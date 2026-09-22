// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/storage';

describe('Edição de Fabricante e Modelo para Produtos Fora da Lista', () => {
  const operadorRJ = {
    id: 10,
    login: 'colaborador.rj',
    nome: 'Colaborador Rio',
    senha: '123',
    perfil: 'OPERADOR' as const,
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const adminMaster = {
    id: 1,
    login: 'admin',
    nome: 'Admin Master',
    senha: '123',
    perfil: 'ADMINISTRADOR' as const,
    regional: 'TODAS',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  beforeEach(async () => {
    db.setUsuarioAtual(operadorRJ);
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    (db as any).produtos = [];
    (db as any).serialMap.clear();
    await db.limparBaseOperacional();
  });

  describe('1. Inserção de Produto Fora da Lista com Fabricante e Modelo Customizados', () => {
    it('deve registrar produto fora da lista respeitando o fabricante e modelo informados pelo colaborador', () => {
      const res = db.inserirProduto({
        serial: '357847400555001',
        imei: '357847400555001',
        fabricante: 'MOTOROLA',
        brand: 'MOTOROLA',
        modelo_produto: 'Moto Edge 40 Neo',
        sku: 'SKU-MOTO-01',
        ean: 'SKU-MOTO-01',
        numero_caixa: 'Caixa 01',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
        source_type: 'OUT_OF_LIST',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto?.fabricante).toBe('MOTOROLA');
      expect(res.produto?.modelo_produto).toBe('Moto Edge 40 Neo');
      expect(res.produto?.source_type).toBe('OUT_OF_LIST');
      expect(res.produto?.classificacao_produto).toBe('FORA DA LISTA - OUTRA MARCA');
      expect(res.produto?.box_classification).toBe('FORA DA LISTA - OUTRA MARCA');
    });

    it('deve atribuir FORA DA LISTA - SAMSUNG quando colaborador informar fabricante SAMSUNG em item fora da lista', () => {
      const res = db.inserirProduto({
        serial: '357847400555002',
        imei: '357847400555002',
        fabricante: 'SAMSUNG',
        brand: 'SAMSUNG',
        modelo_produto: 'Galaxy Custom 5G',
        sku: 'SKU-SAM-99',
        ean: 'SKU-SAM-99',
        numero_caixa: 'Caixa 02',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
        source_type: 'OUT_OF_LIST',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto?.fabricante).toBe('SAMSUNG');
      expect(res.produto?.modelo_produto).toBe('Galaxy Custom 5G');
      expect(res.produto?.classificacao_produto).toBe('FORA DA LISTA - SAMSUNG');
      expect(res.produto?.box_classification).toBe('FORA DA LISTA - SAMSUNG');
    });

    it('deve registrar fabricante genérico OUTRA MARCA se colaborador selecionar OUTRA MARCA', () => {
      const res = db.inserirProduto({
        serial: '357847400555003',
        imei: '357847400555003',
        fabricante: 'OUTRA MARCA',
        brand: 'OUTRA MARCA',
        modelo_produto: 'Smartphone Importado Genérico',
        sku: 'SKU-GEN-01',
        ean: 'SKU-GEN-01',
        numero_caixa: 'Caixa 03',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
        source_type: 'OUT_OF_LIST',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto?.fabricante).toBe('OUTRA MARCA');
      expect(res.produto?.modelo_produto).toBe('Smartphone Importado Genérico');
      expect(res.produto?.classificacao_produto).toBe('FORA DA LISTA - OUTRA MARCA');
    });
  });

  describe('2. Edição de Fabricante e Modelo via atualizarProduto', () => {
    it('deve permitir atualizar fabricante e modelo de um produto fora da lista e recalcular classificação', () => {
      // 1. Cadastra fora da lista com SAMSUNG
      const cadastro = db.inserirProduto({
        serial: '357847400555010',
        imei: '357847400555010',
        fabricante: 'SAMSUNG',
        brand: 'SAMSUNG',
        modelo_produto: 'Galaxy A04',
        sku: 'SKU-TEST-01',
        ean: 'SKU-TEST-01',
        numero_caixa: 'Caixa 10',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
        source_type: 'OUT_OF_LIST',
      });

      expect(cadastro.sucesso).toBe(true);
      expect(cadastro.produto?.fabricante).toBe('SAMSUNG');
      expect(cadastro.produto?.classificacao_produto).toBe('FORA DA LISTA - SAMSUNG');

      // 2. Colaborador edita para MOTOROLA e modelo Moto G24
      const update = db.atualizarProduto(cadastro.produto!.id, {
        fabricante: 'MOTOROLA',
        brand: 'MOTOROLA',
        modelo_produto: 'Moto G24 Power',
      });

      expect(update.sucesso).toBe(true);
      expect(update.produto?.fabricante).toBe('MOTOROLA');
      expect(update.produto?.modelo_produto).toBe('Moto G24 Power');
      expect(update.produto?.classificacao_produto).toBe('FORA DA LISTA - OUTRA MARCA');
      expect(update.produto?.box_classification).toBe('FORA DA LISTA - OUTRA MARCA');
    });

    it('deve bloquear edição se a alteração do fabricante quebrar a homogeneidade da caixa com outros itens', () => {
      // 1. Caixa 20 com 1º item: SAMSUNG
      const res1 = db.inserirProduto({
        serial: '357847400555021',
        imei: '357847400555021',
        fabricante: 'SAMSUNG',
        brand: 'SAMSUNG',
        modelo_produto: 'Galaxy A15',
        sku: 'SKU-S1',
        numero_caixa: 'Caixa 20',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
        source_type: 'OUT_OF_LIST',
      });
      expect(res1.sucesso).toBe(true);

      // 2. Caixa 20 com 2º item: SAMSUNG (mesma caixa)
      const res2 = db.inserirProduto({
        serial: '357847400555022',
        imei: '357847400555022',
        fabricante: 'SAMSUNG',
        brand: 'SAMSUNG',
        modelo_produto: 'Galaxy A25',
        sku: 'SKU-S2',
        numero_caixa: 'Caixa 20',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
        source_type: 'OUT_OF_LIST',
      });
      expect(res2.sucesso).toBe(true);

      // 3. Tentar alterar o 2º item para MOTOROLA na mesma Caixa 20
      const updateBloqueado = db.atualizarProduto(res2.produto!.id, {
        fabricante: 'MOTOROLA',
        brand: 'MOTOROLA',
        modelo_produto: 'Moto G84',
      });

      expect(updateBloqueado.sucesso).toBe(false);
      expect(updateBloqueado.erro).toContain('BOX_CLASSIFICATION_MISMATCH');
    });
  });

  describe('3. Manutenção da Integridade da Base Oficial', () => {
    it('produtos com referência oficial na base preservam a marca e lote oficial ao serem consultados', async () => {
      db.setUsuarioAtual(adminMaster);
      // Importa base oficial regional
      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO RJ',
        fileName: 'base_oficial_rj.xlsx',
        importedBy: 'Admin Master',
        itens: [
          {
            imei: '357847400999001',
            sku: 'SM-S928B',
            model_description: 'SAMSUNG GALAXY S24 ULTRA',
            brand: 'SAMSUNG',
            dealer: 'SAMSUNG ELETRONICA',
          },
        ],
      });

      db.setUsuarioAtual(operadorRJ);
      const res = db.inserirProduto({
        serial: '357847400999001',
        imei: '357847400999001',
        modelo_produto: 'Nome Qualquer Digitado',
        sku: 'SM-S928B',
        numero_caixa: 'Caixa 99',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto?.source_type).toBe('LISTED');
      expect(res.produto?.fabricante).toBe('SAMSUNG');
      expect(res.produto?.modelo_produto).toBe('SAMSUNG GALAXY S24 ULTRA');
    });
  });
});
