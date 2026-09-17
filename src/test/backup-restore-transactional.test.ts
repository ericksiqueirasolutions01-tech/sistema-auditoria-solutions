// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/storage';
import { idb } from '../db/indexedDb';
import {
  validarArquivoBackup,
  gerarBackupCompleto,
  executarDryRunBackup,
  executarRestoreTransacional,
  executarRollbackSnapshot,
  BACKUP_FORMAT_VERSION,
  MAX_BACKUP_SIZE_BYTES,
} from '../services/backupRestoreService';
import type { Usuario, BackupManifest } from '../types';

describe('GATE 8: Backup e Restore Transacional com Manifesto Criptográfico', () => {
  const usuarioAdmin: Usuario = {
    id: 1,
    login: 'admin',
    nome: 'Administrador do Sistema',
    senha: 'hash_senha_secreta_admin',
    perfil: 'ADMINISTRADOR',
    regional: null,
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  const usuarioOperador: Usuario = {
    id: 2,
    login: 'operador1',
    nome: 'Operador de Bipagem',
    senha: 'hash_senha_operador',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: new Date().toISOString(),
  };

  beforeEach(async () => {
    localStorage.clear();
    db.limparTudoMemoria();
    db.setUsuarioAtual(usuarioAdmin);
  });

  describe('1. Validação de Arquivos de Backup (Extensão e Tamanho)', () => {
    it('deve aceitar arquivos com extensão .json e .bak com tamanho válido', () => {
      const arqJson = { name: 'backup_2026.json', size: 1024 * 50 };
      const arqBak = { name: 'backup_2026.bak', size: 1024 * 100 };

      expect(validarArquivoBackup(arqJson).valido).toBe(true);
      expect(validarArquivoBackup(arqBak).valido).toBe(true);
    });

    it('deve rejeitar arquivos com extensões não autorizadas (.exe, .csv, .db, .txt)', () => {
      const extensoesProibidas = ['backup.exe', 'dados.csv', 'banco.db', 'script.sh', 'nota.txt'];
      for (const nome of extensoesProibidas) {
        const res = validarArquivoBackup({ name: nome, size: 1024 });
        expect(res.valido).toBe(false);
        expect(res.erro).toContain('Extensão de arquivo não permitida');
      }
    });

    it('deve rejeitar arquivos vazios (0 bytes)', () => {
      const res = validarArquivoBackup({ name: 'backup.json', size: 0 });
      expect(res.valido).toBe(false);
      expect(res.erro).toContain('0 bytes');
    });

    it('deve rejeitar arquivos maiores que o limite de 50MB', () => {
      const res = validarArquivoBackup({
        name: 'backup_gigante.json',
        size: MAX_BACKUP_SIZE_BYTES + 1024,
      });
      expect(res.valido).toBe(false);
      expect(res.erro).toContain('excede o tamanho máximo');
    });
  });

  describe('2. Geração do Manifesto v1 e Redação de Senhas (Gate 12.1)', () => {
    it('deve gerar backup completo contendo manifesto v1 com campos obrigatórios e checksum SHA-256', async () => {
      // Inserir alguns dados de teste
      db.inserirProduto({
        modelo_produto: 'Galaxy S24 Ultra',
        ean: '7892509133456',
        serial: '357847400000001',
        numero_caixa: 'CAIXA 01',
        numero_lote: 'LOTE-TESTE-01',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      const { manifest, jsonConteudo, nomeArquivo } = await gerarBackupCompleto();

      expect(manifest.format_version).toBe(BACKUP_FORMAT_VERSION);
      expect(manifest.app_version).toBeDefined();
      expect(manifest.created_at).toBeDefined();
      expect(manifest.device_id).toBeDefined();
      expect(manifest.tables.produtos).toHaveLength(1);
      expect(manifest.summary.total_produtos).toBe(1);
      expect(manifest.checksum).toHaveLength(64); // SHA-256 hex string
      expect(nomeArquivo).toMatch(/^backup_auditoria_solutions_v/);

      // O JSON gerado deve ser válido
      const parsed = JSON.parse(jsonConteudo);
      expect(parsed.format_version).toBe(1);
      expect(parsed.checksum).toBe(manifest.checksum);
    });

    it('REGRA 12.1: NUNCA deve incluir senhas em texto puro no manifesto de backup', async () => {
      const { manifest, jsonConteudo } = await gerarBackupCompleto();

      expect(manifest.tables.usuarios.length).toBeGreaterThan(0);
      for (const u of manifest.tables.usuarios) {
        expect((u as any).senha).toBeUndefined();
      }

      // Verificação textual no JSON final
      const parsed = JSON.parse(jsonConteudo);
      for (const u of parsed.tables.usuarios) {
        expect(u.senha).toBeUndefined();
      }
    });

    it('db.gerarArquivoBackup() em storage.ts deve produzir o manifesto v1 seguro com checksum', () => {
      const backupRaw = db.gerarArquivoBackup();
      const parsed: BackupManifest = JSON.parse(backupRaw);

      expect(parsed.format_version).toBe(1);
      expect(parsed.checksum).toHaveLength(64);
      expect(parsed.tables).toBeDefined();
      expect(parsed.tables.produtos).toBeDefined();
      for (const u of parsed.tables.usuarios) {
        expect((u as any).senha).toBeUndefined();
      }
    });
  });

  describe('3. Validação Dry-Run de Integridade Criptográfica (Gate 12.2)', () => {
    it('deve aprovar dry-run de um backup íntegro', async () => {
      db.inserirProduto({
        modelo_produto: 'Galaxy A55 5G',
        ean: '7892509134125',
        serial: '357847400000002',
        numero_caixa: 'CAIXA 01',
        numero_lote: 'LOTE-TESTE-02',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      const { jsonConteudo } = await gerarBackupCompleto();
      const dryRun = executarDryRunBackup(jsonConteudo);

      expect(dryRun.valido).toBe(true);
      expect(dryRun.detalhes.checksumValido).toBe(true);
      expect(dryRun.detalhes.totalProdutos).toBe(1);
    });

    it('deve rejeitar dry-run quando o conteúdo for adulterado (Checksum Divergente)', async () => {
      db.inserirProduto({
        modelo_produto: 'Galaxy Tab S9 FE',
        ean: '7892509131452',
        serial: '357847400000003',
        numero_caixa: 'CAIXA 01',
        numero_lote: 'LOTE-TESTE-03',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      const { jsonConteudo } = await gerarBackupCompleto();
      const obj = JSON.parse(jsonConteudo);

      // Adulteração: modifica o nome do modelo sem recalcular o checksum
      obj.tables.produtos[0].modelo_produto = 'PRODUTO ADULTERADO FRAUDULENTO';
      const adulteradoJson = JSON.stringify(obj);

      const dryRun = executarDryRunBackup(adulteradoJson);

      expect(dryRun.valido).toBe(false);
      expect(dryRun.detalhes.checksumValido).toBe(false);
      expect(dryRun.erro).toContain('checksum SHA-256 do arquivo diverge');
    });

    it('deve rejeitar backup com formato de versão futura incompatível', () => {
      const manifestFuturo = {
        format_version: 999,
        app_version: '99.0',
        tables: { produtos: [] },
        checksum: 'abc',
      };
      const dryRun = executarDryRunBackup(JSON.stringify(manifestFuturo));

      expect(dryRun.valido).toBe(false);
      expect(dryRun.erro).toContain('Versão do formato de backup incompatível');
    });

    it('deve suportar formato legado de backup para retrocompatibilidade', () => {
      const backupLegado = {
        versao: '1.0',
        gerado_em: '2026-01-01T00:00:00.000Z',
        produtos: [
          {
            id: 'PROD-1',
            modelo_produto: 'Galaxy S23',
            ean: '7892509123456',
            serial: '357847400000099',
            numero_caixa: 'CAIXA 01',
            numero_lote: 'LOTE-LEG-01',
            data_auditoria: '2026-01-01',
            produto_lacrado: 'SIM',
            regional: 'VIA VAREJO RJ',
            usuario_cadastro: 'admin',
          },
        ],
        usuarios: [],
      };

      const dryRun = executarDryRunBackup(JSON.stringify(backupLegado));
      expect(dryRun.valido).toBe(true);
      expect(dryRun.detalhes.totalProdutos).toBe(1);
    });
  });

  describe('4. Execução Transacional do Restore e Segurança (Gate 12.2)', () => {
    it('deve bloquear a restauração por operadores não administradores', async () => {
      const { jsonConteudo } = await gerarBackupCompleto();

      // Tentativa com operador comum
      const res = await executarRestoreTransacional(jsonConteudo, usuarioOperador);

      expect(res.sucesso).toBe(false);
      expect(res.erro).toContain('Acesso negado: Apenas Administradores');
    });

    it('deve criar snapshot pré-restore e restaurar registros de forma transacional', async () => {
      // 1. Inserir produto inicial no banco
      db.inserirProduto({
        modelo_produto: 'Galaxy Inicial',
        ean: '7890000000001',
        serial: '357847400000011',
        numero_caixa: 'CAIXA 01',
        numero_lote: 'LOTE-INI-01',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });
      const { jsonConteudo: backupValido } = await gerarBackupCompleto();

      // 2. Modificar banco atual (outro produto)
      db.limparTudoMemoria();
      db.inserirProduto({
        modelo_produto: 'Galaxy Novo Modificado',
        ean: '7890000000002',
        serial: '357847400000022',
        numero_caixa: 'CAIXA 02',
        numero_lote: 'LOTE-MOD-01',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      // 3. Executar restauração do backup anterior
      const resultado = await executarRestoreTransacional(backupValido, usuarioAdmin);

      expect(resultado.sucesso).toBe(true);
      expect(resultado.totalImportado).toBe(1);
      expect(resultado.snapshotId).toMatch(/^solutions_backup_snapshot_pre_restore_/);

      // Verificar dados restaurados
      const produtosAtuais = db.listarProdutos();
      expect(produtosAtuais).toHaveLength(1);
      expect(produtosAtuais[0].serial).toBe('357847400000011');
      expect(produtosAtuais[0].modelo_produto).toBe('Galaxy Inicial');

      // Verificar se audit log da restauração foi registrado
      const historico = db.listarHistorico();
      const registroAudit = historico.find((h) => h.acao === 'RESTAURACAO_BACKUP');
      expect(registroAudit).toBeDefined();
      expect(registroAudit?.detalhes).toContain(resultado.snapshotId);
    });

    it('deve preservar as senhas locais ativas e nunca sobrescrevê-las com valores vazios', async () => {
      // Cadastrar usuário local com senha
      const usuariosAntes = db.listarUsuarios();
      const adminAntes = usuariosAntes.find((u) => u.login === 'ADMIN');
      expect(adminAntes).toBeDefined();

      const { jsonConteudo } = await gerarBackupCompleto();

      // Executa o restore
      const resultado = await executarRestoreTransacional(jsonConteudo, usuarioAdmin);
      expect(resultado.sucesso).toBe(true);

      // As credenciais de usuários locais não devem ter sido corrompidas
      const usuariosDepois = db.listarUsuarios();
      const adminDepois = usuariosDepois.find((u) => u.login === 'ADMIN');
      expect(adminDepois?.senha).toBe(adminAntes?.senha);
    });

    it('deve permitir rollback manual utilizando o snapshot pré-restore', async () => {
      // Estado A
      db.inserirProduto({
        modelo_produto: 'Produto Estado A',
        ean: '7890000000010',
        serial: '357847400000010',
        numero_caixa: 'CAIXA A',
        numero_lote: 'LOTE-A',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      // Gerar backup do Estado B (outro produto)
      db.limparTudoMemoria();
      db.inserirProduto({
        modelo_produto: 'Produto Estado B',
        ean: '7890000000020',
        serial: '357847400000020',
        numero_caixa: 'CAIXA B',
        numero_lote: 'LOTE-B',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });
      const { jsonConteudo: backupB } = await gerarBackupCompleto();

      // Voltar ao Estado A no banco
      db.limparTudoMemoria();
      db.inserirProduto({
        modelo_produto: 'Produto Estado A',
        ean: '7890000000010',
        serial: '357847400000010',
        numero_caixa: 'CAIXA A',
        numero_lote: 'LOTE-A',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      // Restaurar Estado B (isso cria um snapshot do Estado A)
      const resRestore = await executarRestoreTransacional(backupB, usuarioAdmin);
      expect(resRestore.sucesso).toBe(true);
      expect(db.listarProdutos()[0].serial).toBe('357847400000020');

      // Agora acionar rollback usando o snapshotId gerado
      const okRollback = await executarRollbackSnapshot(resRestore.snapshotId!);
      expect(okRollback).toBe(true);

      // O banco deve ter retornado com sucesso ao Estado A
      const produtosAposRollback = db.listarProdutos();
      expect(produtosAposRollback).toHaveLength(1);
      expect(produtosAposRollback[0].serial).toBe('357847400000010');
      expect(produtosAposRollback[0].modelo_produto).toBe('Produto Estado A');
    });
  });

  describe('5. Suporte em storage.ts: db.restaurarDeBackup()', () => {
    it('deve restaurar com validação de checksum e rejeitar arquivo adulterado', async () => {
      db.inserirProduto({
        modelo_produto: 'Galaxy S24+',
        ean: '7892509133463',
        serial: '357847400000050',
        numero_caixa: 'CAIXA 01',
        numero_lote: 'LOTE-ST-01',
        data_auditoria: '2026-03-16',
        produto_lacrado: 'SIM',
        regional: 'VIA VAREJO RJ',
      });

      const backupRaw = db.gerarArquivoBackup();

      // Restauração legítima
      db.limparTudoMemoria();
      const resValido = db.restaurarDeBackup(backupRaw);
      expect(resValido.sucesso).toBe(true);
      expect(resValido.totalImportado).toBe(1);

      // Adulterar backup
      const obj = JSON.parse(backupRaw);
      obj.tables.produtos[0].serial = 'IMEI_FALSO';
      const adulterado = JSON.stringify(obj);

      const resInvalido = db.restaurarDeBackup(adulterado);
      expect(resInvalido.sucesso).toBe(false);
      expect(resInvalido.erro).toContain('Integridade violada');
    });
  });
});
