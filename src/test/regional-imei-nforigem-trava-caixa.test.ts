// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/storage';
import syncHandler from '../../api/central/sync';

describe('Validação Estrutural: Regional por IMEI (Coluna J) + Trava de Caixa por NFOrigem Samsung', () => {
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

  const operadorBA = {
    id: 2,
    login: 'operador.ba',
    nome: 'Operador Bahia',
    senha: '123',
    perfil: 'OPERADOR' as const,
    regional: 'VIA VAREJO BA',
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
    (db as any).regionalReferences = [];
    (db as any).importBatches = [];
    (db as any).referenceMap.clear();
    (db as any).imeiToRefMap.clear();
    await db.limparBaseOperacional();
  });

  // =========================================================================
  // Teste 1: Importar planilha com regional (Coluna J)
  // Confirmar: IMEI possui regional.
  // =========================================================================
  it('Teste 1: Importar planilha com regional (Coluna J) -> Confirmar que cada IMEI possui sua regional', async () => {
    db.setUsuarioAtual(adminUser);

    const importResult = await db.importarListaReferenciaRegional({
      regional: 'VIA VAREJO SP', // fallback de contexto
      fileName: 'base_oficial_samsung_com_regional.xlsx',
      itens: [
        {
          source_row: 2,
          imei: '357847400000001',
          sku: 'SM-S928B',
          model_description: 'GALAXY S24 ULTRA TITANIUM',
          brand: 'SAMSUNG',
          nf_origem_samsung: 'NF-1001',
          origin_invoice: 'NF-1001',
          dealer: 'VIA VAREJO',
          regional: 'VIA VAREJO BA', // Coluna J
        },
        {
          source_row: 3,
          imei: '357847400000002',
          sku: 'SM-A546E',
          model_description: 'GALAXY A54 5G 128GB',
          brand: 'SAMSUNG',
          nf_origem_samsung: 'NF-1002',
          origin_invoice: 'NF-1002',
          dealer: 'MAGAZINE LUIZA',
          regional: 'VIA VAREJO RJ', // Coluna J
        },
        {
          source_row: 4,
          imei: '357847400000003',
          sku: 'XT2347-1',
          model_description: 'MOTO G54 5G 256GB',
          brand: 'MOTOROLA',
          nf_origem_samsung: 'NF-1003',
          origin_invoice: 'NF-1003',
          dealer: 'CASAS BAHIA',
          regional: 'VIA VAREJO MG', // Coluna J
        },
      ],
    });

    expect(importResult.totalImportados).toBe(3);

    // Confirmar que cada IMEI possui sua regional correspondente cadastrada
    const ref1 = db.consultarImeiReferencia('357847400000001');
    expect(ref1).not.toBeNull();
    expect(ref1?.regional).toBe('VIA VAREJO BA');
    expect(ref1?.nf_origem_samsung).toBe('NF-1001');
    expect(ref1?.model_description).toBe('GALAXY S24 ULTRA TITANIUM');

    const ref2 = db.consultarImeiReferencia('357847400000002');
    expect(ref2).not.toBeNull();
    expect(ref2?.regional).toBe('VIA VAREJO RJ');
    expect(ref2?.nf_origem_samsung).toBe('NF-1002');

    const ref3 = db.consultarImeiReferencia('357847400000003');
    expect(ref3).not.toBeNull();
    expect(ref3?.regional).toBe('VIA VAREJO MG');
    expect(ref3?.nf_origem_samsung).toBe('NF-1003');
  });

  // =========================================================================
  // Teste 2: Bipar IMEI
  // Confirmar: Regional aparece (nunca digitada manualmente; vem da base oficial)
  // Retornar: IMEI, Modelo, Fabricante, NFOrigem Samsung, Regional.
  // =========================================================================
  it('Teste 2: Bipar IMEI -> Confirmar que Regional, Modelo, Fabricante e NFOrigem Samsung aparecem automaticamente da base oficial', async () => {
    // Carregar referência prévia com Coluna J (Regional) e NFOrigem Samsung
    await db.importarListaReferenciaRegional({
      regional: 'VIA VAREJO SP',
      fileName: 'inventario_geral.xlsx',
      itens: [
        {
          source_row: 2,
          imei: '358999888777666',
          sku: 'SM-S928B',
          model_description: 'SAMSUNG GALAXY S24 ULTRA',
          brand: 'SAMSUNG',
          nf_origem_samsung: 'NF-SAMSUNG-99999',
          origin_invoice: 'NF-SAMSUNG-99999',
          dealer: 'VIA VAREJO',
          regional: 'VIA VAREJO PE', // Coluna J oficial
        },
      ],
    });

    // Simular bipagem pelo operador
    db.setUsuarioAtual(operadorBA);

    const refBipada = db.consultarImeiReferencia('358999888777666');
    expect(refBipada).toBeDefined();
    expect(refBipada?.imei_normalized).toBe('358999888777666');
    expect(refBipada?.model_description).toBe('SAMSUNG GALAXY S24 ULTRA');
    expect(refBipada?.brand).toBe('SAMSUNG');
    expect(refBipada?.nf_origem_samsung).toBe('NF-SAMSUNG-99999');
    expect(refBipada?.regional).toBe('VIA VAREJO PE');

    // Ao inserir o produto sem passar a regional (ou passando outra), a regional OFICIAL prevalece
    const res = db.inserirProduto({
      modelo_produto: refBipada!.model_description,
      sku: refBipada!.sku,
      serial: '358999888777666',
      numero_caixa: 'Caixa 001',
      produto_lacrado: 'SIM',
      numero_lote: 'LOTE 1',
    });

    expect(res.sucesso).toBe(true);
    expect(res.produto).toBeDefined();
    expect(res.produto?.imei).toBe('358999888777666');
    expect(res.produto?.modelo_produto).toBe('SAMSUNG GALAXY S24 ULTRA');
    expect(res.produto?.fabricante).toBe('SAMSUNG');
    expect(res.produto?.nf_origem_samsung).toBe('NF-SAMSUNG-99999');
    // Regional veio da base oficial (VIA VAREJO PE), não de digitação manual
    expect(res.produto?.regional).toBe('VIA VAREJO PE');
  });

  // =========================================================================
  // Teste 3: Criar caixa com mesma NF
  // Resultado: Permitido
  // =========================================================================
  it('Teste 3: Criar caixa com produtos da mesma NFOrigem Samsung -> Resultado: Permitido (OK)', async () => {
    await db.importarListaReferenciaRegional({
      regional: 'VIA VAREJO SP',
      fileName: 'lote_nf_12345.xlsx',
      itens: [
        {
          source_row: 2,
          imei: '351111111111111',
          sku: 'SM-S928B',
          model_description: 'GALAXY S24',
          brand: 'SAMSUNG',
          nf_origem_samsung: '12345',
          origin_invoice: '12345',
          regional: 'VIA VAREJO SP',
        },
        {
          source_row: 3,
          imei: '352222222222222',
          sku: 'SM-A546E',
          model_description: 'GALAXY A54',
          brand: 'SAMSUNG',
          nf_origem_samsung: '12345',
          origin_invoice: '12345',
          regional: 'VIA VAREJO SP',
        },
      ],
    });

    // 1. Produto A na Caixa 001 com NF 12345
    const resA = db.inserirProduto({
      modelo_produto: 'GALAXY S24',
      sku: 'SM-S928B',
      serial: '351111111111111',
      numero_caixa: 'Caixa 001',
      produto_lacrado: 'SIM',
      numero_lote: 'LOTE 1',
    });
    expect(resA.sucesso).toBe(true);

    // 2. Produto B na Caixa 001 com a MESMA NF 12345
    const resB = db.inserirProduto({
      modelo_produto: 'GALAXY A54',
      sku: 'SM-A546E',
      serial: '352222222222222',
      numero_caixa: 'Caixa 001',
      produto_lacrado: 'SIM',
      numero_lote: 'LOTE 1',
    });
    expect(resB.sucesso).toBe(true);
    expect(resB.erro).toBeUndefined();

    // Produtos na mesma caixa confirmados
    const produtosCaixa = db.listarProdutos({ caixa: 'Caixa 001' });
    expect(produtosCaixa.length).toBe(2);
    expect(produtosCaixa[0].nf_origem_samsung).toBe('12345');
    expect(produtosCaixa[1].nf_origem_samsung).toBe('12345');
  });

  // =========================================================================
  // Teste 4: Criar caixa com NF diferente
  // Resultado: Bloqueado com a mensagem exata
  // =========================================================================
  it('Teste 4: Criar caixa com NF diferente -> Bloqueado com mensagem: "CAIXA BLOQUEADA: Não é permitido misturar produtos com NFOrigem Samsung diferentes na mesma caixa."', async () => {
    await db.importarListaReferenciaRegional({
      regional: 'VIA VAREJO SP',
      fileName: 'duas_nfs.xlsx',
      itens: [
        {
          source_row: 2,
          imei: '353333333333333',
          sku: 'SM-S928B',
          model_description: 'PRODUTO A',
          brand: 'SAMSUNG',
          nf_origem_samsung: '12345',
          origin_invoice: '12345',
          regional: 'VIA VAREJO SP',
        },
        {
          source_row: 3,
          imei: '354444444444444',
          sku: 'SM-A546E',
          model_description: 'PRODUTO B',
          brand: 'SAMSUNG',
          nf_origem_samsung: '67890',
          origin_invoice: '67890',
          regional: 'VIA VAREJO SP',
        },
      ],
    });

    // 1. Produto A na Caixa 001 (NF 12345) -> Sucesso
    const resA = db.inserirProduto({
      modelo_produto: 'PRODUTO A',
      sku: 'SM-S928B',
      serial: '353333333333333',
      numero_caixa: 'Caixa 001',
      produto_lacrado: 'SIM',
      numero_lote: 'LOTE 1',
    });
    expect(resA.sucesso).toBe(true);

    // 2. Produto B na Caixa 001 (NF 67890 diferente) -> Bloqueio Estrito!
    const resB = db.inserirProduto({
      modelo_produto: 'PRODUTO B',
      sku: 'SM-A546E',
      serial: '354444444444444',
      numero_caixa: 'Caixa 001',
      produto_lacrado: 'SIM',
      numero_lote: 'LOTE 1',
    });

    expect(resB.sucesso).toBe(false);
    expect(resB.erro).toBe(
      'CAIXA BLOQUEADA: Não é permitido misturar produtos com NFOrigem Samsung diferentes na mesma caixa.'
    );

    // Validação direta da função validarCompatibilidadeCaixa
    const validacao = db.validarCompatibilidadeCaixa({
      caixa: 'Caixa 001',
      classificacao: 'PRODUTO NA LISTA - SAMSUNG',
      produto_lacrado: 'SIM',
      nf_origem_samsung: '67890',
    });
    expect(validacao.compativel).toBe(false);
    expect(validacao.erro).toBe(
      'CAIXA BLOQUEADA: Não é permitido misturar produtos com NFOrigem Samsung diferentes na mesma caixa.'
    );
  });

  // =========================================================================
  // Teste 5: Sincronização mantém IMEI, Regional e NFOrigem Samsung
  // =========================================================================
  it('Teste 5: Sincronização online mantém IMEI, Regional e NFOrigem Samsung intactos', async () => {
    // 1. Inserir produto auditado com Regional e NFOrigem Samsung
    const res = db.inserirProduto({
      modelo_produto: 'GALAXY S24 PLUS',
      sku: 'SM-S926B',
      serial: '355555555555555',
      imei: '355555555555555',
      numero_caixa: 'Caixa 05',
      produto_lacrado: 'SIM',
      regional: 'VIA VAREJO PR',
      nf_origem_samsung: 'NF-PR-8888',
      numero_nf: 'NF-PR-8888',
      origin_invoice: 'NF-PR-8888',
      numero_lote: 'LOTE 1',
    });
    expect(res.sucesso).toBe(true);

    const prodLocal = res.produto!;
    expect(prodLocal.imei).toBe('355555555555555');
    expect(prodLocal.regional).toBe('VIA VAREJO PR');
    expect(prodLocal.nf_origem_samsung).toBe('NF-PR-8888');

    // 2. Simular payload enviado para api/central/sync
    let jsonEnviado: any = null;
    let statusCode: number = 200;

    const reqMock: any = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        produtos: [prodLocal],
        usuario: adminUser,
        regional: 'VIA VAREJO PR',
      },
    };

    const resMock: any = {
      status: (code: number) => {
        statusCode = code;
        return resMock;
      },
      json: (data: any) => {
        jsonEnviado = data;
        return resMock;
      },
      setHeader: () => {},
    };

    await syncHandler(reqMock, resMock);

    expect(statusCode).toBe(200);
    expect(jsonEnviado?.sucesso).toBe(true);

    // Confirmar que o produto preservado na base central mantém IMEI, Regional e NFOrigem Samsung
    const prodCentral = jsonEnviado?.produtosCentral?.find(
      (p: any) => p.serial === '355555555555555' || p.imei === '355555555555555'
    );
    expect(prodCentral).toBeDefined();
    expect(prodCentral.imei).toBe('355555555555555');
    expect(prodCentral.regional).toBe('VIA VAREJO PR');
    expect(prodCentral.nf_origem_samsung).toBe('NF-PR-8888');
  });

  // =========================================================================
  // Teste Adicional: Sync central bloqueia se tentar sincronizar caixa mista
  // =========================================================================
  it('Sync Central bloqueia com HTTP 409 se caixa contiver NFOrigem Samsung divergentes', async () => {
    let statusCode: number = 200;
    let jsonEnviado: any = null;

    const reqMock: any = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        produtos: [
          {
            serial: '356666666666661',
            imei: '356666666666661',
            numero_caixa: 'Caixa 10',
            nf_origem_samsung: 'NF-AAA',
            produto_lacrado: 'SIM',
            regional: 'VIA VAREJO SP',
          },
          {
            serial: '356666666666662',
            imei: '356666666666662',
            numero_caixa: 'Caixa 10',
            nf_origem_samsung: 'NF-BBB', // Divergente!
            produto_lacrado: 'SIM',
            regional: 'VIA VAREJO SP',
          },
        ],
        usuario: adminUser,
        regional: 'VIA VAREJO SP',
      },
    };

    const resMock: any = {
      status: (code: number) => {
        statusCode = code;
        return resMock;
      },
      json: (data: any) => {
        jsonEnviado = data;
        return resMock;
      },
      setHeader: () => {},
    };

    await syncHandler(reqMock, resMock);

    expect(statusCode).toBe(409);
    expect(jsonEnviado?.sucesso).toBe(false);
    expect(jsonEnviado?.erro).toBe(
      'CAIXA BLOQUEADA: Não é permitido misturar produtos com NFOrigem Samsung diferentes na mesma caixa.'
    );
  });
});

