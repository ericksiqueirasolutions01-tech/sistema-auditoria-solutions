// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/storage';
import { FotosFechamentoLote } from '../types';

describe('Funcionalidades: Relatório Admin com Lacre, Exclusão de Base e Produtos Pendentes', () => {
  const adminUser = {
    id: 1,
    login: 'admin.tester',
    nome: 'Admin Tester',
    senha: 'hash',
    perfil: 'ADMINISTRADOR' as const,
    regional: null,
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const fotosValidas: FotosFechamentoLote = {
    caixaFechada: 'data:image/jpeg;base64,1234567890123456789012345678901234567890123456789012345',
    espelhoCaixa: 'data:image/jpeg;base64,1234567890123456789012345678901234567890123456789012345',
    lacreSeguranca: 'data:image/jpeg;base64,1234567890123456789012345678901234567890123456789012345',
  };

  beforeEach(async () => {
    db.setUsuarioAtual(adminUser);
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    (db as any).produtos = [];
    (db as any).regionalReferences = [];
    (db as any).importBatches = [];
    (db as any).auditLots = [];
    (db as any).lotesFinalizados = [];
    (db as any).referenceMap?.clear();
    (db as any).serialMap?.clear();
    await db.limparBaseOperacional();
  });

  describe('1. Detecção e Comparação de Produtos Pendentes antes de Fechar Lote', () => {
    it('retorna lista vazia se não houver base de referência regional ativa', () => {
      const pendentes = db.obterProdutosPendentesLote('LOTE-01', 'VIA VAREJO SP');
      expect(pendentes).toEqual([]);
    });

    it('identifica corretamente produtos da listagem oficial que não foram lançados (ex: 68 na lista e 60 lançados)', async () => {
      // 1. Importar base com 5 itens para teste
      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO SP',
        fileName: 'base_teste.xlsx',
        importedBy: 'Admin Tester',
        itens: [
          { imei: '351111111111111', sku: 'SKU01', model_description: 'GALAXY S24', brand: 'SAMSUNG', dealer: 'SP' },
          { imei: '352222222222222', sku: 'SKU02', model_description: 'GALAXY S24', brand: 'SAMSUNG', dealer: 'SP' },
          { imei: '353333333333333', sku: 'SKU03', model_description: 'GALAXY S24', brand: 'SAMSUNG', dealer: 'SP' },
          { imei: '354444444444444', sku: 'SKU04', model_description: 'GALAXY A55', brand: 'SAMSUNG', dealer: 'SP' },
          { imei: '355555555555555', sku: 'SKU05', model_description: 'GALAXY A55', brand: 'SAMSUNG', dealer: 'SP' },
        ],
      });

      // 2. Colaborador lança 3 dos 5 produtos
      db.inserirProduto({
        serial: '351111111111111',
        imei: '351111111111111',
        numero_lote: 'LOTE-TESTE-01',
        numero_caixa: 'CX-01',
        regional: 'VIA VAREJO SP',
        modelo_produto: 'GALAXY S24',
        ean: 'SKU01',
        fabricante: 'SAMSUNG',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        lacre_seguranca: 'LACRE-CX01-999',
      });

      db.inserirProduto({
        serial: '352222222222222',
        imei: '352222222222222',
        numero_lote: 'LOTE-TESTE-01',
        numero_caixa: 'CX-01',
        regional: 'VIA VAREJO SP',
        modelo_produto: 'GALAXY S24',
        ean: 'SKU02',
        fabricante: 'SAMSUNG',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        lacre_seguranca: 'LACRE-CX01-999',
      });

      db.inserirProduto({
        serial: '353333333333333',
        imei: '353333333333333',
        numero_lote: 'LOTE-TESTE-01',
        numero_caixa: 'CX-02',
        regional: 'VIA VAREJO SP',
        modelo_produto: 'GALAXY S24',
        ean: 'SKU03',
        fabricante: 'SAMSUNG',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        lacre_seguranca: 'LACRE-CX02-888',
      });

      // 3. Verificar produtos pendentes
      const pendentes = db.obterProdutosPendentesLote('LOTE-TESTE-01', 'VIA VAREJO SP');
      expect(pendentes.length).toBe(2);
      expect(pendentes.map((p) => p.imei)).toEqual(['354444444444444', '355555555555555']);
      expect(pendentes[0].modelo).toBe('GALAXY A55');
    });
  });

  describe('2. Finalização de Lote com Pendências e Motivo Obrigatório', () => {
    it('salva o motivo e os produtos pendentes no registro do lote finalizado', async () => {
      // Importar base com 2 itens
      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO SP',
        fileName: 'base_teste.xlsx',
        importedBy: 'Admin Tester',
        itens: [
          { imei: '351111111111111', sku: 'SKU01', model_description: 'GALAXY S24', brand: 'SAMSUNG', dealer: 'SP' },
          { imei: '352222222222222', sku: 'SKU02', model_description: 'GALAXY S24', brand: 'SAMSUNG', dealer: 'SP' },
        ],
      });

      // Lança apenas o 1º item
      db.inserirProduto({
        serial: '351111111111111',
        imei: '351111111111111',
        numero_lote: 'LOTE-PEND-01',
        numero_caixa: 'CX-01',
        regional: 'VIA VAREJO SP',
        modelo_produto: 'GALAXY S24',
        ean: 'SKU01',
        fabricante: 'SAMSUNG',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
      });

      const pendentes = db.obterProdutosPendentesLote('LOTE-PEND-01', 'VIA VAREJO SP');
      expect(pendentes.length).toBe(1);

      // Finalizar lote com pendências e justificativa
      const res = db.finalizarLote({
        numeroLote: 'LOTE-PEND-01',
        regional: 'VIA VAREJO SP',
        colaborador: 'Operador João',
        fotos: fotosValidas,
        motivoPendencias: 'Não entregue pelo cliente',
        produtosPendentes: pendentes,
      });

      expect(res.sucesso).toBe(true);
      expect(res.lote).toBeDefined();
      expect(res.lote?.motivo_pendencias).toBe('Não entregue pelo cliente');
      expect(res.lote?.produtos_pendentes?.length).toBe(1);
      expect(res.lote?.produtos_pendentes?.[0].imei).toBe('352222222222222');
      expect(res.lote?.produtos_pendentes?.[0].motivo).toBe('Não entregue pelo cliente');
    });
  });

  describe('3. Exclusão de Base de Referência pelo Administrador', () => {
    it('exclui a base de dados e suas referências com sucesso', async () => {
      const impRes = await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO RJ',
        fileName: 'base_teste_v1.xlsx',
        importedBy: 'Admin Master',
        itens: [
          { imei: '351111111111111', sku: 'SKU01', model_description: 'GALAXY S24', brand: 'SAMSUNG', dealer: 'RJ' },
          { imei: '352222222222222', sku: 'SKU02', model_description: 'GALAXY S24', brand: 'SAMSUNG', dealer: 'RJ' },
        ],
      });

      expect(impRes.batch).toBeDefined();
      const batchId = impRes.batch.id;

      // Verificar que itens existem no banco
      const antes = db.obterListaAtivaReferencia('VIA VAREJO RJ');
      expect(antes.length).toBe(2);

      // Excluir base
      const delRes = await db.excluirBaseReferenciaRegional(batchId);
      expect(delRes.sucesso).toBe(true);

      // Verificar que itens foram removidos
      const depois = db.obterListaAtivaReferencia('VIA VAREJO RJ');
      expect(depois.length).toBe(0);

      const historico = db.listarHistoricoImportacoes('VIA VAREJO RJ');
      expect(historico.length).toBe(0);
    });

    it('ao excluir a base ativa com versões anteriores existentes, reativa a versão remanescente mais recente', async () => {
      // 1. Criar versão v1
      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO RJ',
        fileName: 'base_v1.xlsx',
        importedBy: 'Admin',
        itens: [
          { imei: '351111111111111', sku: 'SKU01', model_description: 'S24', brand: 'SAMSUNG', dealer: 'RJ' },
        ],
      });

      // 2. Criar versão v2 (que passa a ser a ATIVA)
      const imp2 = await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO RJ',
        fileName: 'base_v2.xlsx',
        importedBy: 'Admin',
        itens: [
          { imei: '352222222222222', sku: 'SKU02', model_description: 'S24', brand: 'SAMSUNG', dealer: 'RJ' },
        ],
      });

      let hist = db.listarHistoricoImportacoes('VIA VAREJO RJ');
      expect(hist.length).toBe(2);
      expect(hist[0].version).toBe(2);
      expect(hist[0].status).toBe('ATIVA');
      expect(hist[1].status).toBe('HISTORICA');

      // 3. Excluir v2
      await db.excluirBaseReferenciaRegional(imp2.batch.id);

      // 4. v1 deve ser reativada
      hist = db.listarHistoricoImportacoes('VIA VAREJO RJ');
      expect(hist.length).toBe(1);
      expect(hist[0].version).toBe(1);
      expect(hist[0].status).toBe('ATIVA');

      const ativas = db.obterListaAtivaReferencia('VIA VAREJO RJ');
      expect(ativas.length).toBe(1);
      expect(ativas[0].imei_normalized).toBe('351111111111111');
    });
  });

  describe('4. Integridade de Lacre e Identificação de Pendências com Caixa 0', () => {
    it('armazena e recupera o lacre de cada caixa para relatórios', () => {
      db.definirLacreCaixa('CX-ALPHA', 'LACRE-999000', 'VIA VAREJO SP');
      const lacre = db.obterLacreCaixa('CX-ALPHA', 'VIA VAREJO SP');
      expect(lacre).toBe('LACRE-999000');
    });
  });
});
