import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('GATE 16: Integridade Documental e Conformidade Técnica (Seção 20)', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const readmePath = path.join(rootDir, 'README.md');
  const runbooksPath = path.join(rootDir, 'docs', 'RUNBOOKS.md');
  const manualPath = path.join(rootDir, 'MANUAL_DO_SISTEMA.md');
  const envExamplePath = path.join(rootDir, '.env.example');

  describe('1. Verificação de Existência dos Documentos Obrigatórios', () => {
    it('deve possuir README.md, docs/RUNBOOKS.md, MANUAL_DO_SISTEMA.md e .env.example', () => {
      expect(fs.existsSync(readmePath)).toBe(true);
      expect(fs.existsSync(runbooksPath)).toBe(true);
      expect(fs.existsSync(manualPath)).toBe(true);
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });
  });

  describe('2. Verificação dos 9 Itens Obrigatórios em docs/RUNBOOKS.md (Seção 20)', () => {
    const runbooksContent = fs.readFileSync(runbooksPath, 'utf8');

    it('1. deve documentar a arquitetura técnica completa (Offline-First, Outbox, PostgreSQL Central)', () => {
      expect(runbooksContent).toMatch(/#\s*1\.\s*ARQUITETURA\s+DO\s+SISTEMA/i);
      expect(runbooksContent).toMatch(/Offline-First/i);
      expect(runbooksContent).toMatch(/IndexedDB/i);
      expect(runbooksContent).toMatch(/PostgreSQL/i);
    });

    it('2. deve documentar o setup de desenvolvimento (setup dev)', () => {
      expect(runbooksContent).toMatch(/#\s*2\.\s*SETUP\s+DE\s+DESENVOLVIMENTO/i);
      expect(runbooksContent).toMatch(/npm\s+ci/i);
      expect(runbooksContent).toMatch(/npm\s+run\s+dev/i);
    });

    it('3. deve documentar as variáveis de ambiente sem expor segredos', () => {
      expect(runbooksContent).toMatch(/#\s*3\.\s*VARIÁVEIS\s+DE\s+AMBIENTE/i);
      expect(runbooksContent).toMatch(/VITE_CENTRAL_API_URL/i);
      expect(runbooksContent).not.toMatch(/service_role_key\s*=\s*['"]?[a-zA-Z0-9]{20,}['"]?/i);
    });

    it('4. deve conter o runbook de backup e restore transacional', () => {
      expect(runbooksContent).toMatch(/#\s*4\.\s*RUNBOOK\s+DE\s+BACKUP\s+E\s+RESTORE/i);
      expect(runbooksContent).toMatch(/SHA-256|manifesto/i);
      expect(runbooksContent).toMatch(/snapshot\s+pré-restore/i);
    });

    it('5. deve conter o runbook de sincronização delta e resolução de conflitos', () => {
      expect(runbooksContent).toMatch(/#\s*5\.\s*RUNBOOK\s+DE\s+SINCRONIZAÇÃO\s+DELTA/i);
      expect(runbooksContent).toMatch(/idempot/i);
      expect(runbooksContent).toMatch(/conflito|duplicidade/i);
    });

    it('6. deve conter o runbook de atualização do aplicativo desktop', () => {
      expect(runbooksContent).toMatch(/#\s*6\.\s*RUNBOOK\s+DE\s+ATUALIZAÇÃO/i);
      expect(runbooksContent).toMatch(/build-windows-installer\.ps1/i);
      expect(runbooksContent).toMatch(/Authenticode|assinatura/i);
    });

    it('7. deve documentar a política de release e CI/CD', () => {
      expect(runbooksContent).toMatch(/#\s*7\.\s*POLÍTICA\s+DE\s+RELEASE/i);
      expect(runbooksContent).toMatch(/aprovação\s+humana/i);
      expect(runbooksContent).toMatch(/staging/i);
    });

    it('8. deve documentar a matriz de permissões (RBAC)', () => {
      expect(runbooksContent).toMatch(/#\s*8\.\s*MATRIZ\s+DE\s+PERMISSÕES/i);
      expect(runbooksContent).toMatch(/SUPER_ADMIN/i);
      expect(runbooksContent).toMatch(/OPERADOR/i);
    });

    it('9. deve documentar o plano de rollback e contingência', () => {
      expect(runbooksContent).toMatch(/#\s*9\.\s*PLANO\s+DE\s+ROLLBACK/i);
      expect(runbooksContent).toMatch(/snapshot/i);
      expect(runbooksContent).toMatch(/reversão/i);
    });
  });

  describe('3. Honestidade Técnica e Ausência de Declarações Enganosas (Seção 20)', () => {
    it('README.md não deve alegar falsamente "100% offline sem sincronização" ou omitir IndexedDB', () => {
      const readme = fs.readFileSync(readmePath, 'utf8');
      expect(readme).toMatch(/Offline-First/i);
      expect(readme).toMatch(/IndexedDB/i);
      expect(readme).not.toMatch(/100%\s+offline:\s+sem\s+dependência/i);
    });

    it('.env.example deve conter apenas modelos sem credenciais ou segredos reais', () => {
      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      expect(envExample).not.toMatch(/eyJ[A-Za-z0-9-_=]+/); // No JWT
      expect(envExample).not.toMatch(/AKIA[A-Z0-9]{16}/); // No AWS
      expect(envExample).not.toMatch(/service_role/i); // No service role
    });
  });
});

