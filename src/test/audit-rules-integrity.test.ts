// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  validarNumeroOuChaveNfe,
} from '../db/storage';
import { idb } from '../db/indexedDb';
import type { Usuario, FotosFechamentoLote } from '../types';

describe('GATE 6: Regras de Auditoria e Integridade Operacional', () => {
  const usuarioAdmin: Usuario = {
    id: 1,
    login: 'admin',
    nome: 'Administrador Geral',
    senha: 'hash',
    perfil: 'ADMINISTRADOR',
    regional: null,
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const usuarioOperadorRJ: Usuario = {
    id: 2,
    login: 'operador_rj',
    nome: 'Operador Rio',
    senha: 'hash',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const fotosValidas: FotosFechamentoLote = {
    caixaFechada: 'data:image/jpeg;base64,mockFotoCaixaFechada',
    espelhoCaixa: 'data:image/jpeg;base64,mockFotoEspelhoCaixa',
    lacreSeguranca: 'data:image/jpeg;base64,mockFotoLacreSeguranca',
  };

  beforeEach(async () => {
    localStorage.clear();
    db.limparTudoMemoria();
    db.setUsuarioAtual(usuarioAdmin);
  });

  describe('1. Capacidade de Caixa e Limite Rígido de 20 Itens (Gate 6.2)', () => {
    it('deve indicar que a caixa está incompleta com menos de 20 itens', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const caixa = 'CAIXA TESTE 01';

      for (let i = 1; i <= 5; i++) {
        const imei = `3578474000000${String(i).padStart(2, '0')}`;
        const res = db.inserirProduto({
          modelo_produto: 'Galaxy S24',
          ean: '7892509133456',
          serial: imei,
          numero_caixa: caixa,
          numero_lote: 'LOTE-CAP-01',
          data_auditoria: '2026-03-16',
          produto_lacrado: 'SIM',
          nf_conferida: 'SIM',
          regional: 'VIA VAREJO RJ',
        });
        expect(res.sucesso).toBe(true);
      }

      expect(db.obterTotalProdutosNaCaixa(caixa, 'VIA VAREJO RJ')).toBe(5);
      expect(db.isCaixaCompleta(caixa, 'VIA VAREJO RJ')).toBe(false);

      const statusFechamento = db.podeFecharCaixa(caixa, 'VIA VAREJO RJ');
      expect(statusFechamento.pode).toBe(false);
      expect(statusFechamento.motivo).toMatch(/incompleta/i);
    });

    it('deve aceitar exatamente 20 itens e marcar a caixa como completa', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const caixa = 'CAIXA TESTE 20';

      for (let i = 1; i <= 20; i++) {
        const imei = `3578474000100${String(i).padStart(2, '0')}`;
        const res = db.inserirProduto({
          modelo_produto: 'Galaxy S24',
          ean: '7892509133456',
          serial: imei,
          numero_caixa: caixa,
          numero_lote: 'LOTE-CAP-02',
          data_auditoria: '2026-03-16',
          produto_lacrado: 'SIM',
          nf_conferida: 'SIM',
          regional: 'VIA VAREJO RJ',
        });
        expect(res.sucesso).toBe(true);
      }

      expect(db.obterTotalProdutosNaCaixa(caixa, 'VIA VAREJO RJ')).toBe(20);
      expect(db.isCaixaCompleta(caixa, 'VIA VAREJO RJ')).toBe(true);

      const statusFechamento = db.podeFecharCaixa(caixa, 'VIA VAREJO RJ');
      expect(statusFechamento.pode).toBe(true);
      expect(statusFechamento.total).toBe(20);
    });

    it('deve bloquear rigidamente a inserção do 21º produto na mesma caixa', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const caixa = 'CAIXA TESTE BLOQUEIO';

      for (let i = 1; i <= 20; i++) {
        const imei = `3578474000200${String(i).padStart(2, '0')}`;
        db.inserirProduto({
          modelo_produto: 'Galaxy A55',
          ean: '7892509134125',
          serial: imei,
          numero_caixa: caixa,
          numero_lote: 'LOTE-CAP-03',
          data_auditoria: '2026-03-16',
          produto_lacrado: 'SIM',
          nf_conferida: 'SIM',
          regional: 'VIA VAREJO RJ',
        });
      }

      // Tentativa do 21º item
      const item21 = `357847400020021`;
      const resOverflow = db.inserirProduto({
        modelo_produto: 'Galaxy A55',
        ean: '7892509134125',
        serial: item21,
        numero_caixa: caixa,
        numero_lote: 'LOTE-CAP-03',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(resOverflow.sucesso).toBe(false);
      expect(resOverflow.erro).toMatch(/Limite de produtos por caixa atingido/i);
      expect(db.obterTotalProdutosNaCaixa(caixa, 'VIA VAREJO RJ')).toBe(20);
    });
  });

  describe('2. Validação de NF e Eliminação de Default Implícito para "SIM" (Gate 6.1)', () => {
    it('deve validar formatos de NF de 1 a 9 dígitos e chave de 44 dígitos', () => {
      // Casos válidos
      expect(validarNumeroOuChaveNfe('12345').valido).toBe(true);
      expect(validarNumeroOuChaveNfe('1').valido).toBe(true);
      expect(validarNumeroOuChaveNfe('999999999').valido).toBe(true);
      expect(validarNumeroOuChaveNfe('NF-001234').valido).toBe(true);

      const chave44 = '35240112345678000195550010000012341000012340';
      const resChave = validarNumeroOuChaveNfe(chave44);
      expect(resChave.valido).toBe(true);
      expect(resChave.tipo).toBe('CHAVE_ACESSO');

      // Casos inválidos
      expect(validarNumeroOuChaveNfe('').valido).toBe(false);
      expect(validarNumeroOuChaveNfe('   ').valido).toBe(false);
      expect(validarNumeroOuChaveNfe('ABCDEF').valido).toBe(false);
      expect(validarNumeroOuChaveNfe('123456789012345').valido).toBe(false); // 15 dígitos não é NF nem NFe
    });

    it('deve rejeitar cadastro com número de NF malformado', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const res = db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509133456',
        serial: '357847400300001',
        numero_caixa: 'CAIXA NF 01',
        numero_lote: 'LOTE-NF-01',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        numero_nf: 'INVALIDO-LETRAS-APENAS',
        regional: 'VIA VAREJO RJ',
      });

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/identificação da NF/i);
    });

    it('não deve assumir "SIM" como default quando nf_conferida não for informada (deve ser null/pendente)', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const res = db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509133456',
        serial: '357847400300002',
        numero_caixa: 'CAIXA NF 02',
        numero_lote: 'LOTE-NF-02',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
        // nf_conferida omitida intencionalmente
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto?.nf_conferida).toBeNull();
      expect(res.produto?.status_conformidade).toBeUndefined();
      expect(res.produto?.divergencia_nf).toBe(false);
    });

    it('deve sinalizar divergência e não-conformidade quando nf_conferida for "NÃO"', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const res = db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509133456',
        serial: '357847400300003',
        numero_caixa: 'CAIXA NF 03',
        numero_lote: 'LOTE-NF-03',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        nf_conferida: 'NÃO',
        regional: 'VIA VAREJO RJ',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto?.nf_conferida).toBe('NÃO');
      expect(res.produto?.divergencia_nf).toBe(true);
      expect(res.produto?.status_conformidade).toBe('NAO_CONFORME');
    });

    it('deve definir como CONFORME quando produto lacrado tiver NF conferida "SIM"', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const res = db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509133456',
        serial: '357847400300004',
        numero_caixa: 'CAIXA NF 04',
        numero_lote: 'LOTE-NF-04',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(res.sucesso).toBe(true);
      expect(res.produto?.nf_conferida).toBe('SIM');
      expect(res.produto?.divergencia_nf).toBe(false);
      expect(res.produto?.status_conformidade).toBe('CONFORME');
    });
  });

  describe('3. Requisitos de Fechamento de Lote e Checksum SHA-256 (Gate 6.3)', () => {
    it('deve rejeitar fechamento de lote vazio', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const res = db.finalizarLote({
        numeroLote: 'LOTE-VAZIO',
        fotos: fotosValidas,
      });

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Não há produtos cadastrados/i);
    });

    it('deve rejeitar fechamento se faltar qualquer uma das 3 fotos obrigatórias', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509133456',
        serial: '357847400400001',
        numero_caixa: 'CX 01',
        numero_lote: 'LOTE-FOTOS-01',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      const resSemEspelho = db.finalizarLote({
        numeroLote: 'LOTE-FOTOS-01',
        fotos: {
          caixaFechada: 'data:mock',
          espelhoCaixa: '', // Faltando
          lacreSeguranca: 'data:mock',
        },
      });

      expect(resSemEspelho.sucesso).toBe(false);
      expect(resSemEspelho.erro).toMatch(/obrigatório anexar as 3 fotos/i);
    });

    it('deve rejeitar fechamento se algum produto do lote estiver com NF pendente de conferência', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509133456',
        serial: '357847400400002',
        numero_caixa: 'CX 01',
        numero_lote: 'LOTE-NF-PENDENTE',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        // nf_conferida pendente (null)
        regional: 'VIA VAREJO RJ',
      });

      const res = db.finalizarLote({
        numeroLote: 'LOTE-NF-PENDENTE',
        fotos: fotosValidas,
      });

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/sem confirmação da NF conferida/i);
    });

    it('deve finalizar lote com sucesso quando requisitos forem atendidos e gerar checksum SHA-256', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const loteNome = 'LOTE-FINAL-OK';

      for (let i = 1; i <= 3; i++) {
        db.inserirProduto({
          modelo_produto: 'Galaxy S24',
          ean: '7892509133456',
          serial: `3578474004000${String(i).padStart(2, '0')}`,
          numero_caixa: 'CX 01',
          numero_lote: loteNome,
          data_auditoria: '2026-03-16',
          produto_lacrado: 'SIM',
          nf_conferida: 'SIM',
          regional: 'VIA VAREJO RJ',
        });
      }

      const res = db.finalizarLote({
        numeroLote: loteNome,
        colaborador: 'Operador Rio',
        fotos: fotosValidas,
      });

      expect(res.sucesso).toBe(true);
      expect(res.lote).toBeDefined();
      expect(res.lote?.status).toBe('FINALIZADO');
      expect(res.lote?.total_produtos).toBe(3);
      expect(res.lote?.checksum_lote).toBeDefined();
      expect(res.lote?.checksum_lote).toMatch(/^[a-f0-9]{64}$/i);
      expect(db.isLoteFinalizado(loteNome, 'VIA VAREJO RJ')).toBe(true);
    });
  });

  describe('4. Bloqueio de Lote Fechado e Permissões de Reabertura (Gate 6.4)', () => {
    const loteFechado = 'LOTE-BLOQUEADO-01';

    beforeEach(() => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509133456',
        serial: '357847400500001',
        numero_caixa: 'CX 01',
        numero_lote: loteFechado,
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        regional: 'VIA VAREJO RJ',
      });
      db.finalizarLote({
        numeroLote: loteFechado,
        colaborador: 'Operador Rio',
        fotos: fotosValidas,
      });
    });

    it('deve bloquear operador de adicionar novos itens a um lote já finalizado', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const res = db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509133456',
        serial: '357847400500002',
        numero_caixa: 'CX 01',
        numero_lote: loteFechado,
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/foi FINALIZADO e bloqueado/i);
    });

    it('deve negar reabertura de lote por operador', () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const res = db.reabrirLoteAdmin(loteFechado, 'VIA VAREJO RJ', 'Operador Rio', 'Tentativa não autorizada');
      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Acesso negado: Operadores não possuem permissão/i);
    });

    it('deve exigir motivo obrigatório para reabertura de lote por administrador', () => {
      db.setUsuarioAtual(usuarioAdmin);
      const resSemMotivo = db.reabrirLoteAdmin(loteFechado, 'VIA VAREJO RJ', 'admin', '');
      expect(resSemMotivo.sucesso).toBe(false);
      expect(resSemMotivo.erro).toMatch(/motivo para reabertura/i);
    });

    it('deve permitir reabertura por administrador com motivo e registrar histórico', () => {
      db.setUsuarioAtual(usuarioAdmin);
      const motivo = 'Conferência de divergência física solicitada pela auditoria';
      const res = db.reabrirLoteAdmin(loteFechado, 'VIA VAREJO RJ', 'admin', motivo);

      expect(res.sucesso).toBe(true);
      expect(db.isLoteFinalizado(loteFechado, 'VIA VAREJO RJ')).toBe(false);

      const lote = db.obterLoteFinalizado(loteFechado, 'VIA VAREJO RJ');
      expect(lote?.status).toBe('EM_ABERTO');
      expect(lote?.reaberto_por).toBe('admin');
      expect(lote?.motivo_reabertura).toBe(motivo);
      expect(lote?.historico_alteracoes.some((h) => h.acao === 'REABERTURA')).toBe(true);
    });
  });

  describe('5. Integridade em Importação de Planilha Excel (Gate 6.1)', () => {
    it('deve importar linhas sem preencher automaticamente NF conferida para SIM', () => {
      db.setUsuarioAtual(usuarioAdmin);
      const linhas = [
        {
          modelo: 'Galaxy S24',
          ean: '7892509133456',
          serial: '357847400600001',
          caixa: 'CAIXA PLANILHA 01',
          data: '2026-03-16',
          lacrado: 'SIM',
          regional: 'VIA VAREJO RJ',
          // sem nf_conferida informada
        },
        {
          modelo: 'Galaxy S24',
          ean: '7892509133456',
          serial: '357847400600002',
          caixa: 'CAIXA PLANILHA 01',
          data: '2026-03-16',
          lacrado: 'SIM',
          regional: 'VIA VAREJO RJ',
          nf_conferida: 'NÃO' as const,
        },
      ];

      const res = db.importarPlanilha(linhas);
      expect(res.sucessoCount).toBe(2);

      const p1 = db.obterProdutoPorSerial('357847400600001');
      expect(p1).toBeDefined();
      expect(p1?.nf_conferida).toBeNull(); // Deve ser null (pendente), NÃO 'SIM'!

      const p2 = db.obterProdutoPorSerial('357847400600002');
      expect(p2).toBeDefined();
      expect(p2?.nf_conferida).toBe('NÃO');
      expect(p2?.divergencia_nf).toBe(true);
    });
  });

  describe('6. Exclusão de Lote, Evidências Fotográficas e Produtos em Cascata', () => {
    it('deve impedir que operador exclua lotes finalizados (apenas Administrador)', async () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const res = await db.excluirLote('01', 'VIA VAREJO RJ');
      expect(res.sucesso).toBe(false);
      expect(res.erro).toContain('Acesso negado');
    });

    it('deve excluir lote, fotos e produtos vinculados com cascata completa', async () => {
      db.setUsuarioAtual(usuarioOperadorRJ);
      const loteParaTestar = 'LOTE-EXCLUSAO-01';

      // 1. Inserir produtos no lote com NF conferida
      for (let i = 1; i <= 3; i++) {
        const imei = `35784740099900${i}`;
        db.inserirProduto({
          modelo_produto: 'Galaxy S24',
          ean: '7892509133456',
          serial: imei,
          numero_caixa: 'CAIXA TESTE 99',
          numero_lote: loteParaTestar,
          data_auditoria: '2026-03-16',
          produto_lacrado: 'SIM',
          nf_conferida: 'SIM',
          regional: 'VIA VAREJO RJ',
        });
      }

      // 2. Finalizar o lote com 3 fotos de evidência
      const resFin = db.finalizarLote({
        numeroLote: loteParaTestar,
        regional: 'VIA VAREJO RJ',
        colaborador: 'Operador Teste',
        fotos: fotosValidas,
      });
      expect(resFin.sucesso).toBe(true);
      expect(db.obterLoteFinalizado(loteParaTestar, 'VIA VAREJO RJ')).toBeDefined();

      // 3. Executar exclusão como Administrador
      db.setUsuarioAtual(usuarioAdmin);
      const resDel = await db.excluirLote(loteParaTestar, 'VIA VAREJO RJ', 'Administrador Geral');
      expect(resDel.sucesso).toBe(true);
      expect(resDel.produtosRemovidos).toBe(3);
      expect(resDel.fotosRemovidas).toBe(3);

      // 4. Verificar que lote não existe mais
      expect(db.obterLoteFinalizado(loteParaTestar, 'VIA VAREJO RJ')).toBeNull();

      // 5. Verificar que produtos foram removidos da memória e serialMap
      expect(db.obterProdutoPorSerial('357847400999001')).toBeNull();
      expect(db.obterProdutoPorSerial('357847400999002')).toBeNull();
      expect(db.obterProdutoPorSerial('357847400999003')).toBeNull();
    });

    it('limparBaseOperacional deve resetar lotes finalizados, ultimoLote e produtos', async () => {
      db.setUsuarioAtual(usuarioAdmin);
      db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509133456',
        serial: '357847400999111',
        numero_caixa: 'CAIXA RESET 01',
        numero_lote: 'LOTE-TESTE-RESET',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        nf_conferida: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      const resFin = db.finalizarLote({
        numeroLote: 'LOTE-TESTE-RESET',
        regional: 'VIA VAREJO RJ',
        colaborador: 'Admin',
        fotos: fotosValidas,
      });
      expect(resFin.sucesso).toBe(true);
      expect(db.listarLotesFinalizados().length).toBeGreaterThan(0);

      await db.limparBaseOperacional();

      expect(db.listarLotesFinalizados()).toHaveLength(0);
      expect(db.obterUltimoLote()).toBe('01');
      expect(db.listarProdutos()).toHaveLength(0);
    });
  });
});

