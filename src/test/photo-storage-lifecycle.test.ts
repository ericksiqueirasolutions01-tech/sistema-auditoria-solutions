// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { idb } from '../db/indexedDb';
import {
  capturarFotoLocal,
  prepararUploadFoto,
  executarUploadFoto,
  obterFotoParaVisualizacao,
  ALLOWED_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
} from '../services/photoStorageService';
import fotosHandler, {
  gerarSignedPhotoUrl,
  validarSignedPhotoUrl,
  obterStoragePrivadoFotos,
} from '../../api/central/fotos';
import { sha256Sync, criarTokenSessao } from '../db/storage';
import type { Usuario } from '../types';

describe('GATE 7: Fotos e Evidências Fotográficas Seguras', () => {
  // Amostra válida de PNG 1x1 transparente em Base64
  const mockValidPngBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // Amostra válida de JPEG 1x1 em Base64
  const mockValidJpegBase64 =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  const usuarioOperador: Usuario = {
    id: 10,
    login: 'operador_foto',
    nome: 'Operador de Campo',
    senha: 'hash',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const sessaoValida = criarTokenSessao(usuarioOperador, 'PC-RJ-001');

  beforeEach(async () => {
    await idb.fotos_evidencias.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Ciclo de Vida Completo da Evidência (Gate 7.2)', () => {
    it('deve capturar a foto localmente com status inicial LOCAL_ONLY e SHA-256 gerado', async () => {
      const foto = await capturarFotoLocal({
        entityType: 'CAIXA',
        entityId: 'CAIXA-01-RJ',
        rotulo: 'Foto dos produtos 1',
        dadosBase64: mockValidPngBase64,
        descricao: 'Evidência de abertura de caixa',
      });

      expect(foto.id).toBeDefined();
      expect(foto.sync_status).toBe('LOCAL_ONLY');
      expect(foto.mime_type).toBe('image/png');
      expect(foto.tamanho_bytes).toBeGreaterThan(0);
      expect(foto.sha256).toMatch(/^[a-f0-9]{64}$/i);
      expect(foto.storage_path).toBeNull();
      expect(foto.signed_url).toBeNull();

      // Verificar persistência no IndexedDB
      const salvaNoBanco = await idb.fotos_evidencias.get(foto.id);
      expect(salvaNoBanco).toBeDefined();
      expect(salvaNoBanco?.sync_status).toBe('LOCAL_ONLY');
    });

    it('deve transitar para PENDING_UPLOAD ao preparar envio para o servidor central', async () => {
      const foto = await capturarFotoLocal({
        entityType: 'LOTE',
        entityId: 'LOTE-100',
        rotulo: 'Espelho da Caixa',
        dadosBase64: mockValidJpegBase64,
      });

      const fotoPreparada = await prepararUploadFoto(foto.id);
      expect(fotoPreparada?.sync_status).toBe('PENDING_UPLOAD');

      const noBanco = await idb.fotos_evidencias.get(foto.id);
      expect(noBanco?.sync_status).toBe('PENDING_UPLOAD');
    });

    it('deve transitar por UPLOADING e concluir com UPLOADED e URL assinada', async () => {
      const foto = await capturarFotoLocal({
        entityType: 'LOTE',
        entityId: 'LOTE-101',
        rotulo: 'Lacre de Segurança',
        dadosBase64: mockValidJpegBase64,
      });

      // Simular chamada mockada do fetch para o endpoint /api/central/fotos
      global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
        let reqBody = JSON.parse(opts.body);
        let resStatus = 200;
        let resJson: any = null;

        const reqMock = {
          method: opts.method,
          headers: opts.headers,
          body: reqBody,
        };

        const resMock = {
          status: (code: number) => {
            resStatus = code;
            return {
              json: (data: any) => {
                resJson = data;
              },
            };
          },
          setHeader: vi.fn(),
        };

        await fotosHandler(reqMock, resMock);

        return {
          ok: resStatus >= 200 && resStatus < 300,
          status: resStatus,
          json: async () => resJson,
        };
      });

      const resultado = await executarUploadFoto(foto.id, {
        token: sessaoValida.token,
        usuario: { login: usuarioOperador.login, nome: usuarioOperador.nome },
      });

      expect(resultado.sucesso).toBe(true);
      expect(resultado.status).toBe('UPLOADED');
      expect(resultado.storage_path).toBeDefined();
      expect(resultado.signed_url).toContain('/api/central/fotos?id=');

      const atualizada = await idb.fotos_evidencias.get(foto.id);
      expect(atualizada?.sync_status).toBe('UPLOADED');
      expect(atualizada?.sincronizado_em).toBeDefined();
      expect(atualizada?.upload_attempts).toBe(1);
    });

    it('deve transitar para FAILED e registrar o erro em caso de falha de conexão', async () => {
      const foto = await capturarFotoLocal({
        entityType: 'CAIXA',
        entityId: 'CAIXA-02-RJ',
        rotulo: 'Foto dos produtos 2',
        dadosBase64: mockValidJpegBase64,
      });

      // Simular falha de rede
      global.fetch = vi.fn().mockRejectedValue(new Error('Network request failed / Offline'));

      const resultado = await executarUploadFoto(foto.id, {
        token: sessaoValida.token,
      });

      expect(resultado.sucesso).toBe(false);
      expect(resultado.status).toBe('FAILED');
      expect(resultado.erro).toMatch(/Network request failed/i);

      const noBanco = await idb.fotos_evidencias.get(foto.id);
      expect(noBanco?.sync_status).toBe('FAILED');
      expect(noBanco?.last_error).toMatch(/Network request failed/i);
      expect(noBanco?.upload_attempts).toBe(1);
    });
  });

  describe('2. Validação Criptográfica de SHA-256 e Anti-Tampering (Gate 7.1)', () => {
    it('deve rejeitar upload no servidor central se o SHA-256 declarado não coincidir com o payload binário', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const reqMock = {
        method: 'POST',
        headers: {
          authorization: `Bearer ${sessaoValida.token}`,
        },
        body: {
          id: 'test-tampered-photo-001',
          entity_type: 'CAIXA',
          entity_id: 'CAIXA-TAMPER',
          mime_type: 'image/png',
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Hash vazio / adulterado
          dados_base64: mockValidPngBase64, // Dados não-vazios
          usuario: { login: 'admin', nome: 'Admin' },
        },
      };

      const resMock = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
        setHeader: vi.fn(),
      };

      await fotosHandler(reqMock, resMock);

      expect(statusCode).toBe(400);
      expect(responseBody.sucesso).toBe(false);
      expect(responseBody.erro).toMatch(/SHA-256 divergente/i);
    });
  });

  describe('3. Allowlist de MIME Types e Limite de Tamanho (Gate 7.4)', () => {
    it('deve rejeitar formatos não autorizados (ex: SVG, PDF, HTML, EXE)', async () => {
      // SVG falso / tentativa de XSS
      const svgFake = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';

      await expect(
        capturarFotoLocal({
          entityType: 'CAIXA',
          entityId: 'CX-TEST',
          rotulo: 'Foto Invalida',
          dadosBase64: svgFake,
        })
      ).rejects.toThrow(/rejeitada: Imagens simuladas|Formato de imagem não suportado/i);
    });

    it('deve rejeitar no servidor arquivos com MIME type fora da allowlist', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const reqMock = {
        method: 'POST',
        headers: { authorization: `Bearer ${sessaoValida.token}` },
        body: {
          id: 'test-invalid-mime-001',
          entity_type: 'CAIXA',
          entity_id: 'CX-01',
          mime_type: 'application/pdf',
          dados_base64: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...',
          usuario: { login: 'admin', nome: 'Admin' },
        },
      };

      const resMock = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
        setHeader: vi.fn(),
      };

      await fotosHandler(reqMock, resMock);

      expect(statusCode).toBe(415);
      expect(responseBody.erro).toMatch(/MIME type não suportado/i);
    });

    it('deve rejeitar arquivos que excedam o limite máximo de 10MB', async () => {
      // Criar buffer simulado maior que 10MB
      const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 'A');
      const bigBase64 = `data:image/jpeg;base64,${bigBuffer.toString('base64')}`;

      await expect(
        capturarFotoLocal({
          entityType: 'CAIXA',
          entityId: 'CX-BIG',
          rotulo: 'Foto Gigante',
          dadosBase64: bigBase64,
        })
      ).rejects.toThrow(/excede o tamanho máximo/i);
    });
  });

  describe('4. Autenticação e Segurança de Acesso (Gate 7.1 e 7.4)', () => {
    it('deve rejeitar upload sem autenticação (HTTP 401)', async () => {
      let statusCode = 0;
      let responseBody: any = null;

      const reqMock = {
        method: 'POST',
        headers: {}, // Sem Authorization
        body: {
          id: 'photo-unauth',
          entity_type: 'CAIXA',
          entity_id: 'CX-01',
          dados_base64: mockValidPngBase64,
        },
      };

      const resMock = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
        setHeader: vi.fn(),
      };

      await fotosHandler(reqMock, resMock);

      expect(statusCode).toBe(401);
      expect(responseBody.erro).toMatch(/Não autenticado/i);
    });

    it('deve gerar URLs assinadas com TTL curto (15 min) e validar integridade da assinatura', () => {
      const fotoId = 'evidencia-uuid-1234';
      const { signed_url, exp, signature } = gerarSignedPhotoUrl(fotoId, 900);

      expect(signed_url).toContain(`id=${fotoId}`);
      expect(signed_url).toContain(`exp=${exp}`);
      expect(signed_url).toContain(`sig=${signature}`);

      // Validação válida
      const validacaoOk = validarSignedPhotoUrl(fotoId, exp, signature);
      expect(validacaoOk.valido).toBe(true);

      // Assinatura adulterada
      const validacaoAdulterada = validarSignedPhotoUrl(fotoId, exp, 'assinatura_falsa_123');
      expect(validacaoAdulterada.valido).toBe(false);
      expect(validacaoAdulterada.erro).toMatch(/inválida ou adulterada/i);

      // URL expirada
      const expPassado = Math.floor(Date.now() / 1000) - 60; // 1 minuto atrás
      const validacaoExpirada = validarSignedPhotoUrl(fotoId, expPassado, signature);
      expect(validacaoExpirada.valido).toBe(false);
      expect(validacaoExpirada.erro).toMatch(/URL assinada expirada/i);
    });
  });

  describe('5. Proibição de Placeholders e SVGs Simulados (Gate 7.3)', () => {
    it('deve proibir fotos vazias ou simuladas em conformidade estrita com a regra 11.3', async () => {
      await expect(
        capturarFotoLocal({
          entityType: 'CAIXA',
          entityId: 'CX-01',
          rotulo: 'Foto Fake',
          dadosBase64: 'data:image/svg+xml;base64,placeholder-fake-svg',
        })
      ).rejects.toThrow(/rejeitada/i);
    });
  });

  describe('6. Visualização com Prioridade Local Offline (Gate 7.1)', () => {
    it('deve priorizar a recuperação do Base64 local quando disponível no IndexedDB', async () => {
      const foto = await capturarFotoLocal({
        entityType: 'CAIXA',
        entityId: 'CX-01',
        rotulo: 'Foto Local',
        dadosBase64: mockValidPngBase64,
      });

      const resVisualizacao = await obterFotoParaVisualizacao(foto.id);
      expect(resVisualizacao.sucesso).toBe(true);
      expect(resVisualizacao.origem).toBe('LOCAL');
      expect(resVisualizacao.dadosBase64).toBe(mockValidPngBase64);
    });
  });
});
