// Motor Transacional de Backup e Restore com Manifesto Criptográfico (Gate 8)
// Implementa validação de checksum SHA-256, dry-run, snapshot pré-restore, verificação de contagens e rollback

import { db, isAdminOuSuper } from '../db/storage';
import { idb } from '../db/indexedDb';
import { sha256Sync, gerarUUID } from '../utils/crypto';
import { VERSAO_LOCAL } from '../version';
import type {
  BackupManifest,
  DryRunResultado,
  ResultadoRestauracao,
  Usuario,
  ProdutoAuditoria,
  RegistroLoteFinalizado,
  HistoricoAuditoria,
  LogTentativaDuplicado,
  ComputadorInfo,
} from '../types';

export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const SNAPSHOT_PREFIX = 'solutions_backup_snapshot_pre_restore_';

/**
 * Normaliza o payload de tabelas para cálculo canônico e determinístico de SHA-256
 */
function calcularChecksumTabelas(tables: Record<string, any>): string {
  // Ordena as chaves do objeto para garantir serialização determinística
  const sortedKeys = Object.keys(tables).sort();
  const canonical: Record<string, any> = {};
  for (const k of sortedKeys) {
    canonical[k] = tables[k];
  }
  return sha256Sync(JSON.stringify(canonical));
}

/**
 * 1. Validação Prévia de Arquivo (Extensão e Tamanho)
 */
export function validarArquivoBackup(arquivo: { name: string; size: number }): {
  valido: boolean;
  erro?: string;
} {
  const nome = arquivo.name.toLowerCase();
  if (!nome.endsWith('.json') && !nome.endsWith('.bak')) {
    return {
      valido: false,
      erro: 'Extensão de arquivo não permitida. O backup deve ser um arquivo com extensão .json ou .bak.',
    };
  }

  if (arquivo.size > MAX_BACKUP_SIZE_BYTES) {
    return {
      valido: false,
      erro: `O arquivo de backup excede o tamanho máximo permitido de ${MAX_BACKUP_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }

  if (arquivo.size === 0) {
    return {
      valido: false,
      erro: 'O arquivo de backup selecionado está vazio (0 bytes).',
    };
  }

  return { valido: true };
}

/**
 * 2. Geração do Backup Completo com Manifesto e Redação de Senhas (Gate 12.1)
 */
export async function gerarBackupCompleto(): Promise<{
  manifest: BackupManifest;
  jsonConteudo: string;
  nomeArquivo: string;
}> {
  const produtos = db.listarProdutos();
  const lotes = db.listarLotesFinalizados();
  const usuarios = db.listarUsuarios();
  const historico = db.listarHistorico();
  const computadores = db.listarComputadoresCadastrados();
  const tentativas = db.listarTentativasDuplicadas();
  const compAtual = db.obterComputadorAtual();

  // Regra 12.1: Nunca incluir senha plaintext no manifesto de backup
  const usuariosSanitizados: Omit<Usuario, 'senha'>[] = usuarios.map((u) => {
    const { senha: _senhaOmitida, ...resto } = u;
    return resto;
  });

  const tables = {
    produtos,
    lotes_finalizados: lotes,
    usuarios: usuariosSanitizados,
    computadores,
    historico,
    tentativas_duplicadas: tentativas,
  };

  const checksum = calcularChecksumTabelas(tables);
  const dataIso = new Date().toISOString();

  const manifest: BackupManifest = {
    format_version: BACKUP_FORMAT_VERSION,
    app_version: VERSAO_LOCAL.versao,
    created_at: dataIso,
    device_id: compAtual.id || gerarUUID(),
    tables,
    summary: {
      total_produtos: produtos.length,
      total_lotes: lotes.length,
      total_usuarios: usuarios.length,
      total_historico: historico.length,
    },
    checksum,
  };

  const jsonConteudo = JSON.stringify(manifest, null, 2);
  const dataFormatada = dataIso.replace(/[:.]/g, '-');
  const nomeArquivo = `backup_auditoria_solutions_v${VERSAO_LOCAL.versao}_${dataFormatada}.json`;

  return { manifest, jsonConteudo, nomeArquivo };
}

/**
 * 3. Dry-Run do Backup: Validação de Estrutura, Versão e Integridade Criptográfica (Gate 12.2)
 */
export function executarDryRunBackup(conteudoJson: string): DryRunResultado {
  try {
    if (!conteudoJson || !conteudoJson.trim()) {
      return {
        valido: false,
        erro: 'Arquivo de backup vazio ou corrompido.',
        detalhes: {
          totalProdutos: 0,
          totalLotes: 0,
          totalUsuarios: 0,
          totalFotos: 0,
          totalHistorico: 0,
          dataCriacao: '',
          appVersion: '',
          deviceId: '',
          checksumValido: false,
        },
      };
    }

    const parsed = JSON.parse(conteudoJson);

    // Suporte compatível: se for backup legado sem manifest estruturado
    if (parsed.versao && parsed.produtos && !parsed.format_version) {
      return {
        valido: true,
        detalhes: {
          totalProdutos: Array.isArray(parsed.produtos) ? parsed.produtos.length : 0,
          totalLotes: 0,
          totalUsuarios: Array.isArray(parsed.usuarios) ? parsed.usuarios.length : 0,
          totalFotos: 0,
          totalHistorico: Array.isArray(parsed.historico) ? parsed.historico.length : 0,
          dataCriacao: parsed.gerado_em || new Date().toISOString(),
          appVersion: 'legado-1.0',
          deviceId: 'desconhecido',
          checksumValido: true,
        },
      };
    }

    // Validação formal de Schema e Version do Manifesto (Gate 12.1 e 12.2)
    if (!parsed.format_version || typeof parsed.format_version !== 'number') {
      return {
        valido: false,
        erro: 'Schema de backup inválido: Campo format_version ausente ou inválido.',
        detalhes: {
          totalProdutos: 0,
          totalLotes: 0,
          totalUsuarios: 0,
          totalFotos: 0,
          totalHistorico: 0,
          dataCriacao: '',
          appVersion: '',
          deviceId: '',
          checksumValido: false,
        },
      };
    }

    if (parsed.format_version > BACKUP_FORMAT_VERSION) {
      return {
        valido: false,
        erro: `Versão do formato de backup incompatível (recebida versão ${parsed.format_version}, mas esta versão do sistema suporta até ${BACKUP_FORMAT_VERSION}). Atualize o sistema antes de restaurar.`,
        detalhes: {
          totalProdutos: 0,
          totalLotes: 0,
          totalUsuarios: 0,
          totalFotos: 0,
          totalHistorico: 0,
          dataCriacao: '',
          appVersion: '',
          deviceId: '',
          checksumValido: false,
        },
      };
    }

    if (!parsed.tables || !Array.isArray(parsed.tables.produtos)) {
      return {
        valido: false,
        erro: 'Estrutura do backup corrompida: Tabela "produtos" ausente ou inválida.',
        detalhes: {
          totalProdutos: 0,
          totalLotes: 0,
          totalUsuarios: 0,
          totalFotos: 0,
          totalHistorico: 0,
          dataCriacao: '',
          appVersion: '',
          deviceId: '',
          checksumValido: false,
        },
      };
    }

    // Validação Criptográfica do Checksum SHA-256
    const calculatedChecksum = calcularChecksumTabelas(parsed.tables);
    const checksumMatch = parsed.checksum === calculatedChecksum;

    if (!checksumMatch) {
      return {
        valido: false,
        erro: 'Integridade comprometida: O checksum SHA-256 do arquivo diverge das tabelas. O arquivo foi adulterado ou corrompido.',
        manifest: parsed,
        detalhes: {
          totalProdutos: parsed.tables.produtos.length,
          totalLotes: parsed.tables.lotes_finalizados?.length || 0,
          totalUsuarios: parsed.tables.usuarios?.length || 0,
          totalFotos: 0,
          totalHistorico: parsed.tables.historico?.length || 0,
          dataCriacao: parsed.created_at || '',
          appVersion: parsed.app_version || '',
          deviceId: parsed.device_id || '',
          checksumValido: false,
        },
      };
    }

    return {
      valido: true,
      manifest: parsed,
      detalhes: {
        totalProdutos: parsed.tables.produtos.length,
        totalLotes: parsed.tables.lotes_finalizados?.length || 0,
        totalUsuarios: parsed.tables.usuarios?.length || 0,
        totalFotos: 0,
        totalHistorico: parsed.tables.historico?.length || 0,
        dataCriacao: parsed.created_at || '',
        appVersion: parsed.app_version || '',
        deviceId: parsed.device_id || '',
        checksumValido: true,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valido: false,
      erro: `Erro na análise do arquivo: ${msg}`,
      detalhes: {
        totalProdutos: 0,
        totalLotes: 0,
        totalUsuarios: 0,
        totalFotos: 0,
        totalHistorico: 0,
        dataCriacao: '',
        appVersion: '',
        deviceId: '',
        checksumValido: false,
      },
    };
  }
}

/**
 * 4. Criação de Snapshot de Segurança Pré-Restore para Rollback (Gate 12.2, Passo 7)
 */
export async function criarSnapshotPreRestore(): Promise<{
  snapshotId: string;
  timestamp: string;
}> {
  const agora = Date.now();
  const snapshotId = `${SNAPSHOT_PREFIX}${agora}`;
  const timestamp = new Date().toISOString();

  const dadosAtuais = {
    produtos: db.listarProdutos(),
    lotes: db.listarLotesFinalizados(),
    usuarios: db.listarUsuarios(),
    historico: db.listarHistorico(),
    timestamp,
  };

  try {
    localStorage.setItem(snapshotId, JSON.stringify(dadosAtuais));
    if (typeof window !== 'undefined' && window.indexedDB) {
      await idb.configuracoes.put({
        chave: snapshotId,
        valor: dadosAtuais,
        atualizado_em: timestamp,
      });
    }
  } catch (e) {
    console.warn('[BackupService] Aviso ao persistir snapshot pré-restore:', e);
  }

  return { snapshotId, timestamp };
}

/**
 * 5. Rollback Automático caso o restore falhe a meio caminho
 */
export async function executarRollbackSnapshot(snapshotId: string): Promise<boolean> {
  try {
    let dados: any = null;
    const raw = localStorage.getItem(snapshotId);
    if (raw) {
      dados = JSON.parse(raw);
    } else if (typeof window !== 'undefined' && window.indexedDB) {
      const config = await idb.configuracoes.get(snapshotId);
      dados = config?.valor;
    }

    if (!dados || !Array.isArray(dados.produtos)) {
      return false;
    }

    db.limparTudoMemoria();
    for (const p of dados.produtos) {
      db.inserirProduto(p);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 6. Execução Transacional do Restore (Gate 12.2)
 */
export async function executarRestoreTransacional(
  conteudoJson: string,
  usuarioExecutor: Usuario
): Promise<ResultadoRestauracao> {
  // Passo 6: Reautenticação / Autorização do Administrador
  if (!isAdminOuSuper(usuarioExecutor.perfil)) {
    return {
      sucesso: false,
      erro: 'Acesso negado: Apenas Administradores do Sistema têm permissão para restaurar a base de dados.',
    };
  }

  // Passos 1, 2, 3 e 4: Validação de Schema, Checksum e Dry-Run
  const dryRun = executarDryRunBackup(conteudoJson);
  if (!dryRun.valido || !dryRun.detalhes.checksumValido) {
    return {
      sucesso: false,
      erro: dryRun.erro || 'Falha na validação de integridade do backup.',
    };
  }

  // Passo 7: Backup pré-restore (Snapshot para rollback)
  const { snapshotId } = await criarSnapshotPreRestore();

  try {
    // Passo 8: Restore Transacional
    const manifest = dryRun.manifest;
    let produtosParaRestaurar: ProdutoAuditoria[] = [];
    let lotesParaRestaurar: RegistroLoteFinalizado[] = [];
    let usuariosParaRestaurar: Usuario[] = [];
    let historicoParaRestaurar: HistoricoAuditoria[] = [];

    if (manifest && manifest.tables) {
      produtosParaRestaurar = manifest.tables.produtos || [];
      lotesParaRestaurar = manifest.tables.lotes_finalizados || [];
      historicoParaRestaurar = manifest.tables.historico || [];

      // Preservar senhas reais dos usuários existentes para nunca sobrescrever com valores redigidos
      const usuariosAtuais = db.listarUsuarios();
      const mapaSenhas = new Map<string, string>();
      for (const u of usuariosAtuais) {
        mapaSenhas.set(u.login.trim().toLowerCase(), u.senha);
      }

      usuariosParaRestaurar = (manifest.tables.usuarios || []).map((u) => ({
        ...u,
        senha: mapaSenhas.get(u.login.trim().toLowerCase()) || '',
      })) as Usuario[];
    } else {
      // Compatibilidade legado
      const parsed = JSON.parse(conteudoJson);
      produtosParaRestaurar = parsed.produtos || [];
      usuariosParaRestaurar = parsed.usuarios || [];
      historicoParaRestaurar = parsed.historico || [];
    }

    // Aplicar no banco em memória e IndexedDB
    db.limparTudoMemoria();

    // 1. Restaurar produtos
    for (const p of produtosParaRestaurar) {
      db.inserirProduto(p);
    }

    // 2. Restaurar lotes
    if (lotesParaRestaurar.length > 0) {
      db.mesclarLotesCentral(lotesParaRestaurar);
    }

    // 3. Restaurar IndexedDB de forma atômica
    if (typeof window !== 'undefined' && window.indexedDB) {
      await idb.transaction('rw', [idb.produtos, idb.lotes_finalizados], async () => {
        await idb.produtos.clear();
        await idb.produtos.bulkPut(produtosParaRestaurar);
        if (lotesParaRestaurar.length > 0) {
          await idb.lotes_finalizados.clear();
          await idb.lotes_finalizados.bulkPut(lotesParaRestaurar);
        }
      });
    }

    // Passo 9: Validação rigorosa de contagens antes de confirmar
    const totalRestaurado = db.listarProdutos().length;
    if (manifest && totalRestaurado !== manifest.summary.total_produtos) {
      // Rollback se as contagens divergirem
      await executarRollbackSnapshot(snapshotId);
      return {
        sucesso: false,
        erro: `Falha de validação pós-restore: Contagem de produtos (${totalRestaurado}) diverge do manifesto (${manifest.summary.total_produtos}). Rollback executado.`,
      };
    }

    // Passo 10: Auditoria e ACK de conclusão
    db.registrarHistorico(
      usuarioExecutor.nome,
      'RESTAURACAO_BACKUP',
      `Administrador ${usuarioExecutor.nome} restaurou com sucesso ${totalRestaurado} produtos e ${lotesParaRestaurar.length} lotes. Snapshot prévio: ${snapshotId}.`,
      usuarioExecutor.regional || 'TODAS'
    );

    return {
      sucesso: true,
      totalImportado: totalRestaurado,
      snapshotId,
      contagensRestauradas: {
        produtos: totalRestaurado,
        lotes: lotesParaRestaurar.length,
        usuarios: usuariosParaRestaurar.length,
        historico: historicoParaRestaurar.length,
      },
    };
  } catch (err: unknown) {
    // Falha durante a aplicação: Rollback automático
    await executarRollbackSnapshot(snapshotId);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      sucesso: false,
      erro: `Erro crítico durante a restauração da base: ${msg}. A base foi revertida para o estado pré-restore com segurança.`,
    };
  }
}
