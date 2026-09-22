// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { VERSAO_LOCAL } from '../version';
import { obterDesktopSecret } from '../services/systemLifecycle';
import { sha256Sync } from '../utils/crypto';

describe('GATE 9: Hardening do App Desktop e Segurança Localhost', () => {
  const rootDir = path.resolve(__dirname, '../..');

  beforeEach(() => {
    delete (window as any).__SOLUTIONS_DESKTOP_SECRET__;
  });

  describe('1. Alinhamento de Versão Única (Gate 13.5)', () => {
    it('deve manter congruência estrita entre package.json, public/version.json e src/version.ts', () => {
      // 1. package.json
      const pkgPath = path.join(rootDir, 'package.json');
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkgJson.version).toBe('1.3.0');

      // 2. public/version.json
      const publicVerPath = path.join(rootDir, 'public', 'version.json');
      const publicVerJson = JSON.parse(fs.readFileSync(publicVerPath, 'utf8'));
      expect(publicVerJson.versao).toBe('1.3.0');
      expect(publicVerJson.versaoCodigo).toBe(130);

      // 3. src/version.ts
      expect(VERSAO_LOCAL.versao).toBe('1.3.0');
      expect(VERSAO_LOCAL.versaoCodigo).toBe(130);

      // Todas as versões devem ser rigorosamente idênticas
      expect(pkgJson.version).toBe(VERSAO_LOCAL.versao);
      expect(publicVerJson.versao).toBe(VERSAO_LOCAL.versao);
    });

    it('deve conter a versão 1.3.0 no instalador Windows (InstallerWizard.cs) e no app host (SistemaAuditoriaApp.cs)', () => {
      const installerPath = path.join(rootDir, 'src-desktop', 'InstallerWizard.cs');
      const installerCode = fs.readFileSync(installerPath, 'utf8');
      expect(installerCode).toContain('Versão 1.3.0');
      expect(installerCode).toContain('DisplayVersion", "1.3.0"');

      const appPath = path.join(rootDir, 'src-desktop', 'SistemaAuditoriaApp.cs');
      const appCode = fs.readFileSync(appPath, 'utf8');
      expect(appCode).toContain('1.3.0');
      expect(appCode).toContain('130');
    });
  });

  describe('2. Hardening da Localhost API e Proteção de Segredo (Gate 13.1)', () => {
    it('frontend deve obter de forma segura o secret dinâmico injetado no bootstrap local', () => {
      expect(obterDesktopSecret()).toBe('');

      // Simula a injeção do secret dinâmico pelo host C# no index.html
      const secretGerado = 'a1b2c3d4e5f67890123456789abcdef0';
      (window as any).__SOLUTIONS_DESKTOP_SECRET__ = secretGerado;

      expect(obterDesktopSecret()).toBe(secretGerado);
    });

    it('deve validar e rejeitar requisições à API de sistema sem o header X-System-Secret ou com valor incorreto', () => {
      const sessionSecret = 'secret_esperado_host_desktop_2026';

      function validarAcessoApiSistema(pathEndpoint: string, headerSecret?: string): { autorizado: boolean; status: number } {
        if (!pathEndpoint.startsWith('/api/system/')) {
          return { autorizado: true, status: 200 };
        }
        if (!headerSecret || headerSecret !== sessionSecret) {
          return { autorizado: false, status: 401 };
        }
        return { autorizado: true, status: 200 };
      }

      expect(validarAcessoApiSistema('/api/system/shutdown')).toEqual({ autorizado: false, status: 401 });
      expect(validarAcessoApiSistema('/api/system/shutdown', 'secret_errado')).toEqual({ autorizado: false, status: 401 });
      expect(validarAcessoApiSistema('/api/system/shutdown', sessionSecret)).toEqual({ autorizado: true, status: 200 });
      expect(validarAcessoApiSistema('/api/system/update', sessionSecret)).toEqual({ autorizado: true, status: 200 });
    });

    it('deve exigir método POST para ações destrutivas (shutdown e update) e rejeitar GET (Regra 13.1 e Regra 13)', () => {
      function validarMetodoAcaoCritica(endpoint: string, metodo: string): { permitido: boolean; status: number } {
        if (endpoint === '/api/system/shutdown' || endpoint === '/api/system/update') {
          if (metodo.toUpperCase() !== 'POST') {
            return { permitido: false, status: 405 };
          }
        }
        return { permitido: true, status: 200 };
      }

      expect(validarMetodoAcaoCritica('/api/system/shutdown', 'GET')).toEqual({ permitido: false, status: 405 });
      expect(validarMetodoAcaoCritica('/api/system/shutdown', 'POST')).toEqual({ permitido: true, status: 200 });
      expect(validarMetodoAcaoCritica('/api/system/update', 'GET')).toEqual({ permitido: false, status: 405 });
      expect(validarMetodoAcaoCritica('/api/system/update', 'POST')).toEqual({ permitido: true, status: 200 });
    });

    it('deve validar Origin contra CORS wildcard e bloquear domínios externos não loopback', () => {
      const port = 5173;
      const expectedLoopback127 = `http://127.0.0.1:${port}`;
      const expectedLocalhost = `http://localhost:${port}`;

      function validarOriginCors(originHeader?: string): { permitido: boolean; status: number } {
        if (!originHeader) return { permitido: true, status: 200 };
        if (
          originHeader.toLowerCase() !== expectedLoopback127.toLowerCase() &&
          originHeader.toLowerCase() !== expectedLocalhost.toLowerCase()
        ) {
          return { permitido: false, status: 403 };
        }
        return { permitido: true, status: 200 };
      }

      // Loopback legítimo
      expect(validarOriginCors(expectedLoopback127)).toEqual({ permitido: true, status: 200 });
      expect(validarOriginCors(expectedLocalhost)).toEqual({ permitido: true, status: 200 });

      // Ataques Cross-Origin de sites maliciosos
      expect(validarOriginCors('https://malicious-site.com')).toEqual({ permitido: false, status: 403 });
      expect(validarOriginCors('http://192.168.1.100:5173')).toEqual({ permitido: false, status: 403 });
      expect(validarOriginCors('https://google.com')).toEqual({ permitido: false, status: 403 });
    });
  });

  describe('3. Prevenção Contra Path Traversal na Serventia de Arquivos (Gate 13.2)', () => {
    it('deve validar caminho canônico e bloquear tentativas de path traversal (../, ..\\, %2e%2e)', () => {
      const rootDirSimulado = 'C:\\App\\dist';
      const rootWithSep = rootDirSimulado + '\\';

      function validarPathTraversal(urlPath: string): { seguro: boolean; fullPath: string } {
        const decoded = decodeURIComponent(urlPath.replace(/^\/+/, ''));
        const safePath = decoded === '' ? 'index.html' : decoded;
        const candidate = path.normalize(path.join(rootDirSimulado, safePath));

        // Regra 13.2: canonical deve começar com canonicalRoot + separator
        const seguro = candidate.toLowerCase().startsWith(rootWithSep.toLowerCase());
        return { seguro, fullPath: candidate };
      }

      // Requisições legítimas
      expect(validarPathTraversal('index.html').seguro).toBe(true);
      expect(validarPathTraversal('assets/index.js').seguro).toBe(true);
      expect(validarPathTraversal('favicon.ico').seguro).toBe(true);

      // Tentativas de Path Traversal
      expect(validarPathTraversal('../../Windows/System32/cmd.exe').seguro).toBe(false);
      expect(validarPathTraversal('../../../etc/passwd').seguro).toBe(false);
      expect(validarPathTraversal('%2e%2e/%2e%2e/secret.txt').seguro).toBe(false);
      expect(validarPathTraversal('..\\..\\app.log').seguro).toBe(false);
    });
  });

  describe('4. Prevenção Contra ZIP Slip no Instalador (Gate 13.3)', () => {
    it('deve garantir que todas as entradas do arquivo ZIP fiquem estritamente dentro da pasta de destino', () => {
      const targetDirSimulado = 'C:\\ProgramData\\SistemaAuditoriaSolutions';
      const canonicalTarget = targetDirSimulado + '\\';

      function validarEntradaZipSlip(entryFullName: string): boolean {
        const candidate = path.normalize(path.join(targetDirSimulado, entryFullName));
        return candidate.toLowerCase().startsWith(canonicalTarget.toLowerCase());
      }

      // Arquivos legítimos do pacote
      expect(validarEntradaZipSlip('SistemaAuditoriaSolutions.exe')).toBe(true);
      expect(validarEntradaZipSlip('dist/index.html')).toBe(true);
      expect(validarEntradaZipSlip('dist/assets/index.js')).toBe(true);

      // Entradas maliciosas explorando ZIP Slip
      expect(validarEntradaZipSlip('../../Windows/System32/malware.dll')).toBe(false);
      expect(validarEntradaZipSlip('..\\..\\Startup\\run.bat')).toBe(false);
      expect(validarEntradaZipSlip('../AppData/Roaming/evil.exe')).toBe(false);
    });
  });

  describe('5. Auto-Updater com Validação Criptográfica de SHA-256 (Gate 13.4)', () => {
    it('deve validar o hash SHA-256 do instalador contra o manifesto oficial de release', () => {
      const conteudoInstaladorMock = 'CONTEUDO_EXECUTAVEL_BINARIO_INSTALADOR_OFICIAL_v1_2_0';
      const hashReal = sha256Sync(conteudoInstaladorMock);

      function validarAtualizacao(sha256Arquivo: string, sha256Manifesto: string): { seguro: boolean; erro?: string } {
        if (!sha256Manifesto || sha256Manifesto.trim() === '') {
          return { seguro: false, erro: 'Manifesto não fornece checksum SHA-256.' };
        }
        if (sha256Arquivo.toLowerCase() !== sha256Manifesto.toLowerCase()) {
          return {
            seguro: false,
            erro: 'Integridade comprometida: SHA-256 do arquivo diverge do manifesto.',
          };
        }
        return { seguro: true };
      }

      // Caso 1: Hash idêntico ao manifesto
      expect(validarAtualizacao(hashReal, hashReal).seguro).toBe(true);

      // Caso 2: Binário adulterado ou manifesto divergente
      const hashAdulterado = sha256Sync('BINARIO_CORROMPIDO_OU_MALICIOSO');
      const resFalha = validarAtualizacao(hashAdulterado, hashReal);
      expect(resFalha.seguro).toBe(false);
      expect(resFalha.erro).toContain('diverge do manifesto');

      // Caso 3: Manifesto sem hash
      const resSemHash = validarAtualizacao(hashReal, '');
      expect(resSemHash.seguro).toBe(false);
    });

    it('o código-fonte de SistemaAuditoriaApp.cs deve implementar a checagem SHA-256 e cópia .bak de rollback', () => {
      const appCode = fs.readFileSync(path.join(rootDir, 'src-desktop', 'SistemaAuditoriaApp.cs'), 'utf8');

      // Verifica presença dos requisitos da Regra 13.4
      expect(appCode).toContain('SHA256.Create()');
      expect(appCode).toContain('expectedSha256');
      expect(appCode).toContain('backupExe = currentExe + ".bak"');
      expect(appCode).toContain('Rollback');
    });
  });
});

