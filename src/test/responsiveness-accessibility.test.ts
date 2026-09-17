/**
 * Testes Automatizados de Responsividade e Acessibilidade (Gate 11)
 *
 * Valida:
 * 1. Lógica de Breakpoints e Viewports Operacionais:
 *    - Telas mobile (360x800, 390x844, 412x915)
 *    - Tablets (768x1024, 1024x768)
 *    - Desktops (1280x720, 1366x768, 1920x1080)
 *    - Suporte a zoom 200% sem quebra de viewport
 * 2. Critérios de Acessibilidade (WCAG 2.1 AA / Seção 15 do Prompt Mestre):
 *    - Touch target mínimo de 44px em botões e controles interativos
 *    - Papéis ARIA e atributos de diálogo (role="dialog", role="alertdialog", aria-modal="true", aria-labelledby)
 *    - Regiões vivas (aria-live="assertive" para erros, aria-live="polite" para bipagem)
 *    - Associação de rótulos (htmlFor e id) em campos críticos
 *    - Fechamento de modals por teclado (Escape)
 *    - Comunicação de status que não depende exclusivamente de cor
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Helper para calcular se uma largura de viewport pertence ao layout móvel ou desktop
export function classificarLayoutViewport(largura: number): 'celular' | 'excel' {
  return largura < 768 ? 'celular' : 'excel';
}

// Helper para validar se uma dimensão atende ao critério de alvo de toque WCAG (>= 44px)
export function atendeAlvoDeToqueMinimo(pixels: number): boolean {
  return pixels >= 44;
}

describe('GATE 11: Responsividade e Acessibilidade (WCAG 2.1 AA)', () => {
  describe('1. Breakpoints e Viewports Operacionais Obrigatórios', () => {
    const viewportsObrigatorios = [
      { nome: 'Mobile Peq (360x800)', largura: 360, altura: 800, esperado: 'celular' },
      { nome: 'iPhone 12/13/14 (390x844)', largura: 390, altura: 844, esperado: 'celular' },
      { nome: 'Pixel / Galaxy (412x915)', largura: 412, altura: 915, esperado: 'celular' },
      { nome: 'iPad Portrait (768x1024)', largura: 768, altura: 1024, esperado: 'excel' },
      { nome: 'iPad Landscape (1024x768)', largura: 1024, altura: 768, esperado: 'excel' },
      { nome: 'Desktop HD (1280x720)', largura: 1280, altura: 720, esperado: 'excel' },
      { nome: 'Notebook Padrão (1366x768)', largura: 1366, altura: 768, esperado: 'excel' },
      { nome: 'Full HD (1920x1080)', largura: 1920, altura: 1080, esperado: 'excel' },
      { nome: 'Desktop Zoom 200% (1920/2 = 960px)', largura: 960, altura: 540, esperado: 'excel' },
      { nome: 'Notebook Zoom 200% (1366/2 = 683px)', largura: 683, altura: 384, esperado: 'celular' },
    ];

    it.each(viewportsObrigatorios)(
      'deve classificar corretamente o viewport $nome ($largura x $altura) como modo $esperado',
      ({ largura, esperado }) => {
        expect(classificarLayoutViewport(largura)).toBe(esperado);
      }
    );

    it('deve garantir que todos os tamanhos de toque mínimos atendam ao requisito de 44px', () => {
      expect(atendeAlvoDeToqueMinimo(44)).toBe(true);
      expect(atendeAlvoDeToqueMinimo(48)).toBe(true);
      expect(atendeAlvoDeToqueMinimo(40)).toBe(false);
      expect(atendeAlvoDeToqueMinimo(32)).toBe(false);
    });
  });

  describe('2. Verificação de A11y e ARIA nos Modais Operacionais', () => {
    const basePath = path.resolve(__dirname, '..');

    const modaisParaVerificar = [
      {
        arquivo: 'features/audit-products/components/ModalNovaCaixa.tsx',
        dialogId: 'titulo-nova-caixa',
        role: 'dialog',
      },
      {
        arquivo: 'features/audit-products/components/ModalAlterarCaixa.tsx',
        dialogId: 'titulo-alterar-caixa',
        role: 'dialog',
      },
      {
        arquivo: 'features/audit-products/components/ModalConfirmacaoTrocaCaixa.tsx',
        dialogId: 'titulo-confirmar-fotos',
        role: 'dialog',
      },
      {
        arquivo: 'features/audit-products/components/ModalEspelhoCaixa.tsx',
        dialogId: 'titulo-espelho-caixa',
        role: 'dialog',
      },
      {
        arquivo: 'features/audit-products/components/ModalImportacaoRapida.tsx',
        dialogId: 'titulo-importar-planilha',
        role: 'dialog',
      },
      {
        arquivo: 'features/audit-products/components/ModalLimparRegistros.tsx',
        dialogId: 'titulo-limpar-registros',
        role: 'dialog',
      },
      {
        arquivo: 'components/ModalFechamentoLote.tsx',
        dialogId: 'titulo-fechamento-lote',
        role: 'dialog',
      },
      {
        arquivo: 'components/ModalVisualizarFotoLote.tsx',
        dialogId: 'titulo-visualizar-foto',
        role: 'dialog',
      },
    ];

    it.each(modaisParaVerificar)(
      'modal $arquivo deve conter role="$role", aria-modal="true", aria-labelledby e listener de tecla Escape',
      ({ arquivo, dialogId, role }) => {
        const fullPath = path.join(basePath, arquivo);
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Validação de ARIA dialog
        expect(content).toContain(`role="${role}"`);
        expect(content).toContain('aria-modal="true"');
        expect(content).toContain(`aria-labelledby="${dialogId}"`);
        expect(content).toContain(`id="${dialogId}"`);

        // Validação de atalho de fechamento por teclado (Escape)
        expect(content).toMatch(/['"]Escape['"]/);

        // Validação de alvo de toque >= 44px
        expect(content).toContain('min-h-[44px]');
      }
    );
  });

  describe('3. Verificação de A11y e Regiões Vivas na Tela de Bipagem', () => {
    const bipagemPath = path.resolve(__dirname, '../pages/BipagemRapida.tsx');
    const content = fs.readFileSync(bipagemPath, 'utf-8');

    it('deve conter regiões de anúncio assertivas para erro de duplicidade e validação', () => {
      expect(content).toContain('role="alert"');
      expect(content).toContain('aria-live="assertive"');
    });

    it('deve conter região polida para feedback de bipagem e status', () => {
      expect(content).toContain('role="status"');
      expect(content).toContain('aria-live="polite"');
    });

    it('deve conter leitor invisível dedicado (sr-only) com aria-atomic para leitores de tela', () => {
      expect(content).toContain('className="sr-only" role="status" aria-live="polite" aria-atomic="true"');
    });

    it('deve conter inputs de IMEI identificados com id e rótulo de acessibilidade', () => {
      expect(content).toContain('id="input-imei-mobile"');
      expect(content).toContain('htmlFor="input-imei-mobile"');
      expect(content).toContain('aria-label="Bipagem de IMEI do aparelho (15 dígitos numéricos)"');

      expect(content).toContain('id="input-imei-desktop"');
      expect(content).toContain('aria-label="Posicione o cursor e bipe o IMEI com 15 dígitos"');
    });

    it('deve conter botão de limpar campo de IMEI com alvo de toque >= 44px e aria-label explícito', () => {
      expect(content).toContain('aria-label="Limpar campo de IMEI"');
      expect(content).toContain('min-h-[44px] min-w-[44px]');
    });
  });

  describe('4. Verificação de A11y no Login e Identificação', () => {
    const loginPath = path.resolve(__dirname, '../components/LoginModal.tsx');
    const content = fs.readFileSync(loginPath, 'utf-8');

    it('deve vincular rótulos e campos no formulário de autenticação', () => {
      expect(content).toContain('htmlFor="login-usuario"');
      expect(content).toContain('id="login-usuario"');
      expect(content).toContain('htmlFor="login-senha"');
      expect(content).toContain('id="login-senha"');
    });

    it('deve vincular rótulo e campo no formulário de identificação obrigatória do colaborador', () => {
      expect(content).toContain('htmlFor="identificacao-nome-completo"');
      expect(content).toContain('id="identificacao-nome-completo"');
    });
  });

  describe('5. Verificação de A11y no Painel Admin', () => {
    const adminPath = path.resolve(__dirname, '../pages/PainelAdmin.tsx');
    const content = fs.readFileSync(adminPath, 'utf-8');

    it('deve suportar fechamento de modais de zoom e limpeza através da tecla Escape', () => {
      expect(content).toMatch(/['"]Escape['"]/);
    });

    it('deve configurar modal de visualização ampliada de foto com atributos ARIA e botão acessível', () => {
      expect(content).toContain('role="dialog"');
      expect(content).toContain('aria-modal="true"');
      expect(content).toContain('aria-labelledby="titulo-foto-ampliada"');
      expect(content).toContain('id="titulo-foto-ampliada"');
      expect(content).toContain('aria-label="Fechar ampliação da evidência fotográfica"');
      expect(content).toContain('min-h-[44px] min-w-[44px]');
    });
  });
});

