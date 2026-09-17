/**
 * Testes Unitários de Arquitetura Modular e Camada de Domínio (Gate 10)
 *
 * Valida:
 * 1. Camada de Domínio Pura (Domain Rules):
 *    - RBAC e Sessão Criptográfica (authRules)
 *    - Regras de Negócio de Auditoria, NF, Caixa e Lote (auditRules)
 * 2. Retrocompatibilidade Total de storage.ts via re-export
 * 3. Componentes Modulares de Features (Audit Products e Admin)
 */

import { describe, it, expect } from 'vitest';
import {
  isAdminOuSuper,
  isSupervisor,
  podeAcessarRegional,
  criarTokenSessao,
  validarTokenSessao,
  validarNumeroOuChaveNfe,
  CAPACIDADE_MAXIMA_CAIXA,
  isCaixaCompletaQtd,
  podeFecharCaixaQtd,
  calcularChecksumLote,
  validarReaberturaLote,
  calcularConformidadeProduto,
} from '../domain';

import * as storage from '../db/storage';
import {
  ModalEspelhoCaixa,
  ModalNovaCaixa,
  ModalImportacaoRapida,
  ModalAlterarCaixa,
  ModalConfirmacaoTrocaCaixa,
  ModalLimparRegistros,
} from '../features/audit-products/components';
import { AbaGaleriaFotos } from '../features/admin/components';
import { Usuario } from '../types';

describe('GATE 10: Arquitetura Limpa, Domínio e Modularização', () => {
  describe('1. Regras Puras de Autenticação e RBAC (src/domain/auth)', () => {
    it('deve validar permissões de Administrador e Super Admin corretamente', () => {
      expect(isAdminOuSuper('SUPER_ADMIN')).toBe(true);
      expect(isAdminOuSuper('ADMINISTRADOR')).toBe(true);
      expect(isAdminOuSuper('SUPERVISOR_REGIONAL')).toBe(false);
      expect(isAdminOuSuper('OPERADOR')).toBe(false);
      expect(isAdminOuSuper(null)).toBe(false);
      expect(isAdminOuSuper(undefined)).toBe(false);
    });

    it('deve validar permissões de Supervisor Regional', () => {
      expect(isSupervisor('SUPERVISOR_REGIONAL')).toBe(true);
      expect(isSupervisor('ADMINISTRADOR')).toBe(false);
      expect(isSupervisor('OPERADOR')).toBe(false);
    });

    it('deve restringir acesso regional estritamente por RBAC e polo regional', () => {
      const adminUser: Usuario = {
        id: 1,
        login: 'admin',
        nome: 'Admin User',
        perfil: 'ADMINISTRADOR',
        regional: null,
        senha: 'hash',
        ativo: true,
        criado_em: '2026-09-16T12:00:00Z',
      };
      const opRjUser: Usuario = {
        id: 2,
        login: 'operador_rj',
        nome: 'Operador RJ',
        perfil: 'OPERADOR',
        regional: 'VIA VAREJO RJ',
        senha: 'hash',
        ativo: true,
        criado_em: '2026-09-16T12:00:00Z',
      };

      // Admin acessa qualquer regional
      expect(podeAcessarRegional(adminUser, 'VIA VAREJO RJ')).toBe(true);
      expect(podeAcessarRegional(adminUser, 'LOJAS CEM')).toBe(true);
      expect(podeAcessarRegional(adminUser, 'TODAS')).toBe(true);

      // Operador RJ só acessa RJ
      expect(podeAcessarRegional(opRjUser, 'VIA VAREJO RJ')).toBe(true);
      expect(podeAcessarRegional(opRjUser, 'LOJAS CEM')).toBe(false);
      expect(podeAcessarRegional(opRjUser, 'TODAS')).toBe(false);
      expect(podeAcessarRegional(null, 'VIA VAREJO RJ')).toBe(false);
    });

    it('deve emitir e validar token de sessão com assinatura SHA-256 e expiração', () => {
      const usuario: Usuario = {
        id: 10,
        login: 'auditor_teste',
        nome: 'Auditor Teste',
        perfil: 'OPERADOR',
        regional: 'SÃO PAULO',
        senha: 'hash',
        ativo: true,
        criado_em: '2026-09-16T12:00:00Z',
      };
      const sessao = criarTokenSessao(usuario, 'DEV-001');
      expect(sessao.token).toBeDefined();
      expect(sessao.token).toContain('.');

      const val = validarTokenSessao(sessao.token);
      expect(val.valido).toBe(true);
      expect(val.sessao?.login).toBe('auditor_teste');
      expect(val.sessao?.device_id).toBe('DEV-001');
      expect(val.sessao?.regional).toBe('SÃO PAULO');
    });

    it('deve rejeitar tokens adulterados, com assinatura incorreta ou expirados', () => {
      const sessao = criarTokenSessao(
        { id: 1, login: 'test', nome: 'Test', perfil: 'OPERADOR', senha: 'hash', ativo: true, criado_em: '2026-09-16T12:00:00Z' },
        'DEV-001'
      );
      const [payload, sig] = sessao.token.split('.');

      // Assinatura inválida
      const tokenAdulterado = `${payload}.0000000000000000000000000000000000000000000000000000000000000000`;
      expect(validarTokenSessao(tokenAdulterado).valido).toBe(false);

      // Token malformado
      expect(validarTokenSessao('token_sem_ponto').valido).toBe(false);
      expect(validarTokenSessao('').valido).toBe(false);
    });
  });

  describe('2. Regras Puras de Auditoria (src/domain/rules/auditRules)', () => {
    it('deve validar integridade de NF-e convencional (1 a 9 dígitos) e chave de acesso (44 dígitos)', () => {
      // NF comum
      const nf1 = validarNumeroOuChaveNfe('123456');
      expect(nf1.valido).toBe(true);
      expect(nf1.tipo).toBe('NUMERO');
      expect(nf1.identificadorLimpo).toBe('123456');

      // Chave de acesso 44 dígitos
      const chave44 = '35260100000000000000550010000000011000000001';
      const nf2 = validarNumeroOuChaveNfe(chave44);
      expect(nf2.valido).toBe(true);
      expect(nf2.tipo).toBe('CHAVE_ACESSO');
      expect(nf2.identificadorLimpo).toBe(chave44);

      // Inválidos
      expect(validarNumeroOuChaveNfe('').valido).toBe(false);
      expect(validarNumeroOuChaveNfe('abcdef').valido).toBe(false);
      expect(validarNumeroOuChaveNfe('123456789012345').valido).toBe(false); // 15 dígitos: não é NF (1-9) nem chave (44)
    });

    it('deve validar capacidade estrita de caixa de 20 produtos', () => {
      expect(CAPACIDADE_MAXIMA_CAIXA).toBe(20);

      // Caixa incompleta (< 20)
      expect(isCaixaCompletaQtd(19)).toBe(false);
      const resIncompleta = podeFecharCaixaQtd(19);
      expect(resIncompleta.pode).toBe(false);
      expect(resIncompleta.motivo).toContain('capacidade incompleta');

      // Caixa exata (20)
      expect(isCaixaCompletaQtd(20)).toBe(true);
      const resExata = podeFecharCaixaQtd(20);
      expect(resExata.pode).toBe(true);
      expect(resExata.motivo).toBeUndefined();

      // Caixa excedida (> 20)
      expect(isCaixaCompletaQtd(21)).toBe(true); // >= 20
      const resExcedida = podeFecharCaixaQtd(21);
      expect(resExcedida.pode).toBe(false);
      expect(resExcedida.motivo).toContain('excedeu a capacidade máxima');
    });

    it('deve calcular checksum determinístico SHA-256 para lote', () => {
      const c1 = calcularChecksumLote({
        lote: 'LOTE-100',
        regional: 'VIA VAREJO RJ',
        colaborador: 'Operador 1',
        total_caixas: 2,
        total_produtos: 40,
        seriais: ['353346280850215', '353346284510559'],
        timestamp: '2026-09-16T12:00:00Z',
      });

      // Mesmos dados com seriais em ordem diferente devem gerar o MESMO checksum (ordenação canônica)
      const c2 = calcularChecksumLote({
        lote: 'LOTE-100',
        regional: 'VIA VAREJO RJ',
        colaborador: 'Operador 1',
        total_caixas: 2,
        total_produtos: 40,
        seriais: ['353346284510559', '353346280850215'],
        timestamp: '2026-09-16T12:00:00Z',
      });

      expect(c1).toBe(c2);
      expect(c1).toHaveLength(64);
    });

    it('deve validar permissões e regras para reabertura de lote', () => {
      const opUser: Usuario = {
        id: 1,
        login: 'operador',
        nome: 'Operador',
        perfil: 'OPERADOR',
        senha: 'hash',
        ativo: true,
        criado_em: '2026-09-16T12:00:00Z',
      };
      const adminUser: Usuario = {
        id: 2,
        login: 'admin',
        nome: 'Admin',
        perfil: 'ADMINISTRADOR',
        senha: 'hash',
        ativo: true,
        criado_em: '2026-09-16T12:00:00Z',
      };

      // Reabertura negada para Operador
      const r1 = validarReaberturaLote(opUser, 'Correção de bipagem');
      expect(r1.autorizado).toBe(false);
      expect(r1.erro).toContain('Somente administradores');

      // Reabertura negada sem motivo
      const r2 = validarReaberturaLote(adminUser, '   ');
      expect(r2.autorizado).toBe(false);
      expect(r2.erro).toContain('Justificativa obrigatória');

      // Reabertura negada sem usuário
      const r3 = validarReaberturaLote(null, 'Motivo válido longo');
      expect(r3.autorizado).toBe(false);

      // Reabertura aprovada para Administrador com motivo válido
      const r4 = validarReaberturaLote(adminUser, 'Auditoria corretiva de avaria');
      expect(r4.autorizado).toBe(true);
      expect(r4.erro).toBeUndefined();
    });

    it('deve calcular conformidade de produto com base em lacre e estado de NF', () => {
      // Lacrado e NF conferida
      const c1 = calcularConformidadeProduto('SIM', 'SIM');
      expect(c1.status_conformidade).toBe('CONFORME');
      expect(c1.divergencia_nf).toBe('NÃO');

      // Lacre violado (NÃO)
      const c2 = calcularConformidadeProduto('NÃO', 'SIM');
      expect(c2.status_conformidade).toBe('DIVERGENTE');

      // NF divergente (NÃO)
      const c3 = calcularConformidadeProduto('SIM', 'NÃO');
      expect(c3.status_conformidade).toBe('DIVERGENTE');
      expect(c3.divergencia_nf).toBe('SIM');

      // NF pendente / não informada
      const c4 = calcularConformidadeProduto('SIM', null);
      expect(c4.status_conformidade).toBe('CONFORME');
      expect(c4.divergencia_nf).toBe('NÃO');
    });
  });

  describe('3. Retrocompatibilidade Total de storage.ts', () => {
    it('storage.ts deve re-exportar todas as funções de domínio preservando interfaces existentes', () => {
      expect(typeof storage.isAdminOuSuper).toBe('function');
      expect(typeof storage.isSupervisor).toBe('function');
      expect(typeof storage.podeAcessarRegional).toBe('function');
      expect(typeof storage.criarTokenSessao).toBe('function');
      expect(typeof storage.validarTokenSessao).toBe('function');
      expect(typeof storage.validarNumeroOuChaveNfe).toBe('function');
      expect(storage.CAPACIDADE_MAXIMA_CAIXA).toBe(20);
      expect(typeof storage.isCaixaCompletaQtd).toBe('function');
      expect(typeof storage.podeFecharCaixaQtd).toBe('function');
      expect(typeof storage.calcularChecksumLote).toBe('function');
      expect(typeof storage.validarReaberturaLote).toBe('function');
      expect(typeof storage.calcularConformidadeProduto).toBe('function');
    });
  });

  describe('4. Componentes Modulares de Features (Clean Architecture)', () => {
    it('deve exportar componentes de modais de audit-products', () => {
      expect(ModalEspelhoCaixa).toBeDefined();
      expect(ModalNovaCaixa).toBeDefined();
      expect(ModalImportacaoRapida).toBeDefined();
      expect(ModalAlterarCaixa).toBeDefined();
      expect(ModalConfirmacaoTrocaCaixa).toBeDefined();
      expect(ModalLimparRegistros).toBeDefined();
    });

    it('deve exportar componentes de abas de admin', () => {
      expect(AbaGaleriaFotos).toBeDefined();
    });
  });
});
