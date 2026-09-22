import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatarBadgeLista } from '../pages/BipagemRapida';
import { VERSAO_LOCAL } from '../version';
import { updateService } from '../services/updateService';
import packageJson from '../../package.json';
import versionJson from '../../public/version.json';

describe('Ajuste de Badge "SEM DEALER" e Atualização do Sistema Windows (v1.3.2)', () => {
  describe('1. Formatação de Badge de Produtos da Lista (formatarBadgeLista)', () => {
    it('deve retornar "PRODUTO NA LISTA SAMSUNG" quando o dealer for "SEM DEALER"', () => {
      expect(formatarBadgeLista('SEM DEALER')).toBe('PRODUTO NA LISTA SAMSUNG');
      expect(formatarBadgeLista('sem dealer')).toBe('PRODUTO NA LISTA SAMSUNG');
      expect(formatarBadgeLista('  SEM DEALER  ')).toBe('PRODUTO NA LISTA SAMSUNG');
    });

    it('deve retornar "PRODUTO NA LISTA SAMSUNG" quando o dealer for nulo, indefinido ou vazio', () => {
      expect(formatarBadgeLista(null)).toBe('PRODUTO NA LISTA SAMSUNG');
      expect(formatarBadgeLista(undefined)).toBe('PRODUTO NA LISTA SAMSUNG');
      expect(formatarBadgeLista('')).toBe('PRODUTO NA LISTA SAMSUNG');
      expect(formatarBadgeLista('   ')).toBe('PRODUTO NA LISTA SAMSUNG');
    });

    it('deve retornar "PRODUTO NA LISTA SAMSUNG" quando o dealer for "LISTA"', () => {
      expect(formatarBadgeLista('LISTA')).toBe('PRODUTO NA LISTA SAMSUNG');
      expect(formatarBadgeLista('lista')).toBe('PRODUTO NA LISTA SAMSUNG');
    });

    it('deve respeitar a marca quando o fabricante for especificado e dealer for "SEM DEALER"', () => {
      expect(formatarBadgeLista('SEM DEALER', 'APPLE')).toBe('PRODUTO NA LISTA APPLE');
      expect(formatarBadgeLista('SEM DEALER', 'MOTOROLA')).toBe('PRODUTO NA LISTA MOTOROLA');
      expect(formatarBadgeLista('SEM DEALER', 'OUTRA MARCA')).toBe('PRODUTO NA LISTA SAMSUNG');
    });

    it('deve manter o nome oficial do dealer quando houver dealer cadastrado (ex: SIRI)', () => {
      expect(formatarBadgeLista('SIRI COMERCIO E SERVICOS LTDA')).toBe('SIRI COMERCIO E SERVICOS LTDA');
      expect(formatarBadgeLista('FAST SHOP')).toBe('FAST SHOP');
      expect(formatarBadgeLista('MAGAZINE LUIZA')).toBe('MAGAZINE LUIZA');
    });
  });

  describe('2. Integridade e Sincronização de Versão (v1.3.2 / 132)', () => {
    it('package.json deve estar na versão 1.3.2', () => {
      expect(packageJson.version).toBe('1.3.2');
    });

    it('src/version.ts (VERSAO_LOCAL) deve estar alinhado com v1.3.2 código 132', () => {
      expect(VERSAO_LOCAL.versao).toBe('1.3.2');
      expect(VERSAO_LOCAL.versaoCodigo).toBe(132);
      expect(VERSAO_LOCAL.obrigatoria).toBe(true);
    });

    it('public/version.json deve conter versão 1.3.2 e código 132', () => {
      expect(versionJson.versao).toBe('1.3.2');
      expect(versionJson.versaoCodigo).toBe(132);
      expect(versionJson.obrigatoria).toBe(true);
    });
  });

  describe('3. Detecção Imediata de Atualização pelo UpdateService', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('deve detectar versão superior na nuvem e marcar temAtualizacao = true', async () => {
      const mockNovaVersao = {
        versao: '1.4.0',
        versaoCodigo: 140,
        obrigatoria: true,
        titulo: 'Nova Versão Disponível, Por Favor Atualizar Agora',
        descricao: 'Atualização de teste',
        novidades: ['Teste de atualização'],
        downloadUrl: 'https://sistema-auditoria-solutions.vercel.app/downloads/Sistema-Auditoria-Solutions-Setup.exe',
      };

      // Mock do fetch para retornar versão mais recente
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('version.json')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockNovaVersao,
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          json: async () => ({}),
        } as Response);
      });

      const temAtt = await updateService.verificarAtualizacao();
      expect(temAtt).toBe(true);

      let statusRecebido = false;
      updateService.subscrever((st) => {
        if (st.temAtualizacao && st.infoNovaVersao?.versaoCodigo === 140) {
          statusRecebido = true;
        }
      });

      expect(statusRecebido).toBe(true);
    });
  });
});

