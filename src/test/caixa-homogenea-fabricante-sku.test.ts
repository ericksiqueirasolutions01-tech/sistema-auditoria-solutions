// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, inferirFabricante, consultarMarcaPorSku, CADASTRO_MESTRE_SKU } from '../db/storage';
import syncHandler from '../../api/central/sync';

describe('PROMPT FINAL: Fabricante Correto + Caixa Homogênea + Coluna SKU + Lote Manual', () => {
  const adminUser = {
    id: 1,
    login: 'admin',
    nome: 'Administrador Master',
    senha: '123',
    perfil: 'ADMINISTRADOR' as const,
    regional: 'TODAS',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const operadorRJ = {
    id: 2,
    login: 'operador.rj',
    nome: 'Operador Rio',
    senha: '123',
    perfil: 'OPERADOR' as const,
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  beforeEach(async () => {
    db.setUsuarioAtual(adminUser);
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    (db as any).produtos = [];
    (db as any).serialMap.clear();
    await db.limparBaseOperacional();
  });

  describe('1. Resolução Estrita de Fabricante Real (inferirFabricante & Catálogo Mestre SKU)', () => {
    it('deve identificar MOTOROLA através do código SKU do catálogo mestre (ex: 5370760)', () => {
      expect(consultarMarcaPorSku('5370760')).toBe('MOTOROLA');
      expect(consultarMarcaPorSku('005370760')).toBe('MOTOROLA');
      expect(inferirFabricante('Modelo Genérico', null, '5370760')).toBe('MOTOROLA');
    });

    it('deve identificar marcas conhecidas via SKU (Samsung, Oppo, Jovi)', () => {
      expect(consultarMarcaPorSku('SM-S928BZKQZTO')).toBe('SAMSUNG');
      expect(consultarMarcaPorSku('CPH2579')).toBe('OPPO');
      expect(consultarMarcaPorSku('JOVI-01')).toBe('JOVI');

      expect(inferirFabricante('Smartphone', null, 'CPH2579')).toBe('OPPO');
      expect(inferirFabricante('Aparelho', null, 'JOVI-01')).toBe('JOVI');
    });

    it('deve identificar fabricante por palavras-chave do modelo quando SKU não estiver cadastrado', () => {
      expect(inferirFabricante('Moto G54 5G', null, 'SKU999')).toBe('MOTOROLA');
      expect(inferirFabricante('Motorola Edge 40', null, 'SKU999')).toBe('MOTOROLA');
      expect(inferirFabricante('XT2347-1', null, 'SKU999')).toBe('MOTOROLA');
      expect(inferirFabricante('iPhone 15 Pro Max', null, 'SKU999')).toBe('APPLE');
      expect(inferirFabricante('Redmi Note 13', null, 'SKU999')).toBe('XIAOMI');
      expect(inferirFabricante('Galaxy S24 Ultra', null, 'SKU999')).toBe('SAMSUNG');
    });

    it('deve priorizar marca estruturada da referência sobre análise de palavras-chave', () => {
      expect(inferirFabricante('Aparelho X', 'MOTOROLA', 'SKU999')).toBe('MOTOROLA');
      expect(inferirFabricante('Aparelho Y', 'OPPO', 'SKU999')).toBe('OPPO');
    });

    it('NUNCA deve assumir SAMSUNG indiscriminadamente para modelos e SKUs desconhecidos', () => {
      const res = inferirFabricante('Celular Desconhecido XYZ', null, 'SKU-INEXISTENTE-999');
      expect(res).toBe('FABRICANTE NÃO IDENTIFICADO');
      expect(res).not.toBe('SAMSUNG');
    });
  });

  describe('2. Coluna SKU na Tabela Operacional e Validação Mandatória', () => {
    it('deve rejeitar produtos FORA DA LISTA se o SKU estiver vazio', () => {
      db.setUsuarioAtual(operadorRJ);

      const res = db.inserirProduto({
        serial: '357847400100001',
        imei: '357847400100001',
        modelo_produto: 'Smartphone Teste',
        ean: '', // vazio
        sku: '', // vazio
        numero_caixa: 'Caixa 01',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(res.sucesso).toBe(false);
      expect(res.erro).toBe('O preenchimento do código SKU é obrigatório para produtos fora da lista.');
    });

    it('deve permitir cadastro de produto FORA DA LISTA com SKU preenchido e persistir o SKU no snapshot', () => {
      db.setUsuarioAtual(operadorRJ);

      const res = db.inserirProduto({
        serial: '357847400100002',
        imei: '357847400100002',
        modelo_produto: 'Smartphone Motorola XT2601',
        ean: '5370760',
        sku: '5370760',
        numero_caixa: 'Caixa 01',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto).toBeDefined();
      expect(res.produto?.sku).toBe('5370760');
      expect(res.produto?.fabricante).toBe('MOTOROLA');
      expect(res.produto?.numero_lote).toBe('LOTE 1');
    });
  });

  describe('3. Regra de Caixa Homogênea (Chave Dupla: Classificação + Condição de Lacre)', () => {
    it('o primeiro produto deve travar a caixa com sua classificação e condição de lacre', () => {
      db.setUsuarioAtual(operadorRJ);

      const res1 = db.inserirProduto({
        serial: '357847400200001',
        imei: '357847400200001',
        modelo_produto: 'Galaxy S24',
        sku: 'SM-S928B',
        numero_caixa: 'Caixa 10',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(res1.sucesso).toBe(true);
      expect(res1.produto?.box_classification).toBe('FORA DA LISTA - SAMSUNG');
      expect(res1.produto?.box_sealed_status).toBe('SEALED');

      const config = db.obterConfiguracaoCaixa('Caixa 10', 'VIA VAREJO RJ');
      expect(config.vazia).toBe(false);
      expect(config.classificacao).toBe('FORA DA LISTA - SAMSUNG');
      expect(config.condicaoLacre).toBe('LACRADO');
    });

    it('deve aceitar segundo produto com mesma classificação e mesma condição de lacre', () => {
      db.setUsuarioAtual(operadorRJ);

      db.inserirProduto({
        serial: '357847400200001',
        imei: '357847400200001',
        modelo_produto: 'Galaxy S24',
        sku: 'SM-S928B',
        numero_caixa: 'Caixa 10',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      const res2 = db.inserirProduto({
        serial: '357847400200002',
        imei: '357847400200002',
        modelo_produto: 'Galaxy S24+',
        sku: 'SM-S926B',
        numero_caixa: 'Caixa 10',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(res2.sucesso).toBe(true);
      expect(res2.produto?.box_classification).toBe('FORA DA LISTA - SAMSUNG');
      expect(res2.produto?.box_sealed_status).toBe('SEALED');
    });

    it('deve BLOQUEAR produto com condição de lacre divergente na mesma caixa (LACRADO vs ABERTO)', () => {
      db.setUsuarioAtual(operadorRJ);

      db.inserirProduto({
        serial: '357847400200001',
        imei: '357847400200001',
        modelo_produto: 'Galaxy S24',
        sku: 'SM-S928B',
        numero_caixa: 'Caixa 10',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      // Tentativa de bipar produto aberto (NÃO lacrado)
      const resIncompativel = db.inserirProduto({
        serial: '357847400200003',
        imei: '357847400200003',
        modelo_produto: 'Galaxy S24',
        sku: 'SM-S928B',
        numero_caixa: 'Caixa 10',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'NÃO',
        kit_completo: 'SIM',
        aparelho_marcas_uso: 'NÃO',
        regional: 'VIA VAREJO RJ',
      });

      expect(resIncompativel.sucesso).toBe(false);
      expect(resIncompativel.erro).toContain('BOX_SEALED_MISMATCH');
    });

    it('deve BLOQUEAR produto com classificação divergente na mesma caixa (ex: SAMSUNG vs OUTRA MARCA)', () => {
      db.setUsuarioAtual(operadorRJ);

      db.inserirProduto({
        serial: '357847400200001',
        imei: '357847400200001',
        modelo_produto: 'Galaxy S24',
        sku: 'SM-S928B',
        numero_caixa: 'Caixa 10',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      // Tentativa de bipar produto de outra marca na mesma caixa
      const resIncompativel = db.inserirProduto({
        serial: '357847400200004',
        imei: '357847400200004',
        modelo_produto: 'Moto G54 5G',
        sku: '5370760',
        numero_caixa: 'Caixa 10',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(resIncompativel.sucesso).toBe(false);
      expect(resIncompativel.erro).toContain('BOX_CLASSIFICATION_MISMATCH');
    });

    it('deve bloquear alteração via atualizarProduto que fira a homogeneidade da caixa destino', () => {
      db.setUsuarioAtual(adminUser);

      // Caixa 01: LACRADO
      const p1 = db.inserirProduto({
        serial: '357847400300001',
        imei: '357847400300001',
        modelo_produto: 'Galaxy S24',
        sku: 'SM-S928B',
        numero_caixa: 'Caixa 01',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      }).produto!;

      // Caixa 02: ABERTO
      const p2 = db.inserirProduto({
        serial: '357847400300002',
        imei: '357847400300002',
        modelo_produto: 'Galaxy S24',
        sku: 'SM-S928B',
        numero_caixa: 'Caixa 02',
        numero_lote: 'LOTE 1',
        produto_lacrado: 'NÃO',
        kit_completo: 'SIM',
        aparelho_marcas_uso: 'NÃO',
        regional: 'VIA VAREJO RJ',
      }).produto!;

      // Tentar mover p2 (ABERTO) para Caixa 01 (LACRADO)
      const resUpdate = db.atualizarProduto(p2.id, {
        numero_caixa: 'Caixa 01',
      });

      expect(resUpdate.sucesso).toBe(false);
      expect(resUpdate.erro).toContain('BOX_SEALED_MISMATCH');
    });
  });

  describe('4. Central Sync Endpoint (Gate 4): Rejeição HTTP 409 em Caixas Heterogêneas', () => {
    it('deve responder com HTTP 409 BOX_CLASSIFICATION_MISMATCH se o lote contiver produtos com classificações misturadas na mesma caixa', async () => {
      const mockReq = {
        method: 'POST',
        headers: {},
        body: {
          usuario: { login: 'operador.rj', nome: 'Operador Rio', perfil: 'OPERADOR', regional: 'VIA VAREJO RJ' },
          computador: { id: 'PC-01', nome: 'Estacao 01', regional: 'VIA VAREJO RJ' },
          regional: 'VIA VAREJO RJ',
          produtos: [
            {
              id: 1,
              serial: '357847400400001',
              imei: '357847400400001',
              modelo_produto: 'Galaxy S24',
              sku: 'SM-S928B',
              numero_caixa: 'Caixa 99',
              produto_lacrado: 'SIM',
              box_classification: 'FORA DA LISTA - SAMSUNG',
              box_sealed_status: 'SEALED',
              regional: 'VIA VAREJO RJ',
            },
            {
              id: 2,
              serial: '357847400400002',
              imei: '357847400400002',
              modelo_produto: 'Moto G54',
              sku: '5370760',
              numero_caixa: 'Caixa 99', // mesma caixa!
              produto_lacrado: 'SIM',
              box_classification: 'FORA DA LISTA - OUTRA MARCA', // divergente!
              box_sealed_status: 'SEALED',
              regional: 'VIA VAREJO RJ',
            },
          ],
        },
      };

      let statusCode = 200;
      let responseBody: any = null;

      const mockRes = {
        setHeader: () => {},
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      };

      await syncHandler(mockReq, mockRes);

      expect(statusCode).toBe(409);
      expect(responseBody.codigo).toBe('BOX_CLASSIFICATION_MISMATCH');
      expect(responseBody.erro).toContain('BOX_CLASSIFICATION_MISMATCH');
    });

    it('deve responder com HTTP 409 BOX_SEALED_MISMATCH se o lote contiver produtos com lacres misturados na mesma caixa', async () => {
      const mockReq = {
        method: 'POST',
        headers: {},
        body: {
          usuario: { login: 'operador.rj', nome: 'Operador Rio', perfil: 'OPERADOR', regional: 'VIA VAREJO RJ' },
          computador: { id: 'PC-01', nome: 'Estacao 01', regional: 'VIA VAREJO RJ' },
          regional: 'VIA VAREJO RJ',
          produtos: [
            {
              id: 1,
              serial: '357847400500001',
              imei: '357847400500001',
              modelo_produto: 'Galaxy S24',
              sku: 'SM-S928B',
              numero_caixa: 'Caixa 88',
              produto_lacrado: 'SIM',
              box_classification: 'FORA DA LISTA - SAMSUNG',
              box_sealed_status: 'SEALED',
              regional: 'VIA VAREJO RJ',
            },
            {
              id: 2,
              serial: '357847400500002',
              imei: '357847400500002',
              modelo_produto: 'Galaxy S24',
              sku: 'SM-S928B',
              numero_caixa: 'Caixa 88', // mesma caixa!
              produto_lacrado: 'NÃO', // lacre divergente!
              box_classification: 'FORA DA LISTA - SAMSUNG',
              box_sealed_status: 'OPEN',
              regional: 'VIA VAREJO RJ',
            },
          ],
        },
      };

      let statusCode = 200;
      let responseBody: any = null;

      const mockRes = {
        setHeader: () => {},
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      };

      await syncHandler(mockReq, mockRes);

      expect(statusCode).toBe(409);
      expect(responseBody.codigo).toBe('BOX_SEALED_MISMATCH');
      expect(responseBody.erro).toContain('BOX_SEALED_MISMATCH');
    });
  });

  describe('5. Testes Obrigatórios Críticos — Seções 15 e 16 (Prompt de Correção Crítica)', () => {
    it('Seção 15: SKU 5370760 + CEL MOTOROLA EDGE 70 8 256 XT2601 3 CINZA DEVE retornar MOTOROLA (mesmo se fallback for SAMSUNG)', () => {
      const modelo = 'CEL MOTOROLA EDGE 70 8 256 XT2601 3 CINZA';
      const sku = '5370760';

      // Teste sem fallback
      expect(inferirFabricante(modelo, null, sku)).toBe('MOTOROLA');

      // Teste com fallback legado corrompido 'SAMSUNG'
      expect(inferirFabricante(modelo, 'SAMSUNG', sku)).toBe('MOTOROLA');

      // Teste apenas com modelo
      expect(inferirFabricante(modelo, null, null)).toBe('MOTOROLA');

      // Teste apenas com SKU
      expect(inferirFabricante('Modelo Indefinido', null, sku)).toBe('MOTOROLA');
    });

    it('Seção 16: Testes A, B, C e D da Caixa Homogênea Exclusiva (CAIXA 01)', () => {
      db.setUsuarioAtual(operadorRJ);

      // --- TESTE A ---
      // CAIXA 01 vazia
      // 1º item = LISTA / OUTRA MARCA + LACRADO -> ACEITO e trava a caixa
      const resA = db.inserirProduto({
        serial: '357847400900001',
        imei: '357847400900001',
        modelo_produto: 'CEL MOTOROLA EDGE 70 8 256 XT2601 3 CINZA',
        sku: '5370760',
        numero_caixa: 'CAIXA 01',
        numero_lote: 'LOTE 1',
        source_type: 'LISTED',
        dealer: 'MOTOROLA MOBILITY COMERCIO DE PRODUTOS ELETRONICOS LTDA',
        fabricante: 'MOTOROLA',
        classificacao_produto: 'PRODUTO NA LISTA - OUTRA MARCA',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(resA.sucesso).toBe(true);
      expect(resA.produto?.fabricante).toBe('MOTOROLA');
      expect(resA.produto?.classificacao_produto).toBe('PRODUTO NA LISTA - OUTRA MARCA');
      expect(resA.produto?.box_classification).toBe('PRODUTO NA LISTA - OUTRA MARCA');
      expect(resA.produto?.box_sealed_status).toBe('SEALED');
      expect(resA.produto?.box_name).toBe('CAIXA 01');
      expect(resA.produto?.box_id).toBe('caixa-01');

      const configCaixa01 = db.obterConfiguracaoCaixa('CAIXA 01', 'VIA VAREJO RJ');
      expect(configCaixa01.vazia).toBe(false);
      expect(configCaixa01.classificacao).toBe('PRODUTO NA LISTA - OUTRA MARCA');
      expect(configCaixa01.condicaoLacre).toBe('LACRADO');

      // --- TESTE B ---
      // CAIXA 01 = LISTA / OUTRA MARCA + LACRADO
      // novo item = LISTA / SAMSUNG + LACRADO -> BLOQUEADO
      const resB = db.inserirProduto({
        serial: '357847400900002',
        imei: '357847400900002',
        modelo_produto: 'Galaxy S24 Ultra',
        sku: 'SM-S928BZKQZTO',
        numero_caixa: 'CAIXA 01',
        numero_lote: 'LOTE 1',
        source_type: 'LISTED',
        dealer: 'SAMSUNG ELETRONICA DA AMAZONIA LTDA',
        fabricante: 'SAMSUNG',
        classificacao_produto: 'PRODUTO NA LISTA - SAMSUNG',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(resB.sucesso).toBe(false);
      expect(resB.erro).toContain('BOX_CLASSIFICATION_MISMATCH');

      // --- TESTE C ---
      // CAIXA 01 = LISTA / OUTRA MARCA + LACRADO
      // novo item = LISTA / SIRI + LACRADO -> BLOQUEADO
      const resC = db.inserirProduto({
        serial: '357847400900003',
        imei: '357847400900003',
        modelo_produto: 'Galaxy A54 5G',
        sku: 'SM-A546E',
        numero_caixa: 'CAIXA 01',
        numero_lote: 'LOTE 1',
        source_type: 'LISTED',
        dealer: 'SIRI COMERCIO E SERVICOS LTDA',
        fabricante: 'SAMSUNG',
        classificacao_produto: 'PRODUTO NA LISTA - SIRI COMERCIO E SERVICOS LTDA',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(resC.sucesso).toBe(false);
      expect(resC.erro).toContain('BOX_CLASSIFICATION_MISMATCH');

      // --- TESTE D ---
      // CAIXA 01 = LISTA / OUTRA MARCA + LACRADO
      // novo item = LISTA / OUTRA MARCA + ABERTO -> BLOQUEADO
      const resD = db.inserirProduto({
        serial: '357847400900004',
        imei: '357847400900004',
        modelo_produto: 'CEL MOTOROLA EDGE 70 8 256 XT2601 3 CINZA',
        sku: '5370760',
        numero_caixa: 'CAIXA 01',
        numero_lote: 'LOTE 1',
        source_type: 'LISTED',
        dealer: 'MOTOROLA MOBILITY COMERCIO DE PRODUTOS ELETRONICOS LTDA',
        fabricante: 'MOTOROLA',
        classificacao_produto: 'PRODUTO NA LISTA - OUTRA MARCA',
        produto_lacrado: 'NÃO', // Aberto!
        kit_completo: 'SIM',
        aparelho_marcas_uso: 'NÃO',
        regional: 'VIA VAREJO RJ',
      });

      expect(resD.sucesso).toBe(false);
      expect(resD.erro).toContain('BOX_SEALED_MISMATCH');
    });
  });
});
