// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  isAdminOuSuper,
  isSupervisor,
  podeAcessarRegional,
  criarTokenSessao,
  validarTokenSessao,
  hashSenha,
} from '../db/storage';
import syncHandler from '../../api/central/sync';
import type { Usuario, ComputadorInfo } from '../types';

describe('GATE 2: Arquitetura de Identidade, RBAC e Dispositivos', () => {
  beforeEach(() => {
    // Reset estado da sessão
    db.setUsuarioAtual(null as any);
  });

  describe('1. Unauthenticated -> Denied', () => {
    it('deve rejeitar inserção de produto sem usuário autenticado', () => {
      db.setUsuarioAtual(null as any);
      const res = db.inserirProduto({
        imei: '354897001122334',
        numero_lote: 'LOTE-TEST-001',
        regional: 'VIA VAREJO RJ',
      } as any);

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Não autenticado/i);
    });

    it('deve rejeitar cadastro/edição de usuário sem autenticação administrativa', () => {
      db.setUsuarioAtual(null as any);
      const res = db.salvarUsuario({
        nome: 'Hacker',
        login: 'hacker',
        perfil: 'ADMINISTRADOR',
      });

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Acesso negado/i);
    });

    it('deve rejeitar chamada ao sync handler sem usuário informado (HTTP 401)', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const mockReq = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          produtos: [{ imei: '123456789012345', numero_lote: 'L1' }],
          computador: { id: 'PC-01', nome: 'Bancada 1', status: 'ATIVO' },
          // Sem usuário
        },
      };

      const mockRes = {
        setHeader: () => mockRes,
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
      expect(statusCode).toBe(401);
      expect(responseBody?.sucesso).toBe(false);
      expect(responseBody?.erro).toMatch(/Não autorizado/i);
    });
  });

  describe('2. Operator cross-region -> Denied', () => {
    it('deve impedir que operador de RJ insira produto com regional SP', () => {
      const operadorRJ: Usuario = {
        id: 101,
        nome: 'Operador Rio',
        login: 'operador_rj',
        senha: hashSenha('teste123'),
        perfil: 'OPERADOR',
        regional: 'VIA VAREJO RJ',
        ativo: true,
        criado_em: new Date().toISOString(),
      };

      db.setUsuarioAtual(operadorRJ);

      const pode = podeAcessarRegional(operadorRJ, 'VIA VAREJO SP');
      expect(pode).toBe(false);

      const res = db.inserirProduto({
        modelo_produto: 'Galaxy S24',
        ean: '7892509123456',
        imei: '354897001122339',
        numero_lote: 'LOTE-SP-001',
        regional_usuario: 'VIA VAREJO SP',
      } as any);

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Acesso negado/i);
      expect(res.erro).toMatch(/restrito à regional/i);
    });

    it('deve rejeitar sincronização no sync handler quando operador tenta enviar produtos de outra regional (HTTP 403)', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const mockReq = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: {
            login: 'operador_rj',
            nome: 'Operador Rio',
            perfil: 'OPERADOR',
            regional: 'VIA VAREJO RJ',
          },
          computador: { id: 'PC-RJ-01', nome: 'Bancada RJ', status: 'ATIVO' },
          produtos: [
            { imei: '123456789012345', numero_lote: 'L1', regional: 'VIA VAREJO SP' },
          ],
        },
      };

      const mockRes = {
        setHeader: () => mockRes,
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
      expect(statusCode).toBe(403);
      expect(responseBody?.sucesso).toBe(false);
      expect(responseBody?.erro).toMatch(/operador da regional.*tentou sincronizar produtos de outra regional/i);
    });
  });

  describe('3. Operator admin endpoint -> Denied', () => {
    it('deve impedir que operador crie ou salve usuários', () => {
      const operador: Usuario = {
        id: 102,
        nome: 'Operador Padrão',
        login: 'operador_comum',
        senha: hashSenha('teste123'),
        perfil: 'OPERADOR',
        regional: 'VIA VAREJO RJ',
        ativo: true,
        criado_em: new Date().toISOString(),
      };

      db.setUsuarioAtual(operador);

      const res = db.salvarUsuario({
        nome: 'Novo Admin Tentativa',
        login: 'novo_admin',
        perfil: 'ADMINISTRADOR',
      });

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Apenas Administradores podem gerenciar usuários/i);
    });

    it('deve impedir que operador reabra lotes finalizados', () => {
      const operador: Usuario = {
        id: 102,
        nome: 'Operador Padrão',
        login: 'operador_comum',
        senha: hashSenha('teste123'),
        perfil: 'OPERADOR',
        regional: 'VIA VAREJO RJ',
        ativo: true,
        criado_em: new Date().toISOString(),
      };

      db.setUsuarioAtual(operador);

      const res = db.reabrirLoteAdmin('LOTE-999', 'VIA VAREJO RJ', 'Operador Padrão', 'Tentativa não autorizada');
      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Operadores não possuem permissão para reabrir lotes/i);
    });

    it('deve impedir que operador revogue ou reative dispositivos', () => {
      const operador: Usuario = {
        id: 102,
        nome: 'Operador Padrão',
        login: 'operador_comum',
        senha: hashSenha('teste123'),
        perfil: 'OPERADOR',
        regional: 'VIA VAREJO RJ',
        ativo: true,
        criado_em: new Date().toISOString(),
      };

      db.setUsuarioAtual(operador);

      const res = db.revogarDispositivo('PC-001', 'Tentativa operador');
      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Apenas Administradores/i);
    });
  });

  describe('4. Supervisor own region -> Allowed', () => {
    it('deve permitir supervisor atuar na sua própria regional', () => {
      const supervisorRJ: Usuario = {
        id: 103,
        nome: 'Supervisor Rio',
        login: 'sup_rj',
        senha: hashSenha('teste123'),
        perfil: 'SUPERVISOR_REGIONAL',
        regional: 'VIA VAREJO RJ',
        ativo: true,
        criado_em: new Date().toISOString(),
      };

      expect(isSupervisor(supervisorRJ.perfil)).toBe(true);
      expect(podeAcessarRegional(supervisorRJ, 'VIA VAREJO RJ')).toBe(true);
      expect(podeAcessarRegional(supervisorRJ, 'VIA VAREJO SP')).toBe(false);
    });

    it('deve permitir que supervisor reabra lote de sua própria regional e bloquear de outra regional', () => {
      const supervisorRJ: Usuario = {
        id: 103,
        nome: 'Supervisor Rio',
        login: 'sup_rj',
        senha: hashSenha('teste123'),
        perfil: 'SUPERVISOR_REGIONAL',
        regional: 'VIA VAREJO RJ',
        ativo: true,
        criado_em: new Date().toISOString(),
      };

      db.setUsuarioAtual(supervisorRJ);

      // Tentativa em regional diferente: Negada
      const resSP = db.reabrirLoteAdmin('LOTE-SP-001', 'VIA VAREJO SP', 'Supervisor Rio', 'Erro de auditor');
      expect(resSP.sucesso).toBe(false);
      expect(resSP.erro).toMatch(/Você não possui permissão para reabrir lotes desta regional/i);
    });
  });

  describe('5. Admin allowed action -> Allowed', () => {
    it('deve permitir que Administrador acesse qualquer regional', () => {
      const admin: Usuario = {
        id: 1,
        nome: 'Administrador Central',
        login: 'admin',
        senha: hashSenha('teste123'),
        perfil: 'ADMINISTRADOR',
        regional: null,
        ativo: true,
        criado_em: new Date().toISOString(),
      };

      expect(isAdminOuSuper(admin.perfil)).toBe(true);
      expect(podeAcessarRegional(admin, 'VIA VAREJO RJ')).toBe(true);
      expect(podeAcessarRegional(admin, 'VIA VAREJO SP')).toBe(true);
      expect(podeAcessarRegional(admin, 'VIA VAREJO MG')).toBe(true);
      expect(podeAcessarRegional(admin, 'VIA VAREJO BA')).toBe(true);
    });

    it('deve emitir e validar token de sessão assinado para usuário autenticado', () => {
      const admin: Usuario = {
        id: 1,
        nome: 'Administrador Central',
        login: 'admin',
        senha: hashSenha('teste123'),
        perfil: 'ADMINISTRADOR',
        regional: null,
        ativo: true,
        criado_em: new Date().toISOString(),
      };

      const sessao = criarTokenSessao(admin, 'PC-ADMIN-01');
      expect(sessao.token).toBeDefined();
      expect(sessao.login).toBe('admin');
      expect(sessao.perfil).toBe('ADMINISTRADOR');

      const validacao = validarTokenSessao(sessao.token);
      expect(validacao.valido).toBe(true);
      expect(validacao.sessao?.login).toBe('admin');
    });
  });

  describe('6. Revoked device -> Denied', () => {
    it('deve rejeitar login se o dispositivo local estiver revogado', () => {
      const compRevogado: ComputadorInfo = {
        id: 'PC-REVOGADO-01',
        device_id: '550e8400-e29b-41d4-a716-446655440000',
        nome: 'Bancada Desativada',
        regional: 'VIA VAREJO RJ',
        data_primeiro_uso: new Date().toISOString(),
        status: 'REVOGADO',
        revoked_at: new Date().toISOString(),
      };

      // Simula dispositivo salvo como revogado
      localStorage.setItem('solutions_computador_atual_v1', JSON.stringify(compRevogado));

      const res = db.autenticar('operador_rj', 'senha123');
      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Este dispositivo foi revogado/i);
    });

    it('deve rejeitar inserção de produto se o dispositivo for revogado', () => {
      const compRevogado: ComputadorInfo = {
        id: 'PC-REVOGADO-01',
        device_id: '550e8400-e29b-41d4-a716-446655440000',
        nome: 'Bancada Desativada',
        regional: 'VIA VAREJO RJ',
        data_primeiro_uso: new Date().toISOString(),
        status: 'REVOGADO',
        revoked_at: new Date().toISOString(),
      };

      localStorage.setItem('solutions_computador_atual_v1', JSON.stringify(compRevogado));

      const admin: Usuario = {
        id: 1,
        nome: 'Admin',
        login: 'admin',
        senha: hashSenha('teste'),
        perfil: 'ADMINISTRADOR',
        ativo: true,
        criado_em: new Date().toISOString(),
      };
      db.setUsuarioAtual(admin);

      const res = db.inserirProduto({
        imei: '111222333444555',
        numero_lote: 'LOTE-TEST',
      } as any);

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/Este dispositivo foi revogado/i);
    });

    it('deve rejeitar sincronização no sync handler para dispositivo revogado (HTTP 403)', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const mockReq = {
        method: 'POST',
        headers: { origin: 'https://sistema-auditoria-solutions.vercel.app' },
        body: {
          usuario: { login: 'admin', nome: 'Admin', perfil: 'ADMINISTRADOR' },
          computador: {
            id: 'PC-ROUBO-01',
            nome: 'Estação Perdida',
            status: 'REVOGADO',
          },
          produtos: [{ imei: '123456789012345', numero_lote: 'L1' }],
        },
      };

      const mockRes = {
        setHeader: () => mockRes,
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
      expect(statusCode).toBe(403);
      expect(responseBody?.sucesso).toBe(false);
      expect(responseBody?.erro).toMatch(/Dispositivo bloqueado.*foi revogado/i);
    });
  });
});
