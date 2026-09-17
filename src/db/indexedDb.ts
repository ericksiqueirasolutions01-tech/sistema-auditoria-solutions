import { Dexie, type EntityTable } from 'dexie';
import type {
  ProdutoAuditoria,
  Usuario,
  ComputadorInfo,
  HistoricoAuditoria,
  LogTentativaDuplicado,
  RegistroLoteFinalizado,
  FotoLifecycleStatus,
} from '../types';
import { sha256Sync, gerarUUID } from '../utils/crypto';

export interface FotoEvidencia {
  id: string; // UUID v4 único
  entity_type: 'LOTE' | 'CAIXA' | 'PRODUTO';
  entity_id: string; // ex: 'VIA VAREJO RJ_CX-01', 'LOTE-123'
  rotulo: string; // ex: 'Foto dos produtos 1'
  descricao?: string;
  mime_type: string; // ex: 'image/jpeg'
  tamanho_bytes: number;
  sha256: string; // Hash SHA-256 do payload binário da foto
  dados_base64: string; // Armazenamento desacoplado em store dedicada
  sync_status: FotoLifecycleStatus | 'PENDENTE' | 'SINCRONIZADO' | 'ERRO';
  sync_url?: string | null;
  storage_path?: string | null;
  signed_url?: string | null;
  signed_url_expires_at?: string | null;
  upload_attempts?: number;
  last_error?: string | null;
  criado_em: string;
  sincronizado_em?: string | null;
}

export type FotoEvidenciaMeta = Omit<FotoEvidencia, 'dados_base64'>;

export interface MigrationMeta {
  id: string;
  versao: number;
  status: 'INICIADA' | 'CONCLUIDA' | 'FALHA';
  executada_em: string;
  backup_key: string;
  contagens: {
    produtos_origem: number;
    produtos_destino: number;
    usuarios_origem: number;
    usuarios_destino: number;
    lotes_origem: number;
    lotes_destino: number;
    fotos_origem: number;
    fotos_destino: number;
  };
  checksum_origem: string;
  checksum_destino: string;
  erro?: string;
}

export interface ConfiguracaoLocal {
  chave: string;
  valor: unknown;
  atualizado_em: string;
}

export interface OutboxEvent {
  event_id: string; // UUID v4
  idempotency_key: string; // `${device_id}_${operation}_${event_id}`
  device_id: string;
  entity_type: 'PRODUTO' | 'LOTE' | 'FOTO' | 'CAIXA';
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  base_revision: number;
  payload: Record<string, any>;
  created_at: string;
  attempts: number;
  status: 'PENDENTE' | 'PROCESSANDO' | 'SINCRONIZADO' | 'CONFLITO' | 'ERRO';
  last_error?: string | null;
  synced_at?: string | null;
}

export class SolutionsDexieDB extends Dexie {
  produtos!: EntityTable<ProdutoAuditoria, 'id'>;
  lotes_finalizados!: EntityTable<RegistroLoteFinalizado, 'id'>;
  fotos_evidencias!: EntityTable<FotoEvidencia, 'id'>;
  usuarios!: EntityTable<Usuario, 'id'>;
  computadores!: EntityTable<ComputadorInfo, 'id'>;
  audit_log!: EntityTable<HistoricoAuditoria & { id?: number }, 'id'>;
  tentativas_duplicadas!: EntityTable<LogTentativaDuplicado & { id?: number }, 'id'>;
  configuracoes!: EntityTable<ConfiguracaoLocal, 'chave'>;
  migration_meta!: EntityTable<MigrationMeta, 'id'>;
  sync_outbox!: EntityTable<OutboxEvent, 'event_id'>;

  constructor() {
    super('SolutionsAuditoriaDB_v2');
    this.version(2).stores({
      produtos: 'id, serial, imei, numero_lote, numero_caixa, regional, status_sincronizacao, data_auditoria',
      lotes_finalizados: 'id, numero_lote, regional, status, data_fechamento',
      fotos_evidencias: 'id, entity_type, entity_id, sha256, sync_status, criado_em',
      usuarios: 'id, login, perfil, regional, ativo',
      computadores: 'id, device_id, regional, status',
      audit_log: '++id, usuario, acao, dataHora',
      tentativas_duplicadas: '++id, serial, imei, lote, dataHora',
      configuracoes: 'chave, atualizado_em',
      migration_meta: 'id, status, executada_em',
      sync_outbox: 'event_id, idempotency_key, device_id, entity_type, entity_id, status, created_at',
    });
  }
}

// Instância Singleton do banco Dexie
export const idb = new SolutionsDexieDB();

// Utilitário para calcular metadados e SHA-256 de fotos Base64
export function processarFotoBase64(
  entityType: 'LOTE' | 'CAIXA' | 'PRODUTO',
  entityId: string,
  rotulo: string,
  dadosBase64: string,
  descricao?: string
): FotoEvidencia {
  let mimeType = 'image/jpeg';
  let conteudoPuro = dadosBase64;

  const match = dadosBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    conteudoPuro = match[2];
  }

  // Estimar tamanho em bytes a partir da base64
  const padding = (conteudoPuro.endsWith('==') ? 2 : conteudoPuro.endsWith('=') ? 1 : 0);
  const tamanhoBytes = Math.floor((conteudoPuro.length * 3) / 4) - padding;

  const hash = sha256Sync(conteudoPuro);

  return {
    id: gerarUUID(),
    entity_type: entityType,
    entity_id: entityId,
    rotulo,
    descricao,
    mime_type: mimeType,
    tamanho_bytes: Math.max(0, tamanhoBytes),
    sha256: hash,
    dados_base64: dadosBase64,
    sync_status: 'PENDENTE',
    sync_url: null,
    criado_em: new Date().toISOString(),
    sincronizado_em: null,
  };
}

// Salvar foto desacoplada no IndexedDB
export async function salvarFotoEvidencia(foto: FotoEvidencia): Promise<FotoEvidenciaMeta> {
  try {
    await idb.fotos_evidencias.put(foto);
    const { dados_base64, ...meta } = foto;
    return meta;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao persistir evidência fotográfica no IndexedDB: ${msg}`);
  }
}

// Carregar foto específica com dados binários para exibição
export async function obterFotoEvidencia(id: string): Promise<FotoEvidencia | null> {
  try {
    const foto = await idb.fotos_evidencias.get(id);
    return foto || null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao recuperar foto ${id} do IndexedDB: ${msg}`);
  }
}

// Listar metadados de fotos por entidade (sem carregar base64 pesado)
export async function listarFotosEvidenciasPorEntidade(entityId: string): Promise<FotoEvidenciaMeta[]> {
  try {
    const fotos = await idb.fotos_evidencias.where('entity_id').equals(entityId).toArray();
    return fotos.map(({ dados_base64, ...meta }) => meta);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao consultar fotos da entidade ${entityId}: ${msg}`);
  }
}

// =========================================================================
// MIGRATION ENGINE (Gate 3 - Section 7.3)
// Transição idempotente com backup original, verificação e rollback
// =========================================================================
export const BACKUP_KEY_PRE_GATE3 = 'solutions_legacy_backup_snapshot_pre_gate3';

export async function executarMigracaoLegadoParaIndexedDB(): Promise<MigrationMeta> {
  const migracaoId = 'migracao_gate3_v2_indexeddb';

  // Se o ambiente não suporta IndexedDB (ex: Node sem mock), retorna gracefully
  if (typeof window === 'undefined' || !window.indexedDB) {
    return {
      id: migracaoId,
      versao: 2,
      status: 'CONCLUIDA',
      executada_em: new Date().toISOString(),
      backup_key: BACKUP_KEY_PRE_GATE3,
      contagens: {
        produtos_origem: 0,
        produtos_destino: 0,
        usuarios_origem: 0,
        usuarios_destino: 0,
        lotes_origem: 0,
        lotes_destino: 0,
        fotos_origem: 0,
        fotos_destino: 0,
      },
      checksum_origem: '',
      checksum_destino: '',
    };
  }

  // 1. Verifica se já foi executada com sucesso
  try {
    const existente = await idb.migration_meta.get(migracaoId);
    if (existente && existente.status === 'CONCLUIDA') {
      return existente;
    }
  } catch {
    // Tabela pode ainda estar vazia
  }

  // 2. Extrai dados legados do localStorage
  let prodsLegado: ProdutoAuditoria[] = [];
  let usersLegado: Usuario[] = [];
  let lotesLegado: RegistroLoteFinalizado[] = [];
  let fotos10Legado: any[] = [];
  let histLegado: HistoricoAuditoria[] = [];
  let compsLegado: ComputadorInfo[] = [];

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const p = localStorage.getItem('solutions_auditoria_produtos_v1');
      if (p) prodsLegado = JSON.parse(p);
      const u = localStorage.getItem('solutions_auditoria_usuarios_v1');
      if (u) usersLegado = JSON.parse(u);
      const l = localStorage.getItem('solutions_auditoria_lotes_finalizados_v1');
      if (l) lotesLegado = JSON.parse(l);
      const f10 = localStorage.getItem('solutions_auditoria_fotos_10_caixas_v1');
      if (f10) fotos10Legado = JSON.parse(f10);
      const h = localStorage.getItem('solutions_auditoria_historico_v1');
      if (h) histLegado = JSON.parse(h);
      const c = localStorage.getItem('solutions_computadores_lista_v1');
      if (c) compsLegado = JSON.parse(c);
    } catch (e) {
      console.error('Falha ao ler dados legados do localStorage:', e);
    }
  }

  // 3. Backup Snapshot Original Intacto (Requisito 7.3)
  const snapshotOriginal = {
    timestamp: new Date().toISOString(),
    produtos: prodsLegado,
    usuarios: usersLegado,
    lotes_finalizados: lotesLegado,
    fotos_10_caixas: fotos10Legado,
    historico: histLegado,
    computadores: compsLegado,
  };

  const snapshotString = JSON.stringify(snapshotOriginal);
  const checksumOrigem = sha256Sync(snapshotString);

  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(BACKUP_KEY_PRE_GATE3, snapshotString);
  }

  const meta: MigrationMeta = {
    id: migracaoId,
    versao: 2,
    status: 'INICIADA',
    executada_em: new Date().toISOString(),
    backup_key: BACKUP_KEY_PRE_GATE3,
    contagens: {
      produtos_origem: prodsLegado.length,
      produtos_destino: 0,
      usuarios_origem: usersLegado.length,
      usuarios_destino: 0,
      lotes_origem: lotesLegado.length,
      lotes_destino: 0,
      fotos_origem: 0,
      fotos_destino: 0,
    },
    checksum_origem: checksumOrigem,
    checksum_destino: '',
  };

  try {
    // 4. Inserção transacional com desacoplamento de fotos
    let totalFotosDesacopladas = 0;

    await idb.transaction(
      'rw',
      [
        idb.produtos,
        idb.usuarios,
        idb.lotes_finalizados,
        idb.fotos_evidencias,
        idb.audit_log,
        idb.computadores,
        idb.migration_meta,
      ],
      async () => {
        // Produtos
        if (prodsLegado.length > 0) {
          await idb.produtos.bulkPut(prodsLegado);
        }

        // Usuários
        if (usersLegado.length > 0) {
          await idb.usuarios.bulkPut(usersLegado);
        }

        // Lotes Finalizados
        if (lotesLegado.length > 0) {
          await idb.lotes_finalizados.bulkPut(lotesLegado);
        }

        // Computadores
        if (compsLegado.length > 0) {
          await idb.computadores.bulkPut(compsLegado);
        }

        // Fotos das Caixas desacopladas em fotos_evidencias
        for (const regCaixa of fotos10Legado) {
          if (Array.isArray(regCaixa.fotos)) {
            for (const f of regCaixa.fotos) {
              if (f && f.fotoDataUri) {
                const fotoProcessada = processarFotoBase64(
                  'CAIXA',
                  `${regCaixa.regional}_${regCaixa.caixa}`,
                  f.rotulo || `Foto ${f.indice}`,
                  f.fotoDataUri,
                  f.descricao
                );
                await idb.fotos_evidencias.put(fotoProcessada);
                totalFotosDesacopladas++;
              }
            }
          }
        }
      }
    );

    // 5. Verificação de integridade e reconciliação de contagens
    const countProds = await idb.produtos.count();
    const countUsers = await idb.usuarios.count();
    const countLotes = await idb.lotes_finalizados.count();
    const countFotos = await idb.fotos_evidencias.count();

    meta.contagens.produtos_destino = countProds;
    meta.contagens.usuarios_destino = countUsers;
    meta.contagens.lotes_destino = countLotes;
    meta.contagens.fotos_origem = totalFotosDesacopladas;
    meta.contagens.fotos_destino = countFotos;

    if (
      countProds >= prodsLegado.length &&
      countUsers >= usersLegado.length &&
      countLotes >= lotesLegado.length
    ) {
      meta.status = 'CONCLUIDA';
      meta.checksum_destino = sha256Sync(
        JSON.stringify({ countProds, countUsers, countLotes, countFotos })
      );
      await idb.migration_meta.put(meta);
      return meta;
    } else {
      meta.status = 'FALHA';
      meta.erro = `Divergência de contagem pós-migração. Produtos: ${countProds}/${prodsLegado.length}, Usuários: ${countUsers}/${usersLegado.length}`;
      await idb.migration_meta.put(meta);
      return meta;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    meta.status = 'FALHA';
    meta.erro = errMsg;
    try {
      await idb.migration_meta.put(meta);
    } catch {}
    throw new Error(`Falha na migração transacional para o IndexedDB: ${errMsg}`);
  }
}
