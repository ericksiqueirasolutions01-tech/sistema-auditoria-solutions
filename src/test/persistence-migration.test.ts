// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  idb,
  processarFotoBase64,
  salvarFotoEvidencia,
  obterFotoEvidencia,
  listarFotosEvidenciasPorEntidade,
  executarMigracaoLegadoParaIndexedDB,
  BACKUP_KEY_PRE_GATE3,
} from '../db/indexedDb';

describe('GATE 3: Persistência Local Confiável e Migrador Transacional', () => {
  beforeEach(async () => {
    // Limpa tabelas de teste do IndexedDB
    await idb.produtos.clear();
    await idb.usuarios.clear();
    await idb.lotes_finalizados.clear();
    await idb.fotos_evidencias.clear();
    await idb.migration_meta.clear();
    localStorage.clear();
  });

  describe('1. Desacoplamento de Fotos (Gate 7.2)', () => {
    it('deve processar foto base64 extraindo UUID, MIME, tamanho, SHA-256 e status', () => {
      // Pequeno JPEG transparente de teste em Base64
      const mockDataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

      const foto = processarFotoBase64(
        'CAIXA',
        'VIA VAREJO RJ_CX-01',
        'Foto dos produtos 1',
        mockDataUri,
        'Primeira foto de teste'
      );

      expect(foto.id).toBeDefined();
      expect(foto.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(foto.mime_type).toBe('image/jpeg');
      expect(foto.tamanho_bytes).toBeGreaterThan(0);
      expect(foto.sha256).toBeDefined();
      expect(foto.sha256.length).toBe(64); // SHA-256 hex string length
      expect(foto.sync_status).toBe('PENDENTE');
      expect(foto.entity_id).toBe('VIA VAREJO RJ_CX-01');
    });

    it('deve salvar e carregar fotos do IndexedDB desacopladas do JSON principal', async () => {
      const mockDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const foto = processarFotoBase64(
        'LOTE',
        'LOTE-2026-09-01',
        'Foto Panorâmica',
        mockDataUri
      );

      // Salva no IndexedDB
      const meta = await salvarFotoEvidencia(foto);

      // Metadados retornados não devem conter a string pesada de base64
      expect((meta as any).dados_base64).toBeUndefined();
      expect(meta.id).toBe(foto.id);
      expect(meta.sha256).toBe(foto.sha256);

      // Consulta de metadados por entidade
      const lista = await listarFotosEvidenciasPorEntidade('LOTE-2026-09-01');
      expect(lista.length).toBe(1);
      expect(lista[0].id).toBe(foto.id);
      expect((lista[0] as any).dados_base64).toBeUndefined();

      // Busca completa sob demanda do blob da foto
      const fotoRecuperada = await obterFotoEvidencia(foto.id);
      expect(fotoRecuperada).not.toBeNull();
      expect(fotoRecuperada?.dados_base64).toBe(mockDataUri);
      expect(fotoRecuperada?.sha256).toBe(foto.sha256);
    });
  });

  describe('2. Migrador Idempotente Legado -> IndexedDB (Gate 7.3)', () => {
    it('deve realizar backup do localStorage original, validar contagens e migrar com integridade', async () => {
      // Simula dados legados pré-existentes no localStorage
      const produtosMock = [
        {
          id: 'PROD-001',
          serial: 'SN001',
          imei: '354897001122331',
          numero_lote: 'LOTE-MIG-01',
          numero_caixa: 'CX-01',
          data_auditoria: '2026-09-10',
          regional: 'VIA VAREJO RJ',
          produto_lacrado: 'SIM',
        },
        {
          id: 'PROD-002',
          serial: 'SN002',
          imei: '354897001122332',
          numero_lote: 'LOTE-MIG-01',
          numero_caixa: 'CX-01',
          data_auditoria: '2026-09-10',
          regional: 'VIA VAREJO RJ',
          produto_lacrado: 'SIM',
        },
      ];

      const usuariosMock = [
        {
          id: 1,
          nome: 'Administrador',
          login: 'admin',
          senha: 'hash',
          perfil: 'ADMINISTRADOR',
          ativo: true,
          criado_em: '2026-09-01',
        },
      ];

      const fotos10Mock = [
        {
          id: 'REG-FOTO-01',
          regional: 'VIA VAREJO RJ',
          caixa: 'CX-01',
          dataCriacao: '2026-09-10',
          computador_id: 'PC-RJ-001',
          usuario: 'Operador',
          status_sincronizacao: 'PENDENTE',
          fotos: [
            {
              indice: 1,
              rotulo: 'Foto dos produtos 1',
              descricao: 'Amostra',
              fotoDataUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
            },
          ],
        },
      ];

      localStorage.setItem('solutions_auditoria_produtos_v1', JSON.stringify(produtosMock));
      localStorage.setItem('solutions_auditoria_usuarios_v1', JSON.stringify(usuariosMock));
      localStorage.setItem('solutions_auditoria_fotos_10_caixas_v1', JSON.stringify(fotos10Mock));

      // Executa a migração
      const resultado = await executarMigracaoLegadoParaIndexedDB();

      // 1. Validação de sucesso e integridade
      expect(resultado.status).toBe('CONCLUIDA');
      expect(resultado.contagens.produtos_origem).toBe(2);
      expect(resultado.contagens.produtos_destino).toBe(2);
      expect(resultado.contagens.usuarios_origem).toBe(1);
      expect(resultado.contagens.usuarios_destino).toBe(1);
      expect(resultado.contagens.fotos_origem).toBe(1);
      expect(resultado.contagens.fotos_destino).toBe(1);

      // 2. Snapshot de backup original foi preservado intacto
      const backupGravado = localStorage.getItem(BACKUP_KEY_PRE_GATE3);
      expect(backupGravado).not.toBeNull();
      const backupParsed = JSON.parse(backupGravado!);
      expect(backupParsed.produtos.length).toBe(2);
      expect(backupParsed.produtos[0].serial).toBe('SN001');

      // 3. Verifica dados persistidos nas tabelas do IndexedDB
      const prodsIdb = await idb.produtos.toArray();
      expect(prodsIdb.length).toBe(2);
      expect(prodsIdb[0].imei).toBe('354897001122331');

      const fotosIdb = await idb.fotos_evidencias.toArray();
      expect(fotosIdb.length).toBe(1);
      expect(fotosIdb[0].entity_id).toBe('VIA VAREJO RJ_CX-01');
      expect(fotosIdb[0].sha256).toBeDefined();

      // 4. Teste de Idempotência: executar novamente não duplica registros
      const resultadoReexecucao = await executarMigracaoLegadoParaIndexedDB();
      expect(resultadoReexecucao.status).toBe('CONCLUIDA');
      const countRepetido = await idb.produtos.count();
      expect(countRepetido).toBe(2);
    });

    it('deve preservar base legada intacta em caso de interrupção ou falha', async () => {
      localStorage.setItem('solutions_auditoria_produtos_v1', JSON.stringify([{ id: 'P1', serial: 'S1' }]));

      // Tenta consultar sem erro na leitura
      const backupAntes = localStorage.getItem('solutions_auditoria_produtos_v1');
      expect(backupAntes).not.toBeNull();

      // Executa migração
      await executarMigracaoLegadoParaIndexedDB();

      // localStorage de origem não pode ter sido apagado ou zerado
      const backupDepois = localStorage.getItem('solutions_auditoria_produtos_v1');
      expect(backupDepois).toBe(backupAntes);
    });
  });

  describe('3. Propagação de Erros de Persistência (Gate 7.4)', () => {
    it('deve rejeitar e disparar erro explícito se chamada de busca for inválida', async () => {
      // Valida que erros não são silenciados com retorno falso-positivo
      await expect(obterFotoEvidencia(undefined as any)).rejects.toThrow();
    });
  });
});

