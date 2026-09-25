import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/storage';
import fs from 'fs';
import path from 'path';

describe('Reconciliação Rigorosa RJ = 0 e BA = 64', () => {
  beforeEach(() => {
    db.limparTudoMemoria();
  });

  it('deve eliminar 100% dos registros de RJ e reduzir BA exatamente aos 64 itens oficiais da nuvem', () => {
    // 1. Simular contaminação local no navegador:
    // 4 itens em RJ (pendentes)
    // 84 itens obsoletos em BA (21 pendentes)
    const produtosContaminados: any[] = [];
    for (let i = 1; i <= 4; i++) {
      produtosContaminados.push({
        id: 1000 + i,
        serial: 'RJ-TEST-' + i,
        regional: 'VIA VAREJO RJ',
        data_auditoria: '23/09/2026',
        status_sincronizacao: 'PENDENTE',
        sync_status: 'PENDENTE',
        numero_caixa: '01',
        numero_lote: '01',
        modelo_produto: 'GALAXY S24',
        produto_lacrado: 'SIM'
      });
    }
    for (let i = 1; i <= 84; i++) {
      produtosContaminados.push({
        id: 2000 + i,
        serial: 'BA-OBSOLETO-' + i,
        regional: 'VIA VAREJO BA',
        status_sincronizacao: i <= 21 ? 'PENDENTE' : 'ENVIADO',
        sync_status: i <= 21 ? 'PENDENTE' : 'ENVIADO',
        numero_caixa: 'CAIXA ' + (i % 8 + 1),
        numero_lote: 'LOTE ' + (i % 8 + 1),
        modelo_produto: 'GALAXY A55',
        produto_lacrado: 'SIM'
      });
    }

    // Carregar os 64 oficiais de BA do central_database.json
    const centralDbPath = path.resolve(process.cwd(), 'data', 'central_database.json');
    const centralDb = JSON.parse(fs.readFileSync(centralDbPath, 'utf8'));
    const oficiais64 = centralDb.produtos;
    produtosContaminados.push(...oficiais64);

    (db as any).produtos = produtosContaminados;
    (db as any).lotesFinalizados = [
      { id: 'lote-rj-1', numero_lote: '01', regional: 'VIA VAREJO RJ', data_fechamento: '23/09/2026', total_caixas: 1, total_produtos: 4, status: 'FINALIZADO' },
      ...Array.from({ length: 8 }, (_, idx) => ({
        id: 'lote-ba-' + (idx + 1),
        numero_lote: '0' + (idx + 1),
        regional: 'VIA VAREJO BA',
        total_caixas: 1,
        total_produtos: 15,
        status: 'FINALIZADO'
      }))
    ];

    expect((db as any).produtos.length).toBe(4 + 84 + 64); // 152 total
    const statsAntes = db.obterEstatisticasRegionais();
    const statRJAntes = statsAntes.find(s => s.regional.includes('RJ'))!;
    const statBAAntes = statsAntes.find(s => s.regional.includes('BA'))!;
    expect(statRJAntes.totalProdutos).toBe(4);
    expect(statRJAntes.pendencias).toBe(4);
    expect(statBAAntes.totalProdutos).toBe(148);
    expect(statBAAntes.pendencias).toBe(21);

    // 2. Executar reconciliação com o servidor central
    db.mesclarProdutosCentral(oficiais64);
    db.mesclarLotesCentral(centralDb.lotes_finalizados);

    // 3. Validar resultados após reconciliação
    const statsDepois = db.obterEstatisticasRegionais();
    const statRJDepois = statsDepois.find(s => s.regional.includes('RJ'))!;
    const statBADepois = statsDepois.find(s => s.regional.includes('BA'))!;

    // RJ: 0 auditados, 0 caixas, 0 pendências
    expect(statRJDepois.totalProdutos).toBe(0);
    expect(statRJDepois.totalCaixas).toBe(0);
    expect(statRJDepois.pendencias).toBe(0);

    // BA: exatamente 64 auditados, 7 caixas, 0 pendências
    expect(statBADepois.totalProdutos).toBe(64);
    expect(statBADepois.totalCaixas).toBe(7);
    expect(statBADepois.pendencias).toBe(0);

    // Lotes: RJ zerada (0) e BA com exatamente 1 lote (Lote 01)
    const lotesRJ = (db as any).lotesFinalizados.filter((l: any) => l.regional.includes('RJ'));
    const lotesBA = (db as any).lotesFinalizados.filter((l: any) => l.regional.includes('BA'));
    expect(lotesRJ.length).toBe(0);
    expect(lotesBA.length).toBe(1);
    expect(lotesBA[0].numero_lote).toBe('01');
    expect(lotesBA[0].total_caixas).toBe(7);
    expect(lotesBA[0].total_produtos).toBe(64);
  });
});

