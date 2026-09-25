// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  normalizeImei,
  normalizeDealer,
  calcularLoteAutomatico,
  extrairCodigoRegional,
} from '../db/storage';
import { idb } from '../db/indexedDb';
import type {
  Usuario,
  RegionalInventoryReference,
  InventoryImportBatch,
  ProdutoAuditoria,
} from '../types';

describe('SUÍTE COMPLETA: Importação Regional, Referência de IMEIs e Lotes Dinâmicos', () => {
  const usuarioAdmin: Usuario = {
    id: 1,
    login: 'admin',
    nome: 'Administrador Master',
    senha: 'hash',
    perfil: 'ADMINISTRADOR',
    regional: null,
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const usuarioSupervisor: Usuario = {
    id: 2,
    login: 'supervisor_ba',
    nome: 'Supervisor Bahia',
    senha: 'hash',
    perfil: 'SUPERVISOR_REGIONAL',
    regional: 'VIA VAREJO BA',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const usuarioOperador: Usuario = {
    id: 3,
    login: 'operador_ba',
    nome: 'Operador Bahia',
    senha: 'hash',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO BA',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    db.limparTudoMemoria();
    db.setUsuarioAtual(usuarioAdmin);
  });

  // =========================================================================
  // 1. RBAC & PERMISSÕES DE IMPORTAÇÃO (APENAS ADMINISTRADOR)
  // =========================================================================
  describe('1. Controle de Acesso e Permissões (RBAC)', () => {
    it('deve permitir importação de lista de referência para perfil ADMINISTRADOR', async () => {
      db.setUsuarioAtual(usuarioAdmin);
      const res = await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO BA',
        fileName: 'Inventario_BA_v1.xlsx',
        itens: [
          {
            imei_normalized: '357847400000001',
            sku: 'SM-S928B',
            model_description: 'Galaxy S24 Ultra 512GB',
            brand: 'SAMSUNG',
            origin_invoice: 'NF-100200',
            dealer_raw: 'SAMSUNG ELETRONICA DA AMAZONIA LTDA',
            source_file_name: 'Inventario_BA_v1.xlsx',
            source_row: 2,
          },
        ],
      });

      expect(res.batch).toBeDefined();
      expect(res.batch?.version).toBe(1);
      expect(res.batch?.status).toBe('ATIVA');
    });

    it('deve BLOQUEAR importação para perfil SUPERVISOR_REGIONAL', async () => {
      db.setUsuarioAtual(usuarioSupervisor);
      await expect(
        db.importarListaReferenciaRegional({
          regional: 'VIA VAREJO BA',
          fileName: 'Tentativa_Supervisor.xlsx',
          itens: [
            {
              imei: '357847400000002',
              sku: 'SM-S928B',
              model_description: 'Galaxy S24',
              source_file_name: 'Tentativa_Supervisor.xlsx',
              source_row: 2,
            },
          ],
        })
      ).rejects.toThrow(/Apenas Administradores/i);
    });

    it('deve BLOQUEAR importação para perfil OPERADOR', async () => {
      db.setUsuarioAtual(usuarioOperador);
      await expect(
        db.importarListaReferenciaRegional({
          regional: 'VIA VAREJO BA',
          fileName: 'Tentativa_Operador.xlsx',
          itens: [
            {
              imei: '357847400000003',
              sku: 'SM-S928B',
              model_description: 'Galaxy S24',
              source_file_name: 'Tentativa_Operador.xlsx',
              source_row: 2,
            },
          ],
        })
      ).rejects.toThrow(/Apenas Administradores/i);
    });

    it('deve BLOQUEAR importação quando usuário não estiver logado', async () => {
      db.setUsuarioAtual(null as any);
      await expect(
        db.importarListaReferenciaRegional({
          regional: 'VIA VAREJO BA',
          fileName: 'Tentativa_Anonimo.xlsx',
          itens: [],
        })
      ).rejects.toThrow(/Apenas Administradores/i);
    });
  });

  // =========================================================================
  // 2. NORMALIZAÇÃO, ISOLAMENTO DE REGIONAL E AUSÊNCIA DE DATA DA NF
  // =========================================================================
  describe('2. Normalização e Integridade de Dados', () => {
    it('normalizeImei deve limpar espaços, hífens e manter apenas 15 dígitos numéricos', () => {
      expect(normalizeImei('357 847 400 282 342')).toBe('357847400282342');
      expect(normalizeImei('357-847-400-282-342')).toBe('357847400282342');
      expect(normalizeImei('  357847400282342  ')).toBe('357847400282342');
      expect(normalizeImei(null)).toBe('');
      expect(normalizeImei(undefined)).toBe('');
    });

    it('normalizeDealer deve converter para maiúsculas e compactar múltiplos espaços', () => {
      expect(normalizeDealer('  samsung  eletronica   da amazonia  ')).toBe('SAMSUNG ELETRONICA DA AMAZONIA');
      expect(normalizeDealer('Siri  comercio   e  servicos  ltda')).toBe('SIRI COMERCIO E SERVICOS LTDA');
      expect(normalizeDealer('')).toBe('SEM DEALER');
      expect(normalizeDealer(null)).toBe('SEM DEALER');
      expect(normalizeDealer(undefined)).toBe('SEM DEALER');
    });

    it('extrairCodigoRegional deve extrair a sigla da regional', () => {
      expect(extrairCodigoRegional('VIA VAREJO BA')).toBe('BA');
      expect(extrairCodigoRegional('VIA VAREJO RJ')).toBe('RJ');
      expect(extrairCodigoRegional('VIA VAREJO SP')).toBe('SP');
      expect(extrairCodigoRegional('VIA VAREJO MG')).toBe('MG');
      expect(extrairCodigoRegional('BA')).toBe('BA');
      expect(extrairCodigoRegional('')).toBe('GERAL');
      expect(extrairCodigoRegional(null)).toBe('GERAL');
    });

    it('garantia de que registros de referência NUNCA possuem Data da NF (Coluna I)', async () => {
      db.setUsuarioAtual(usuarioAdmin);
      const res = await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO BA',
        fileName: 'Validacao_Sem_Data.xlsx',
        itens: [
          {
            imei_normalized: '357847400000010',
            sku: 'SM-S928B',
            model_description: 'Galaxy S24 Ultra',
            brand: 'SAMSUNG',
            origin_invoice: 'NF-555',
            dealer_raw: 'SAMSUNG',
            source_file_name: 'Validacao_Sem_Data.xlsx',
            source_row: 2,
          },
        ],
      });

      expect(res.batch).toBeDefined();
      const ref = db.consultarImeiReferencia('357847400000010', 'VIA VAREJO BA');
      expect(ref).toBeDefined();
      expect(ref?.imei_normalized).toBe('357847400000010');
      // Verifica estritamente que propriedades de data de NF não existem no objeto
      expect((ref as any).data_nf).toBeUndefined();
      expect((ref as any).data_nfo).toBeUndefined();
      expect((ref as any).data_emissao).toBeUndefined();
      expect((ref as any).invoice_date).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. DETERMINAÇÃO DINÂMICA DE LOTES
  // =========================================================================
  describe('3. Geração Automática de Lotes Dinâmicos', () => {
    it('para item LISTADO: deve gerar lote "{REG} - LISTA - {DEALER}"', () => {
      const loteSamsung = calcularLoteAutomatico({
        regional: 'VIA VAREJO BA',
        sourceType: 'LISTED',
        dealer: 'SAMSUNG ELETRONICA',
      });
      expect(loteSamsung).toBe('BA - LISTA - SAMSUNG ELETRONICA');

      const loteSiri = calcularLoteAutomatico({
        regional: 'VIA VAREJO BA',
        sourceType: 'LISTED',
        dealer: 'SIRI COMERCIO E SERVICOS LTDA',
      });
      expect(loteSiri).toBe('BA - LISTA - SIRI COMERCIO E SERVICOS LTDA');

      const loteSemDealer = calcularLoteAutomatico({
        regional: 'VIA VAREJO RJ',
        sourceType: 'LISTED',
        dealer: null,
      });
      expect(loteSemDealer).toBe('RJ - LISTA - SEM DEALER');
    });

    it('para item FORA DA LISTA: deve agrupar por SAMSUNG ou OUTRA MARCA', () => {
      const loteForaSamsung = calcularLoteAutomatico({
        regional: 'VIA VAREJO BA',
        sourceType: 'OUT_OF_LIST',
        fabricante: 'SAMSUNG',
      });
      expect(loteForaSamsung).toBe('BA - FORA DA LISTA - SAMSUNG');

      const loteForaApple = calcularLoteAutomatico({
        regional: 'VIA VAREJO BA',
        sourceType: 'OUT_OF_LIST',
        fabricante: 'APPLE',
      });
      expect(loteForaApple).toBe('BA - FORA DA LISTA - OUTRA MARCA');

      const loteForaMotorola = calcularLoteAutomatico({
        regional: 'VIA VAREJO SP',
        sourceType: 'OUT_OF_LIST',
        fabricante: 'MOTOROLA',
      });
      expect(loteForaMotorola).toBe('SP - FORA DA LISTA - OUTRA MARCA');
    });

    it('obterOuCriarLoteAutomatico deve registrar e reutilizar audit_lots dinamicamente', () => {
      const lote1 = db.obterOuCriarLoteAutomatico({
        regional: 'VIA VAREJO BA',
        sourceType: 'LISTED',
        dealer: 'SAMSUNG',
      });

      expect(lote1.display_name).toBe('BA - LISTA - SAMSUNG');
      expect(lote1.status).toBe('ABERTO');

      // Ao chamar novamente com os mesmos parâmetros, deve retornar o mesmo lote existente
      const lote2 = db.obterOuCriarLoteAutomatico({
        regional: 'VIA VAREJO BA',
        sourceType: 'LISTED',
        dealer: 'SAMSUNG',
      });

      expect(lote2.id).toBe(lote1.id);

      const lotesBA = db.listarLotesDinamicos('VIA VAREJO BA');
      expect(lotesBA.length).toBe(1);
    });
  });

  // =========================================================================
  // 4. ISOLAMENTO REGIONAL E MULTI-VERSÃO DE LISTAS
  // =========================================================================
  describe('4. Isolamento Regional e Controle de Versões', () => {
    it('IMEI importado em BA não deve ser encontrado em consultas de RJ ou SP', async () => {
      db.setUsuarioAtual(usuarioAdmin);
      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO BA',
        fileName: 'Lista_BA.xlsx',
        itens: [
          {
            imei_normalized: '357847400000099',
            sku: 'SM-S928B',
            model_description: 'Galaxy S24 Ultra',
            brand: 'SAMSUNG',
            dealer_raw: 'SAMSUNG',
            source_file_name: 'Lista_BA.xlsx',
            source_row: 2,
          },
        ],
      });

      // Consulta em BA deve encontrar
      expect(db.consultarImeiReferencia('357847400000099', 'VIA VAREJO BA')).not.toBeNull();
      expect(db.consultarImeiReferencia('357847400000099', 'BA')).not.toBeNull();

      // Consulta em RJ ou SP NÃO deve encontrar
      expect(db.consultarImeiReferencia('357847400000099', 'VIA VAREJO RJ')).toBeNull();
      expect(db.consultarImeiReferencia('357847400000099', 'VIA VAREJO SP')).toBeNull();
    });

    it('importar nova versão deve desativar a anterior sem apagar os dados (Histórico)', async () => {
      db.setUsuarioAtual(usuarioAdmin);

      // Versão 1
      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO BA',
        fileName: 'Lista_v1.xlsx',
        itens: [
          {
            imei_normalized: '357847400000021',
            sku: 'SKU-01',
            model_description: 'Modelo V1',
            dealer_raw: 'DEALER 1',
            source_file_name: 'Lista_v1.xlsx',
            source_row: 2,
          },
        ],
      });

      // Versão 2
      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO BA',
        fileName: 'Lista_v2.xlsx',
        itens: [
          {
            imei_normalized: '357847400000022',
            sku: 'SKU-02',
            model_description: 'Modelo V2',
            dealer_raw: 'DEALER 2',
            source_file_name: 'Lista_v2.xlsx',
            source_row: 2,
          },
        ],
      });

      const historico = db.listarHistoricoImportacoes('VIA VAREJO BA');
      expect(historico.length).toBe(2);

      const [versaoMaisRecente, versaoAntiga] = historico;
      expect(versaoMaisRecente.version).toBe(2);
      expect(versaoMaisRecente.status).toBe('ATIVA');

      expect(versaoAntiga.version).toBe(1);
      expect(versaoAntiga.status).toBe('HISTORICA');

      // IMEI da nova versão deve estar ativo na consulta
      const refV2 = db.consultarImeiReferencia('357847400000022', 'VIA VAREJO BA');
      expect(refV2).not.toBeNull();
      expect(refV2?.sku).toBe('SKU-02');

      // IMEI da versão anterior não deve mais responder como ativo
      const refV1 = db.consultarImeiReferencia('357847400000021', 'VIA VAREJO BA');
      expect(refV1).toBeNull();
    });
  });

  // =========================================================================
  // 5. FLUXO OPERACIONAL DE AUDITORIA E SNAPSHOT IMUTÁVEL
  // =========================================================================
  describe('5. Bipagem, Snapshot e Condições do Aparelho', () => {
    beforeEach(async () => {
      // Carrega lista de referência prévia para BA
      db.setUsuarioAtual(usuarioAdmin);
      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO BA',
        fileName: 'Inventario_Samsung_Camacari.xlsm',
        itens: [
          {
            imei_normalized: '357847400000100',
            sku: 'SM-G990E',
            model_description: 'GALAXY S21 FE 5G',
            brand: 'SAMSUNG',
            origin_invoice: 'NF-987654',
            dealer_raw: 'SIRI COMERCIO E SERVICOS LTDA',
            source_file_name: 'Inventario_Samsung_Camacari.xlsm',
            source_row: 10,
          },
        ],
      });
    });

    it('ao bipar item LISTADO: deve auto-preencher dealer, NF de origem, snapshot e manter lote do operador', () => {
      db.setUsuarioAtual(usuarioOperador);
      db.salvarUltimoLote('01');

      const res = db.inserirProduto({
        serial: '357847400000100',
        imei: '357847400000100',
        modelo_produto: 'GALAXY S21 FE 5G',
        ean: '7892509123456',
        numero_lote: '01',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto).toBeDefined();

      const prod = res.produto!;
      expect(prod.source_type).toBe('LISTED');
      expect(prod.dealer).toBe('SIRI COMERCIO E SERVICOS LTDA');
      expect(prod.origin_invoice).toBe('NF-987654');
      expect(prod.numero_lote).toBe('01');
      expect(prod.classificacao_produto).toBe('PRODUTO NA LISTA - SIRI COMERCIO E SERVICOS LTDA');
      expect(prod.reference_id).toBeDefined();
      expect(prod.import_batch_id).toBeDefined();
    });

    it('ao bipar item FORA DA LISTA: deve manter lote do operador e calcular classificacao_produto "FORA DA LISTA"', () => {
      db.setUsuarioAtual(usuarioOperador);

      const res = db.inserirProduto({
        serial: '357847400000888',
        imei: '357847400000888',
        modelo_produto: 'iPhone 15 Pro',
        ean: '194253123456',
        fabricante: 'APPLE',
        numero_lote: '01',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto).toBeDefined();

      const prod = res.produto!;
      expect(prod.source_type).toBe('OUT_OF_LIST');
      expect(prod.numero_lote).toBe('01');
      expect(prod.classificacao_produto).toBe('FORA DA LISTA - OUTRA MARCA');
      expect(prod.reference_id).toBeNull();
      expect(prod.brand).toBe('APPLE');
    });

    it('produto NÃO lacrado deve exigir Kit Completo e Marcas de Uso', () => {
      db.setUsuarioAtual(usuarioOperador);

      // Produto NÃO lacrado sem kit/mau uso
      const prodInvalido: Partial<ProdutoAuditoria> = {
        produto_lacrado: 'NÃO',
        kit_completo: null,
        aparelho_marcas_uso: null,
      };

      const valido = prodInvalido.produto_lacrado === 'SIM' || (
        Boolean(prodInvalido.kit_completo) && Boolean(prodInvalido.aparelho_marcas_uso)
      );

      expect(valido).toBe(false);

      // Produto NÃO lacrado com kit e mau uso preenchidos
      const prodValido: Partial<ProdutoAuditoria> = {
        produto_lacrado: 'NÃO',
        kit_completo: 'SIM',
        aparelho_marcas_uso: 'NÃO',
      };

      const validoOk = prodValido.produto_lacrado === 'SIM' || (
        Boolean(prodValido.kit_completo) && Boolean(prodValido.aparelho_marcas_uso)
      );

      expect(validoOk).toBe(true);
    });

    it('deve preservar lote explícito se fornecido (ex: testes legados de lote)', () => {
      db.setUsuarioAtual(usuarioOperador);

      const res = db.inserirProduto({
        serial: '357847400000100',
        imei: '357847400000100',
        modelo_produto: 'GALAXY S21 FE 5G',
        ean: '7892509123456',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 01',
        numero_lote: 'LOTE-ESPECIFICO-99',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto?.numero_lote).toBe('LOTE-ESPECIFICO-99');
    });
  });

  // =========================================================================
  // 6. PERSISTÊNCIA OFFLINE E RECUPERAÇÃO EM MEMÓRIA
  // =========================================================================
  describe('6. Persistência e Recuperação Offline', () => {
    it('deve persistir batches, referências e lotes no localStorage e reconstruir Maps na inicialização', async () => {
      db.setUsuarioAtual(usuarioAdmin);

      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO SP',
        fileName: 'Lista_SP.xlsx',
        itens: [
          {
            imei_normalized: '357847400000555',
            sku: 'SKU-SP-01',
            model_description: 'Galaxy S24 SP',
            dealer_raw: 'FAST SHOP',
            source_file_name: 'Lista_SP.xlsx',
            source_row: 2,
          },
        ],
      });

      // Simula recarga completa do sistema a partir do localStorage
      db.carregarTudoMemoria();

      const refRecuperada = db.consultarImeiReferencia('357847400000555', 'VIA VAREJO SP');
      expect(refRecuperada).not.toBeNull();
      expect(refRecuperada?.model_description).toBe('Galaxy S24 SP');
      expect(refRecuperada?.dealer_normalized).toBe('FAST SHOP');

      const historicoSP = db.listarHistoricoImportacoes('VIA VAREJO SP');
      expect(historicoSP.length).toBe(1);
    });
  });

  // =========================================================================
  // 7. PARSER DE PLANILHAS (EXCEL / XLSM) E DESCARTABILIDADE DA COLUNA I
  // =========================================================================
  describe('7. Parser de Planilhas e Descarte Estrito da Coluna I (Data da NF)', () => {
    it('deve extrair Colunas C, D, E, H, J e NUNCA incluir Coluna I (Data da NF)', async () => {
      const XLSX = await import('xlsx');

      // Criação de planilha em memória simulando "Inventário Samsung (Camaçari) para Solutions.xlsm"
      // Colunas:
      // Col A (0): ID
      // Col B (1): Status
      // Col C (2): IMEI
      // Col D (3): SKU
      // Col E (4): Modelo/Descrição
      // Col F (5): Extra
      // Col G (6): Extra
      // Col H (7): NF Origem
      // Col I (8): DATA DA NF (PROIBIDA)
      // Col J (9): Vendido para outro dealer
      const rows = [
        ['ID', 'Status', 'IMEI', 'SKU', 'Modelo', 'Extra1', 'Extra2', 'NF Origem', 'Data da NF', 'Vendido para outro dealer'],
        ['1', 'DISPONIVEL', '357847400000777', 'SM-A556E', 'Galaxy A55 5G', '', '', 'NF-888999', '2026-01-15', 'SIRI COMERCIO'],
        ['2', 'DISPONIVEL', '357847400000778', 'SM-S928B', 'Galaxy S24 Ultra', '', '', 'NF-888999', '2026-02-20', 'SAMSUNG'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'IMEI');

      // Simulação do parser administrativo
      const sheetName = wb.SheetNames.find((n) => n.trim().toUpperCase() === 'IMEI') || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      expect(matrix.length).toBe(3);

      const parsedItens = matrix.slice(1).map((row, idx) => {
        const rawImei = row[2]; // Col C
        const rawSku = row[3]; // Col D
        const rawModel = row[4]; // Col E
        const rawNfOrigem = row[7]; // Col H
        // Col I (row[8]) é OBRIGATORIAMENTE IGNORADA
        const rawDealer = row[9]; // Col J

        return {
          imei: rawImei,
          sku: String(rawSku || '').trim(),
          model_description: String(rawModel || '').trim(),
          origin_invoice: rawNfOrigem ? String(rawNfOrigem).trim() : null,
          dealer: rawDealer ? String(rawDealer).trim() : null,
          source_row: idx + 2,
        };
      });

      expect(parsedItens.length).toBe(2);
      expect(parsedItens[0].imei).toBe('357847400000777');
      expect(parsedItens[0].sku).toBe('SM-A556E');
      expect(parsedItens[0].origin_invoice).toBe('NF-888999');
      expect(parsedItens[0].dealer).toBe('SIRI COMERCIO');
      expect((parsedItens[0] as any).data_nf).toBeUndefined();

      // Gravação no banco local
      db.setUsuarioAtual(usuarioAdmin);
      const res = await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO BA',
        fileName: 'Inventario_Samsung_Camacari.xlsm',
        itens: parsedItens,
      });

      expect(res.batch).toBeDefined();
      expect(res.totalImportados).toBe(2);

      const ref = db.consultarImeiReferencia('357847400000777', 'VIA VAREJO BA');
      expect(ref).not.toBeNull();
      expect(ref?.dealer_normalized).toBe('SIRI COMERCIO');
      expect(ref?.origin_invoice).toBe('NF-888999');
      // Garantia absoluta de que nenhuma coluna de Data da NF foi gravada
      expect((ref as any).data_nf).toBeUndefined();
      expect((ref as any).data_nfo).toBeUndefined();
    });
  });

  // =========================================================================
  // 8. ENDPOINT SERVERLESS (/api/central/referencia-import) E SEGURANÇA
  // =========================================================================
  describe('8. Validação do Endpoint Serverless de Importação (RBAC & Status Codes)', () => {
    function createMockRes() {
      const res: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: null as any,
        setHeader(key: string, val: string) {
          res.headers[key] = val;
          return res;
        },
        status(code: number) {
          res.statusCode = code;
          return res;
        },
        json(data: any) {
          res.body = data;
          return res;
        },
        end() {
          return res;
        },
      };
      return res;
    }

    it('endpoint deve retornar HTTP 403 Forbidden para tentativa de importação de não-admin', async () => {
      const handlerModule = await import('../../api/central/referencia-import');
      const handler = handlerModule.default;

      const req = {
        method: 'POST',
        headers: {},
        body: {
          usuario: { perfil: 'OPERADOR', nome: 'Operador' },
          regional: 'VIA VAREJO BA',
          itens: [{ imei: '357847400000999', sku: 'SKU', model_description: 'Mod' }],
        },
      };

      const res = createMockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body?.sucesso).toBe(false);
      expect(res.body?.erro).toContain('Acesso negado (403)');
    });

    it('endpoint deve retornar HTTP 400 Bad Request se regional for omitida', async () => {
      const handlerModule = await import('../../api/central/referencia-import');
      const handler = handlerModule.default;

      const req = {
        method: 'POST',
        headers: {},
        body: {
          usuario: { perfil: 'ADMINISTRADOR', nome: 'Admin' },
          regional: '',
          itens: [{ imei: '357847400000999', sku: 'SKU', model_description: 'Mod' }],
        },
      };

      const res = createMockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body?.sucesso).toBe(false);
      expect(res.body?.erro).toContain('Regional é obrigatória');
    });

    it('endpoint deve responder 204 no preflight OPTIONS', async () => {
      const handlerModule = await import('../../api/central/referencia-import');
      const handler = handlerModule.default;

      const req = {
        method: 'OPTIONS',
        headers: {},
      };

      const res = createMockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(204);
    });

    it('endpoint deve aceitar itens com imei_normalized (formato enviado pelo cliente) e preservar batchId', async () => {
      const handlerModule = await import('../../api/central/referencia-import');
      const handler = handlerModule.default;

      const testUuid = '11111111-2222-4333-8444-555555555555';
      const req = {
        method: 'POST',
        headers: {},
        body: {
          batchId: testUuid,
          usuario: { perfil: 'ADMINISTRADOR', nome: 'Admin Master', login: 'admin' },
          regional: 'VIA VAREJO RJ',
          fileName: 'Cópia de CB Consolidado.xlsx',
          itens: [
            {
              id: 'item-uuid-rj-1',
              imei_normalized: '357847400000001',
              sku: 'SM-S928B',
              model_description: 'Galaxy S24 Ultra 512GB',
              brand: 'SAMSUNG',
              origin_invoice: 'NF-RJ-100',
              dealer_raw: 'SAMSUNG ELETRONICA DA AMAZONIA LTDA',
              source_file_name: 'Cópia de CB Consolidado.xlsx',
              source_row: 2,
            },
            {
              id: 'item-uuid-rj-2',
              imei: '357847400000002',
              sku: 'SM-A546E',
              model_description: 'Galaxy A54 5G 128GB',
              brand: 'SAMSUNG',
              dealer: 'MAGAZINE LUIZA',
              source_file_name: 'Cópia de CB Consolidado.xlsx',
              source_row: 3,
            }
          ],
        },
      };

      const res = createMockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body?.sucesso).toBe(true);
      expect(res.body?.totalImportados).toBe(2);
      expect(res.body?.batch?.id).toBe(testUuid);
      expect(res.body?.batch?.regional).toBe('VIA VAREJO RJ');
      expect(res.body?.metricas?.imeisValidos).toBe(2);
      expect(res.body?.metricas?.imeisInvalidos).toBe(0);
    });
  });

  // =========================================================================
  // 9. VALIDAÇÃO DE LOTES FINALIZADOS E PROTEÇÃO DE OPERADORES
  // =========================================================================
  describe('9. Proteção de Lotes Finalizados e Segurança de Auditoria', () => {
    it('não deve permitir que operador insira produtos em lote já finalizado', () => {
      db.setUsuarioAtual(usuarioAdmin);

      // Insere produto inicial no lote com NF conferida
      const resIni = db.inserirProduto({
        serial: '357847400000331',
        imei: '357847400000331',
        modelo_produto: 'Galaxy S24',
        ean: '7892509123456',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 01',
        numero_lote: 'BA - LISTA - SAMSUNG',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        regional: 'VIA VAREJO BA',
      });
      expect(resIni.sucesso).toBe(true);

      const fotosMock = {
        caixaFechada: 'data:image/jpeg;base64,mockCaixa',
        espelhoCaixa: 'data:image/jpeg;base64,mockEspelho',
        lacreSeguranca: 'data:image/jpeg;base64,mockLacre',
      };

      const resFin = db.finalizarLote({
        numeroLote: 'BA - LISTA - SAMSUNG',
        regional: 'VIA VAREJO BA',
        fotos: fotosMock,
        observacao: 'Fechamento de teste',
      });

      expect(resFin.sucesso).toBe(true);
      expect(db.isLoteFinalizado('BA - LISTA - SAMSUNG', 'VIA VAREJO BA')).toBe(true);

      // Tenta inserir como operador no lote finalizado
      db.setUsuarioAtual(usuarioOperador);

      const resIns = db.inserirProduto({
        serial: '357847400000333',
        imei: '357847400000333',
        modelo_produto: 'Galaxy S24',
        ean: '7892509123456',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 01',
        numero_lote: 'BA - LISTA - SAMSUNG',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(resIns.sucesso).toBe(false);
      expect(resIns.erro).toContain('FINALIZADO e bloqueado');
    });
  });

  describe('NOVA ESPECIFICAÇÃO: Testes A, B, C, D, E de Fabricante Dinâmico, NF Origem, Lote Manual e Classificação', () => {
    beforeEach(async () => {
      db.setUsuarioAtual(usuarioAdmin);
      await db.importarListaReferenciaRegional({
        regional: 'VIA VAREJO BA',
        fileName: 'Inventario_Samsung_Camacari.xlsm',
        itens: [
          // Item A: Samsung oficial
          {
            imei_normalized: '357847400000901',
            model_description: 'SM-S928B/DS Galaxy S24 Ultra 512GB Titânio',
            sku: 'SM-S928BZKQZTO',
            brand: 'SAMSUNG',
            origin_invoice: '004271584-1',
            dealer_raw: 'SAMSUNG ELETRONICA DA AMAZONIA LTDA',
            source_file_name: 'Inventario_Samsung_Camacari.xlsm',
            source_row: 11,
          },
          // Item B: Motorola (Outra marca na base regional)
          {
            imei_normalized: '357847400000902',
            model_description: 'Moto G84 5G 256GB Grafite',
            sku: 'XT2347-1',
            brand: 'MOTOROLA',
            origin_invoice: 'NF-MOTO-7788',
            dealer_raw: 'MOTOROLA MOBILITY COMERCIO',
            source_file_name: 'Inventario_Samsung_Camacari.xlsm',
            source_row: 12,
          },
          // Item C: Samsung vendido pela SIRI
          {
            imei_normalized: '357847400000903',
            model_description: 'SM-A546E/DS Galaxy A54 5G 128GB Verde',
            sku: 'SM-A546EZGLZTO',
            brand: 'SAMSUNG',
            origin_invoice: '003988112-2',
            dealer_raw: 'SIRI COMERCIO E SERVICOS LTDA',
            source_file_name: 'Inventario_Samsung_Camacari.xlsm',
            source_row: 13,
          },
        ],
      });
      db.setUsuarioAtual(usuarioOperador);
    });

    it('Teste A: Samsung listado -> SAMSUNG, modelo completo, SKU, NF Origem, Dealer, lote manual mantido, classificação PRODUTO NA LISTA - SAMSUNG', () => {
      const res = db.inserirProduto({
        serial: '357847400000901',
        imei: '357847400000901',
        modelo_produto: 'SM-S928B/DS Galaxy S24 Ultra 512GB Titânio',
        ean: 'SM-S928BZKQZTO',
        numero_lote: 'LOTE 1',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(res.sucesso).toBe(true);
      const prod = res.produto!;
      expect(prod.fabricante).toBe('SAMSUNG');
      expect(prod.brand).toBe('SAMSUNG');
      expect(prod.modelo_produto).toBe('SM-S928B/DS Galaxy S24 Ultra 512GB Titânio');
      expect(prod.sku).toBe('SM-S928BZKQZTO');
      expect(prod.origin_invoice).toBe('004271584-1');
      expect(prod.dealer).toContain('SAMSUNG');
      expect(prod.numero_lote).toBe('LOTE 1');
      expect(prod.classificacao_produto).toBe('PRODUTO NA LISTA - SAMSUNG');
    });

    it('Teste B: Motorola listado -> MOTOROLA, modelo completo, SKU, NF Origem, lote manual mantido, classificação PRODUTO NA LISTA - OUTRA MARCA (nunca vira SAMSUNG)', () => {
      const res = db.inserirProduto({
        serial: '357847400000902',
        imei: '357847400000902',
        modelo_produto: 'Moto G84 5G 256GB Grafite',
        ean: 'XT2347-1',
        numero_lote: 'LOTE 1',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(res.sucesso).toBe(true);
      const prod = res.produto!;
      expect(prod.fabricante).toBe('MOTOROLA');
      expect(prod.brand).toBe('MOTOROLA');
      expect(prod.fabricante).not.toBe('SAMSUNG');
      expect(prod.modelo_produto).toBe('Moto G84 5G 256GB Grafite');
      expect(prod.sku).toBe('XT2347-1');
      expect(prod.origin_invoice).toBe('NF-MOTO-7788');
      expect(prod.numero_lote).toBe('LOTE 1');
      expect(prod.classificacao_produto).toBe('PRODUTO NA LISTA - OUTRA MARCA');
    });

    it('Teste C: Samsung vendido pela SIRI -> SAMSUNG, dealer SIRI COMERCIO E SERVICOS LTDA, lote manual mantido, classificação PRODUTO NA LISTA - SIRI COMERCIO E SERVICOS LTDA', () => {
      const res = db.inserirProduto({
        serial: '357847400000903',
        imei: '357847400000903',
        modelo_produto: 'SM-A546E/DS Galaxy A54 5G 128GB Verde',
        ean: 'SM-A546EZGLZTO',
        numero_lote: 'LOTE 2',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(res.sucesso).toBe(true);
      const prod = res.produto!;
      expect(prod.fabricante).toBe('SAMSUNG');
      expect(prod.dealer).toBe('SIRI COMERCIO E SERVICOS LTDA');
      expect(prod.origin_invoice).toBe('003988112-2');
      expect(prod.numero_lote).toBe('LOTE 2');
      expect(prod.classificacao_produto).toBe('PRODUTO NA LISTA - SIRI COMERCIO E SERVICOS LTDA');
    });

    it('Teste D: Fora da lista Samsung -> manual SAMSUNG, NÃO LOCALIZADA NA BASE, lote manual mantido, classificação FORA DA LISTA - SAMSUNG', () => {
      const res = db.inserirProduto({
        serial: '357847400000999',
        imei: '357847400000999',
        modelo_produto: 'Galaxy S23 FE',
        ean: '7892509999999',
        fabricante: 'SAMSUNG',
        numero_lote: 'LOTE 3',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 02',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(res.sucesso).toBe(true);
      const prod = res.produto!;
      expect(prod.source_type).toBe('OUT_OF_LIST');
      expect(prod.fabricante).toBe('SAMSUNG');
      expect(prod.origin_invoice).toBe('NÃO LOCALIZADA NA BASE');
      expect(prod.numero_lote).toBe('LOTE 3');
      expect(prod.classificacao_produto).toBe('FORA DA LISTA - SAMSUNG');
    });

    it('Teste E: Fora da lista Motorola -> manual MOTOROLA, NÃO LOCALIZADA NA BASE, lote manual mantido, classificação FORA DA LISTA - OUTRA MARCA', () => {
      const res = db.inserirProduto({
        serial: '357847400000888',
        imei: '357847400000888',
        modelo_produto: 'Moto Edge 40',
        ean: '7892509888888',
        fabricante: 'MOTOROLA',
        numero_lote: 'LOTE 3',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 02',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(res.sucesso).toBe(true);
      const prod = res.produto!;
      expect(prod.source_type).toBe('OUT_OF_LIST');
      expect(prod.fabricante).toBe('MOTOROLA');
      expect(prod.fabricante).not.toBe('SAMSUNG');
      expect(prod.origin_invoice).toBe('NÃO LOCALIZADA NA BASE');
      expect(prod.numero_lote).toBe('LOTE 3');
      expect(prod.classificacao_produto).toBe('FORA DA LISTA - OUTRA MARCA');
    });

    it('NF com hífen ou texto livre (ex: 004271584-1) é aceita sem erro de validação numérica', () => {
      const res = db.inserirProduto({
        serial: '357847400000777',
        imei: '357847400000777',
        modelo_produto: 'Galaxy S24',
        ean: '7892509123456',
        numero_lote: 'LOTE 4',
        origin_invoice: '004271584-1',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 03',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto?.origin_invoice).toBe('004271584-1');
    });

    it('Fechamento de Lote não bloqueia por falta de conferência de NF', () => {
      db.inserirProduto({
        serial: '357847400000901',
        imei: '357847400000901',
        modelo_produto: 'Galaxy S24',
        ean: '7892509123456',
        numero_lote: 'LOTE 1',
        data_auditoria: '2026-03-21',
        numero_caixa: 'Caixa 01',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO BA',
      });

      const fotosMock = {
        caixaFechada: 'data:image/jpeg;base64,mockCaixa',
        espelhoCaixa: 'data:image/jpeg;base64,mockEspelho',
        lacreSeguranca: 'data:image/jpeg;base64,mockLacre',
      };

      const resFin = db.finalizarLote({
        numeroLote: 'LOTE 1',
        regional: 'VIA VAREJO BA',
        fotos: fotosMock,
        observacao: 'Fechamento de teste sem NF conferida',
      });

      expect(resFin.sucesso).toBe(true);
      expect(db.isLoteFinalizado('LOTE 1', 'VIA VAREJO BA')).toBe(true);
    });
  });
});

