import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/storage';
import { ItemPendenteLote } from '../types';

describe('GESTÃO E EXCLUSÃO DE PENDÊNCIAS E INCONFORMIDADES FÍSICAS', () => {
  beforeEach(() => {
    db.limparTudoMemoria();
  });

  it('1. db.listarPendenciasDetalhadas() deve listar itens pendentes de produtos e lotes por regional', () => {
    // 1 produto enviado
    const prodEnviado = {
      id: 'prod-1',
      modelo_produto: 'Galaxy S24',
      serial: '358000000000001',
      imei: '358000000000001',
      numero_caixa: 'Caixa 01',
      numero_lote: '01',
      regional: 'VIA VAREJO BA',
      produto_lacrado: 'SIM' as const,
      data_auditoria: '24/09/2026',
      data_cadastro: '2026-09-24T12:00:00Z',
      status_sincronizacao: 'ENVIADO' as const,
      sync_status: 'ENVIADO' as const,
      created_at: '2026-09-24T12:00:00Z',
    };
    (db as any).produtos.push(prodEnviado);
    (db as any).serialMap.set('358000000000001', prodEnviado);

    // 2 produtos pendentes (inconformes)
    const prodPendente1 = {
      id: 'pend-1',
      modelo_produto: 'Galaxy A55',
      serial: '358000000000002',
      imei: '358000000000002',
      numero_caixa: 'Caixa 01',
      numero_lote: '01',
      regional: 'VIA VAREJO BA',
      produto_lacrado: 'SIM' as const,
      data_auditoria: '24/09/2026',
      data_cadastro: '2026-09-24T14:00:00Z',
      status_sincronizacao: 'PENDENTE' as const,
      sync_status: 'PENDENTE' as const,
      created_at: '2026-09-24T14:00:00Z',
    };
    const prodPendente2 = {
      id: 'pend-2',
      modelo_produto: 'Galaxy Z Flip5',
      serial: '358000000000003',
      imei: '358000000000003',
      numero_caixa: 'Caixa 02',
      numero_lote: '01',
      regional: 'VIA VAREJO BA',
      produto_lacrado: 'SIM' as const,
      data_auditoria: '24/09/2026',
      data_cadastro: '2026-09-24T14:05:00Z',
      status_sincronizacao: 'PENDENTE' as const,
      sync_status: 'PENDENTE' as const,
      created_at: '2026-09-24T14:05:00Z',
    };

    (db as any).produtos.push(prodPendente1, prodPendente2);
    (db as any).serialMap.set('358000000000002', prodPendente1);
    (db as any).serialMap.set('358000000000003', prodPendente2);

    // Lote com 1 pendência de lote
    (db as any).lotesFinalizados.push({
      id: 'lote-ba-01',
      numero_lote: '01',
      regional: 'VIA VAREJO BA',
      status: 'FINALIZADO',
      colaborador_fechamento: 'Admin',
      data_fechamento: '2026-09-24T16:00:00Z',
      total_caixas: 2,
      total_produtos: 3,
      fotos: { foto_caixas_lacradas: '', foto_palete_completo: '', foto_documento_lote: '' },
      checksum_lote: 'checksum123',
      motivo_pendencias: 'Ajustado no físico',
      produtos_pendentes: [
        {
          imei: '358000000000099',
          modelo: 'Galaxy S23',
          motivo: 'Falta no físico',
        },
      ],
      historico_alteracoes: [],
    });

    const pendencias = db.listarPendenciasDetalhadas('VIA VAREJO BA');
    expect(pendencias.length).toBe(3); // 2 de produtos + 1 de lote

    const imeis = pendencias.map((p) => p.imei);
    expect(imeis).toContain('358000000000002');
    expect(imeis).toContain('358000000000003');
    expect(imeis).toContain('358000000000099');

    // Métricas antes da exclusão
    const metricasAntes = db.obterMetricasDashboard('VIA VAREJO BA');
    expect(metricasAntes.pendencias).toBe(2);
  });

  it('2. db.excluirProdutosPendentes() deve excluir apenas pendências selecionadas e nunca itens já enviados', () => {
    // 1 produto enviado que NÃO deve ser excluído
    const prodEnviado = {
      id: 'prod-enviado',
      modelo_produto: 'Galaxy S24',
      serial: '358000000000001',
      imei: '358000000000001',
      numero_caixa: 'Caixa 01',
      numero_lote: '01',
      regional: 'VIA VAREJO BA',
      produto_lacrado: 'SIM' as const,
      data_auditoria: '24/09/2026',
      data_cadastro: '2026-09-24T12:00:00Z',
      status_sincronizacao: 'ENVIADO' as const,
      sync_status: 'ENVIADO' as const,
      created_at: '2026-09-24T12:00:00Z',
    };

    const prodPendente = {
      id: 'pend-1',
      modelo_produto: 'Galaxy A55',
      serial: '358000000000002',
      imei: '358000000000002',
      numero_caixa: 'Caixa 01',
      numero_lote: '01',
      regional: 'VIA VAREJO BA',
      produto_lacrado: 'SIM' as const,
      data_auditoria: '24/09/2026',
      data_cadastro: '2026-09-24T14:00:00Z',
      status_sincronizacao: 'PENDENTE' as const,
      sync_status: 'PENDENTE' as const,
      created_at: '2026-09-24T14:00:00Z',
    };

    (db as any).produtos = [prodEnviado, prodPendente];
    (db as any).serialMap.set('358000000000001', prodEnviado);
    (db as any).serialMap.set('358000000000002', prodPendente);

    // Tentar excluir tanto o enviado quanto o pendente
    const res = db.excluirProdutosPendentes(['358000000000001', '358000000000002'], 'VIA VAREJO BA');

    expect(res.sucesso).toBe(true);
    expect(res.removidos).toBe(1); // Somente o pendente foi removido!

    // O produto enviado permanece intacto
    expect(db.obterProdutoPorSerial('358000000000001')).toBeDefined();
    expect(db.obterProdutoPorSerial('358000000000002')).toBeNull();

    const metricas = db.obterMetricasDashboard('VIA VAREJO BA');
    expect(metricas.pendencias).toBe(0);
    expect(metricas.totalAuditados).toBe(1);
  });

  it('3. db.excluirTodasPendencias() deve zerar todas as pendências da regional mantendo produtos oficiais', () => {
    // 2 produtos enviados
    const prodsEnviados = Array.from({ length: 64 }, (_, i) => ({
      id: `prod-oficial-${i + 1}`,
      modelo_produto: 'Galaxy S24',
      serial: `358999999000${String(i + 1).padStart(3, '0')}`,
      imei: `358999999000${String(i + 1).padStart(3, '0')}`,
      numero_caixa: `Caixa 0${(i % 7) + 1}`,
      numero_lote: '01',
      regional: 'VIA VAREJO BA',
      produto_lacrado: 'SIM' as const,
      data_auditoria: '24/09/2026',
      data_cadastro: '2026-09-24T12:00:00Z',
      status_sincronizacao: 'ENVIADO' as const,
      sync_status: 'ENVIADO' as const,
      created_at: '2026-09-24T12:00:00Z',
    }));

    // 20 pendências (simulando exatamente o caso reportado pelo usuário: 64 enviados + 20 pendências = 84 total)
    const prodsPendentes = Array.from({ length: 20 }, (_, i) => ({
      id: `pend-temp-${i + 1}`,
      modelo_produto: 'Galaxy Inconforme',
      serial: `358111111000${String(i + 1).padStart(3, '0')}`,
      imei: `358111111000${String(i + 1).padStart(3, '0')}`,
      numero_caixa: 'Caixa 01',
      numero_lote: '01',
      regional: 'VIA VAREJO BA',
      produto_lacrado: 'SIM' as const,
      data_auditoria: '24/09/2026',
      data_cadastro: '2026-09-24T15:00:00Z',
      status_sincronizacao: 'PENDENTE' as const,
      sync_status: 'PENDENTE' as const,
      created_at: '2026-09-24T15:00:00Z',
    }));

    (db as any).produtos = [...prodsEnviados, ...prodsPendentes];
    for (const p of (db as any).produtos) {
      (db as any).serialMap.set(p.serial, p);
    }

    // Antes da exclusão: 84 produtos, 20 pendências
    const metricasAntes = db.obterMetricasDashboard('VIA VAREJO BA');
    expect(metricasAntes.totalAuditados).toBe(84);
    expect(metricasAntes.pendencias).toBe(20);

    // Executa a exclusão de todas as pendências
    const res = db.excluirTodasPendencias('VIA VAREJO BA');
    expect(res.sucesso).toBe(true);
    expect(res.removidos).toBe(20);

    // Após a exclusão: estritamente 64 produtos oficiais, 0 pendências!
    const metricasDepois = db.obterMetricasDashboard('VIA VAREJO BA');
    expect(metricasDepois.totalAuditados).toBe(64);
    expect(metricasDepois.pendencias).toBe(0);
    expect(metricasDepois.produtosLacrados).toBe(64);
  });
});
