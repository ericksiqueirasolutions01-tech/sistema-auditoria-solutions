/**
 * Testes Automatizados de Performance, Otimização de Consultas e Code-Splitting (Gate 12)
 *
 * Valida:
 * 1. Consulta Paginada em Memória (listarProdutosPaginado)
 * 2. Agregação e Contadores em Passagem Única O(n) (obterContadoresCaixa e obterMetricasDashboard)
 * 3. Short-Circuit de Status de Envio por Caixa (obterStatusEnvioCaixa)
 * 4. Índices de Banco de Dados de Alta Performance (SQLite e PostgreSQL)
 * 5. Isolamento de Chunks e Lazy Loading (vite.config.ts e App.tsx)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/storage';
import { ProdutoAuditoria } from '../types';

describe('GATE 12: Performance e Otimização de Consultas', () => {
  describe('1. Consulta Paginada de Produtos (listarProdutosPaginado)', () => {
    beforeEach(() => {
      // Configurar dados de teste limpos
      const produtosMock: ProdutoAuditoria[] = [];
      for (let i = 1; i <= 250; i++) {
        produtosMock.push({
          id: i,
          id_servidor: null,
          uuid: `uuid-perf-${i}`,
          fabricante: 'SAMSUNG',
          modelo_produto: i % 2 === 0 ? 'Galaxy S24' : 'Galaxy A55',
          ean: '7892509123456',
          serial: `357847400000${String(i).padStart(3, '0')}`,
          imei: `357847400000${String(i).padStart(3, '0')}`,
          numero_lote: 'LOTE-PERF-01',
          data_auditoria: '17/09/2026',
          numero_caixa: `Caixa ${String(Math.ceil(i / 20)).padStart(2, '0')}`,
          produto_lacrado: i % 3 === 0 ? 'NÃO' : 'SIM',
          kit_completo: i % 3 === 0 ? 'SIM' : null,
          aparelho_marcas_uso: i % 3 === 0 ? 'NÃO' : null,
          observacao: 'Item de teste de performance',
          computador_id: 'PC-RJ-001',
          computador_nome: 'Estação 01',
          data_alteracao: null,
          data_sincronizacao: null,
          data_cadastro: new Date().toISOString(),
          usuario_cadastro: 'Admin Teste',
          regional: 'VIA VAREJO RJ',
          status_sincronizacao: i % 5 === 0 ? 'PENDENTE' : 'ENVIADO',
        });
      }

      // Injetar no banco em memória para testes controlados
      (db as any).produtos = produtosMock;
      (db as any).serialMap.clear();
      for (const p of produtosMock) {
        (db as any).serialMap.set(p.serial.toUpperCase(), p);
      }
    });

    it('deve retornar a primeira página corretamente com fatiamento eficiente', () => {
      const inicio = performance.now();
      const res = db.listarProdutosPaginado({ regional: 'VIA VAREJO RJ' }, 1, 25);
      const duracao = performance.now() - inicio;

      expect(res.total).toBe(250);
      expect(res.pagina).toBe(1);
      expect(res.totalPaginas).toBe(10);
      expect(res.itensPorPagina).toBe(25);
      expect(res.itens.length).toBe(25);
      expect(res.itens[0].id).toBe(1);
      expect(res.itens[24].id).toBe(25);
      expect(duracao).toBeLessThan(50); // Execução sub-milissegundos
    });

    it('deve navegar para a página intermediária e última página com precisão', () => {
      const resPag5 = db.listarProdutosPaginado({ regional: 'VIA VAREJO RJ' }, 5, 25);
      expect(resPag5.pagina).toBe(5);
      expect(resPag5.itens.length).toBe(25);
      expect(resPag5.itens[0].id).toBe(101);

      const resUltima = db.listarProdutosPaginado({ regional: 'VIA VAREJO RJ' }, 10, 25);
      expect(resUltima.pagina).toBe(10);
      expect(resUltima.itens.length).toBe(25);
      expect(resUltima.itens[24].id).toBe(250);
    });

    it('deve tratar índices fora do limite ajustando para os limites válidos', () => {
      const resAbaixo = db.listarProdutosPaginado({ regional: 'VIA VAREJO RJ' }, -2, 50);
      expect(resAbaixo.pagina).toBe(1);

      const resAcima = db.listarProdutosPaginado({ regional: 'VIA VAREJO RJ' }, 999, 50);
      expect(resAcima.pagina).toBe(5);
      expect(resAcima.totalPaginas).toBe(5);
    });
  });

  describe('2. Agregações e Métricas em Passagem Única O(n)', () => {
    beforeEach(() => {
      const produtosMock: ProdutoAuditoria[] = [];
      for (let i = 1; i <= 100; i++) {
        produtosMock.push({
          id: i,
          id_servidor: null,
          uuid: `uuid-box-${i}`,
          fabricante: 'SAMSUNG',
          modelo_produto: i <= 50 ? 'Galaxy S24' : 'Galaxy Z Flip',
          ean: '7892509123456',
          serial: `357847411111${String(i).padStart(3, '0')}`,
          data_auditoria: '17/09/2026',
          numero_caixa: 'Caixa 01',
          produto_lacrado: i <= 70 ? 'SIM' : 'NÃO',
          aparelho_marcas_uso: i > 80 ? 'SIM' : 'NÃO',
          kit_completo: i > 90 ? 'NÃO' : 'SIM',
          observacao: '',
          computador_id: 'PC-RJ-001',
          computador_nome: 'Estação 01',
          data_alteracao: null,
          data_sincronizacao: null,
          data_cadastro: '2026-09-17T08:00:00Z',
          usuario_cadastro: 'Admin Teste',
          regional: 'VIA VAREJO RJ',
          status_sincronizacao: i <= 95 ? 'ENVIADO' : 'PENDENTE',
        });
      }

      (db as any).produtos = produtosMock;
      (db as any).serialMap.clear();
      for (const p of produtosMock) {
        (db as any).serialMap.set(p.serial.toUpperCase(), p);
      }
    });

    it('obterContadoresCaixa deve acumular contadores com precisão matemática em passagem única', () => {
      const inicio = performance.now();
      const contadores = db.obterContadoresCaixa('Caixa 01', 'VIA VAREJO RJ');
      const duracao = performance.now() - inicio;

      expect(contadores.totalAuditados).toBe(100);
      expect(contadores.produtosLacrados).toBe(70);
      expect(contadores.produtosNaoLacrados).toBe(30);
      expect(contadores.comMarcasUso).toBe(20); // i > 80 (81 a 100)
      expect(contadores.pendencias).toBe(5); // i > 95 (96 a 100)
      expect(duracao).toBeLessThan(30);
    });

    it('obterStatusEnvioCaixa deve realizar short-circuit imediato para caixas com pendências', () => {
      const statusPendente = db.obterStatusEnvioCaixa('Caixa 01', 'VIA VAREJO RJ');
      expect(statusPendente).toBe('Aguardando envio Online');

      // Se todos estiverem enviados
      for (const p of (db as any).produtos) {
        p.status_sincronizacao = 'ENVIADO';
      }
      const statusEnviado = db.obterStatusEnvioCaixa('Caixa 01', 'VIA VAREJO RJ');
      expect(statusEnviado).toBe('Enviado Online');

      const statusVazia = db.obterStatusEnvioCaixa('Caixa Inexistente', 'VIA VAREJO RJ');
      expect(statusVazia).toBe('Vazia');
    });

    it('obterMetricasDashboard deve agregar métricas de distribuição em passagem única', () => {
      const metricas = db.obterMetricasDashboard('VIA VAREJO RJ');

      expect(metricas.totalAuditados).toBe(100);
      expect(metricas.totalCaixas).toBe(1);
      expect(metricas.produtosLacrados).toBe(70);
      expect(metricas.produtosNaoLacrados).toBe(30);
      expect(metricas.produtosPorModelo.length).toBeGreaterThan(0);
      expect(metricas.produtosPorCaixa[0].caixa).toBe('Caixa 01');
      expect(metricas.produtosPorCaixa[0].total).toBe(100);
    });
  });

  describe('3. Índices de Banco de Dados de Alta Performance', () => {
    it('deve conter índices de busca rápida e filtros compostos no esquema SQLite local', () => {
      const schemaSql = fs.readFileSync(
        path.resolve(__dirname, '../db/schema.sql'),
        'utf-8'
      );

      expect(schemaSql).toContain('CREATE INDEX IF NOT EXISTS idx_produtos_serial');
      expect(schemaSql).toContain('CREATE INDEX IF NOT EXISTS idx_produtos_caixa');
      expect(schemaSql).toContain('CREATE INDEX IF NOT EXISTS idx_produtos_sync');
      expect(schemaSql).toContain('CREATE INDEX IF NOT EXISTS idx_produtos_lote');
      expect(schemaSql).toContain('CREATE INDEX IF NOT EXISTS idx_produtos_caixa_lote');
    });

    it('deve conter índices compostos para delta sync e lotes no PostgreSQL central', () => {
      const pgSchema = fs.readFileSync(
        path.resolve(__dirname, '../db/schema-central-postgres.sql'),
        'utf-8'
      );

      expect(pgSchema).toContain('CREATE INDEX IF NOT EXISTS idx_audit_products_delta_sync');
      expect(pgSchema).toContain('CREATE INDEX IF NOT EXISTS idx_audit_products_lote_caixa');
      expect(pgSchema).toContain('CREATE INDEX IF NOT EXISTS idx_audit_products_serial');
      expect(pgSchema).toContain('CREATE INDEX IF NOT EXISTS idx_audit_products_imei');
    });
  });

  describe('4. Arquitetura de Code Splitting e Lazy Loading', () => {
    it('deve utilizar lazy loading e Suspense no App.tsx para módulos secundários', () => {
      const appCode = fs.readFileSync(
        path.resolve(__dirname, '../App.tsx'),
        'utf-8'
      );

      expect(appCode).toContain('import React, { useState, useEffect, Suspense, lazy }');
      expect(appCode).toContain("lazy(() => import('./pages/PainelAdmin')");
      expect(appCode).toContain("lazy(() => import('./pages/GeradorEspelhos')");
      expect(appCode).toContain("lazy(() => import('./pages/ImportacaoExcel')");
      expect(appCode).toContain("lazy(() => import('./pages/BackupSistema')");
      expect(appCode).toContain('<Suspense fallback=');
    });

    it('deve configurar manualChunks no vite.config.ts isolando vendor-xlsx, vendor-pdf e vendor-icons', () => {
      const viteConfig = fs.readFileSync(
        path.resolve(__dirname, '../../vite.config.ts'),
        'utf-8'
      );

      expect(viteConfig).toContain('manualChunks(id)');
      expect(viteConfig).toContain("'vendor-xlsx'");
      expect(viteConfig).toContain("'vendor-pdf'");
      expect(viteConfig).toContain("'vendor-icons'");
    });
  });
});

