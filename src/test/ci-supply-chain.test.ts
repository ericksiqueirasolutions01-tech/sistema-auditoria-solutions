import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Importar utilitários de validação de supply chain
const {
  runSecretScan,
  verifyArtifactExclusions,
  generateSha256Manifest,
  SECRET_PATTERNS,
  FORBIDDEN_PUBLISH_PATTERNS,
} = require('../../scripts/supply-chain-check.cjs');

describe('GATE 14: CI/CD Pipeline & Supply Chain Security', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');

  describe('1. Verificação Estrutural do Workflow de CI/CD (.github/workflows/ci.yml)', () => {
    it('deve existir o arquivo de workflow ci.yml no caminho padrão do GitHub Actions', () => {
      expect(fs.existsSync(workflowPath)).toBe(true);
    });

    it('deve conter todos os 14 passos obrigatórios exigidos na Seção 18 do Prompt Mestre', () => {
      const content = fs.readFileSync(workflowPath, 'utf8');

      // 1. npm ci
      expect(content).toMatch(/npm\s+ci/);

      // 2. secret scan
      expect(content).toMatch(/secret\s*scan|security:scan/i);

      // 3. typecheck
      expect(content).toMatch(/tsc\s+-b|typecheck/i);

      // 4. lint
      expect(content).toMatch(/npm\s+run\s+lint|lint/i);

      // 5. unit tests
      expect(content).toMatch(/unit\s+tests|npm\s+test/i);

      // 6. integration tests
      expect(content).toMatch(/integration\s+tests/i);

      // 7. build
      expect(content).toMatch(/npm\s+run\s+build|frontend.*build/i);

      // 8. E2E
      expect(content).toMatch(/e2e|e2e-operational-flow/i);

      // 9. SCA/dependency audit
      expect(content).toMatch(/audit|sca/i);

      // 10. build desktop
      expect(content).toMatch(/build-windows-installer\.ps1|build.*desktop/i);

      // 11. sign artifacts
      expect(content).toMatch(/sign\s+artifacts|authenticode/i);

      // 12. hash artifacts
      expect(content).toMatch(/hash\s+artifacts|sha-256|sha256/i);

      // 13. publish staging
      expect(content).toMatch(/publish\s+staging|deploy.*staging/i);

      // 14. smoke
      expect(content).toMatch(/smoke/i);
    });

    it('deve exigir aprovação humana obrigatória para publicação em produção', () => {
      const content = fs.readFileSync(workflowPath, 'utf8');
      expect(content).toContain('environment:');
      expect(content).toContain('name: production');
      expect(content).toMatch(/manual\s+approval/i);
    });
  });

  describe('2. Política Estrita de Não Publicação de Segredos e Dados Locais', () => {
    it('deve proibir publicação de .env, service role keys, tokens e dumps locais', () => {
      const testFilenames = [
        '.env',
        '.env.production',
        '.env.local',
        'server.key',
        'cert.pem',
        'cert.pfx',
        'service_role_key.txt',
        'central_idempotency.json',
        'database.sqlite',
        'dump_2026.sql',
      ];

      for (const fname of testFilenames) {
        const matchesForbidden = FORBIDDEN_PUBLISH_PATTERNS.some((pattern: RegExp) => pattern.test(fname));
        expect(matchesForbidden, `O arquivo ${fname} deveria ser estritamente proibido de publicação`).toBe(true);
      }
    });

    it('deve permitir arquivos legítimos e públicos de distribuição', () => {
      const allowedFilenames = [
        'index.html',
        'index.js',
        'style.css',
        'manifest.json',
        'SHA256SUMS.txt',
        'Sistema-Auditoria-Solutions-Setup.exe',
        'SistemaAuditoriaSolutions.exe',
      ];

      for (const fname of allowedFilenames) {
        const matchesForbidden = FORBIDDEN_PUBLISH_PATTERNS.some((pattern: RegExp) => pattern.test(fname));
        expect(matchesForbidden, `O arquivo legítimo ${fname} não deveria ser bloqueado`).toBe(false);
      }
    });

    it('o repositório atual deve passar com 0 segredos detectados no secret scan', () => {
      const scanPassed = runSecretScan();
      expect(scanPassed).toBe(true);
    });
  });

  describe('3. Hashing Criptográfico SHA-256 e Integridade de Release', () => {
    it('deve calcular hashes SHA-256 e gerar manifesto de distribuição válido', () => {
      const tempDist = path.join(rootDir, 'node_modules', '.temp-test-dist');
      if (!fs.existsSync(tempDist)) {
        fs.mkdirSync(tempDist, { recursive: true });
      }

      const sampleBinary = Buffer.from('FAKE-BINARY-PAYLOAD-FOR-TESTING-PURPOSES');
      fs.writeFileSync(path.join(tempDist, 'SistemaAuditoriaSolutions.exe'), sampleBinary);
      fs.writeFileSync(path.join(tempDist, 'index.html'), '<html><body>Auditoria</body></html>');

      const manifestGenerated = generateSha256Manifest(tempDist);
      expect(manifestGenerated).toBe(true);

      const manifestPath = path.join(tempDist, 'manifest.json');
      const sumsPath = path.join(tempDist, 'SHA256SUMS.txt');

      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(fs.existsSync(sumsPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.algorithm).toBe('SHA-256');
      expect(manifest.system).toBe('Sistema de Auditoria Solutions');
      expect(manifest.files['SistemaAuditoriaSolutions.exe']).toBeDefined();

      const expectedSha256 = crypto.createHash('sha256').update(sampleBinary).digest('hex');
      expect(manifest.files['SistemaAuditoriaSolutions.exe'].sha256).toBe(expectedSha256);

      // Limpeza do diretório temporário de testes
      fs.rmSync(tempDist, { recursive: true, force: true });
    });
  });
});

