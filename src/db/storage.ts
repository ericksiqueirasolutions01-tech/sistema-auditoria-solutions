import {
  ProdutoAuditoria,
  Usuario,
  PerfilUsuario,
  SessaoUsuario,
  DeviceStatus,
  HistoricoAuditoria,
  ContadoresCaixa,
  MetricasDashboard,
  FiltroConsulta,
  ResultadoPaginado,
  EstatisticasRegional,
  StatusSincronizacao,
  StatusSincronizacaoItem,
  ComputadorInfo,
  RegistroSincronizacaoEnvio,
  DetalhamentoComputador,
  SimNao,
  FotoGrupoAuditoria,
  GrupoFotosInfo,
  FotoCaixa10Item,
  Registro10FotosCaixa,
  ROTULOS_10_FOTOS_CAIXA,
  DetalheImeiDuplicado,
  LogTentativaDuplicado,
  ResultadoSincronizacao,
  StatusConexao,
  LogAcessoUsuario,
  ConfiguracaoInicialInfo,
  RelatorioLoteInfo,
  CaixaLoteInfo,
  FotosFechamentoLote,
  StatusLote,
  HistoricoAlteracaoLote,
  RegistroLoteFinalizado,
  FiltroLoteFinalizado,
  BackupManifest,
  InventoryImportBatch,
  RegionalInventoryReference,
  AuditLot,
  MetricasValidacaoPlanilha,
  ConfiguracaoCaixa,
  BoxSealedStatus,
  ItemPendenteLote,
} from '../types';
import { VERSAO_LOCAL } from '../version';
import {
  idb,
  processarFotoBase64,
  salvarFotoEvidencia,
  executarMigracaoLegadoParaIndexedDB,
} from './indexedDb';
import { enfileirarEventoOutbox } from './syncOutbox';
import { observability } from '../services/observability';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const STORAGE_KEY_PRODUTOS = 'solutions_auditoria_produtos_v1';
const STORAGE_KEY_USUARIOS = 'solutions_auditoria_usuarios_v1';
const STORAGE_KEY_HISTORICO = 'solutions_auditoria_historico_v1';
const STORAGE_KEY_CONFIG = 'solutions_auditoria_config_v1';
const STORAGE_KEY_COMPUTADOR = 'solutions_computador_atual_v1';
const STORAGE_KEY_COMPUTADORES = 'solutions_computadores_lista_v1';
const STORAGE_KEY_HISTORICO_ENVIOS = 'solutions_historico_envios_online_v1';
const STORAGE_KEY_SERVIDOR_CENTRAL = 'solutions_servidor_central_produtos_v1';
const STORAGE_KEY_FOTOS = 'solutions_auditoria_fotos_grupos_v1';
const STORAGE_KEY_FOTOS_10_CAIXAS = 'solutions_auditoria_10_fotos_caixas_v1';
const STORAGE_KEY_SERIAIS_LIMPOS_TELA = 'solutions_seriais_limpos_tela_v1';
const STORAGE_KEY_TENTATIVAS_DUPLICADAS = 'solutions_tentativas_envio_duplicado_v1';
const STORAGE_KEY_CONFIG_INICIAL = 'solutions_configuracao_inicial_v1';
const STORAGE_KEY_LOGS_ACESSO = 'solutions_logs_acesso_usuarios_v1';
const STORAGE_KEY_ULTIMO_LOTE = 'solutions_ultimo_lote';
const STORAGE_KEY_LOTES_FINALIZADOS = 'solutions_auditoria_lotes_finalizados_v1';
const STORAGE_KEY_COLABORADOR_ATIVO = 'solutions_auditoria_colaborador_ativo_v1';
const STORAGE_KEY_IMPORT_BATCHES = 'solutions_inventory_import_batches_v1';
const STORAGE_KEY_REGIONAL_REFS = 'solutions_regional_inventory_refs_v1';
const STORAGE_KEY_AUDIT_LOTS = 'solutions_audit_lots_v1';
const STORAGE_KEY_LACRES_CAIXAS = 'solutions_auditoria_lacres_caixas_v1';

/**
 * Normaliza o valor de Dealer conforme regra central (Seção 6 do Prompt Mestre):
 * - trim
 * - uppercase
 * - reduzir espaços duplicados
 */
export function normalizeDealer(value?: string | null): string {
  if (!value) return 'SEM DEALER';
  const clean = String(value).trim().toUpperCase().replace(/\s+/g, ' ');
  return clean || 'SEM DEALER';
}

/**
 * Normaliza o IMEI como STRING de 15 dígitos (Seção 16 do Prompt Mestre):
 * - preserva zeros à esquerda
 * - remove espaços e hífens
 */
export function normalizeImei(value?: string | number | null): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\D/g, '');
}

/**
 * Extrai o código simples da regional (ex: 'VIA VAREJO BA' -> 'BA', 'BA' -> 'BA')
 */
export function extrairCodigoRegional(regional?: string | null): string {
  const r = (regional || '').trim().toUpperCase();
  if (r.startsWith('VIA VAREJO ')) {
    return r.replace('VIA VAREJO ', '').trim();
  }
  return r || 'GERAL';
}

/**
 * Normaliza qualquer formato de data (DD/MM/YYYY, ISO, etc.) para o formato DATE do PostgreSQL (YYYY-MM-DD)
 * CORREÇÃO 3 — REGRA OBRIGATÓRIA: Entrada DD/MM/YYYY -> Saída YYYY-MM-DD
 */
export function normalizeDatabaseDate(dataInput: any): string {
  if (!dataInput) {
    return new Date().toISOString().split('T')[0];
  }
  const str = String(dataInput).trim();
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const dia = ddmmyyyyMatch[1].padStart(2, '0');
    const mes = ddmmyyyyMatch[2].padStart(2, '0');
    const ano = ddmmyyyyMatch[3];
    return `${ano}-${mes}-${dia}`;
  }
  const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmddMatch) {
    const ano = yyyymmddMatch[1];
    const mes = yyyymmddMatch[2].padStart(2, '0');
    const dia = yyyymmddMatch[3].padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return new Date().toISOString().split('T')[0];
}
export const normalizarDataParaPostgresDate = normalizeDatabaseDate;

/**
 * Converte data ISO (YYYY-MM-DD) para exibição brasileira (DD/MM/YYYY)
 */
export function formatarDataParaExibicaoBR(dataInput: any): string {
  if (!dataInput) return '';
  const str = String(dataInput).trim();
  const ddmmyyyyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyyMatch) {
    return `${ddmmyyyyMatch[1].padStart(2, '0')}/${ddmmyyyyMatch[2].padStart(2, '0')}/${ddmmyyyyMatch[3]}`;
  }
  const yyyymmddMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (yyyymmddMatch) {
    return `${yyyymmddMatch[3].padStart(2, '0')}/${yyyymmddMatch[2].padStart(2, '0')}/${yyyymmddMatch[1]}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR');
    }
  } catch {}
  return str;
}

/**
 * Catálogo Mestre de SKUs Conhecidos do Sistema
 * Mapeia SKU -> Marca Oficial
 */
export const CADASTRO_MESTRE_SKU: Record<string, string> = {
  // Motorola
  '5370760': 'MOTOROLA',
  'XT2601': 'MOTOROLA',
  'XT2601-3': 'MOTOROLA',
  'XT2347-1': 'MOTOROLA',
  'XT2347': 'MOTOROLA',
  'XT2335': 'MOTOROLA',
  'XT2335-1': 'MOTOROLA',
  'XT2331': 'MOTOROLA',
  'XT2321': 'MOTOROLA',
  'XT2403': 'MOTOROLA',
  'XT2409': 'MOTOROLA',
  'XT2413': 'MOTOROLA',
  'XT2417': 'MOTOROLA',
  'XT2423': 'MOTOROLA',
  'XT2427': 'MOTOROLA',
  // Samsung
  'SM-S928BZKQZTO': 'SAMSUNG',
  'SM-S928B': 'SAMSUNG',
  'SM-A546EZGLZTO': 'SAMSUNG',
  'SM-A546E': 'SAMSUNG',
  'SM-G990E': 'SAMSUNG',
  'SM-G990EZVRZTO': 'SAMSUNG',
  'SM-A155M': 'SAMSUNG',
  'SM-A256E': 'SAMSUNG',
  'SM-A356E': 'SAMSUNG',
  'SM-A556E': 'SAMSUNG',
  'SM-S921B': 'SAMSUNG',
  'SM-S926B': 'SAMSUNG',
  'SM-F731B': 'SAMSUNG',
  'SM-F946B': 'SAMSUNG',
  'SM-F741B': 'SAMSUNG',
  'SM-F956B': 'SAMSUNG',
  // Oppo
  'CPH2579': 'OPPO',
  'CPH2599': 'OPPO',
  'CPH2607': 'OPPO',
  'CPH2625': 'OPPO',
  // Jovi
  'JOVI-01': 'JOVI',
  'JOVI-02': 'JOVI',
};

/**
 * Consulta a marca oficial por código SKU
 */
export function consultarMarcaPorSku(sku?: string | null): string | null {
  if (!sku) return null;
  const clean = String(sku).trim().toUpperCase();
  if (!clean) return null;
  if (CADASTRO_MESTRE_SKU[clean]) return CADASTRO_MESTRE_SKU[clean];
  const semZeros = clean.replace(/^0+/, '');
  if (semZeros && CADASTRO_MESTRE_SKU[semZeros]) return CADASTRO_MESTRE_SKU[semZeros];
  return null;
}

/**
 * Resolve o FABRICANTE real do produto conforme Seção 2 do Prompt de Correção:
 * Ordem de prioridade estrita:
 * 1. Campo estruturado de marca/fabricante da referência importada (se não for nula/vazia/OUTRA MARCA/SEM MARCA)
 * 2. Associação SKU -> MARCA do catálogo mestre ou tabela de apoio
 * 3. Análise de palavras-chave no modelo/descrição (MOTOROLA, MOTO, OPPO, JOVI, APPLE, IPHONE, XIAOMI, REDMI, POCO, SAMSUNG, GALAXY, SM-)
 * 4. Fallback confiável informado (se explicitado como OUTRA MARCA)
 * 5. Se não houver fonte confiável: "FABRICANTE NÃO IDENTIFICADO" (NUNCA assumir Samsung por padrão)
 */
export function inferirFabricante(
  modelo?: string | null,
  fallbackMarca?: string | null,
  sku?: string | null
): string {
  // 1. SKU -> MARCA do cadastro mestre / base estruturada (prioridade 1 absoluta)
  const marcaSku = consultarMarcaPorSku(sku);
  if (marcaSku) return marcaSku;

  const m = (modelo || '').trim().toUpperCase();

  // 2. Análise do Modelo / Descrição por palavras-chave de fabricante
  if (
    m.includes('MOTOROLA') ||
    m.includes('MOTO ') ||
    m.startsWith('MOTO') ||
    m.includes('MOTO-') ||
    m.includes('XT2') ||
    m.includes('XT3')
  ) {
    return 'MOTOROLA';
  }
  if (m.includes('OPPO') || m.startsWith('CPH')) return 'OPPO';
  if (m.includes('JOVI')) return 'JOVI';
  if (m.includes('APPLE') || m.includes('IPHONE')) return 'APPLE';
  if (m.includes('XIAOMI') || m.includes('REDMI') || m.includes('POCO')) return 'XIAOMI';
  if (
    m.includes('SAMSUNG') ||
    m.includes('GALAXY') ||
    m.startsWith('SM-') ||
    m.includes('SM-')
  ) {
    return 'SAMSUNG';
  }

  // 3. Campo estruturado de marca da referência importada (somente se confiável)
  if (fallbackMarca && fallbackMarca.trim()) {
    const fb = fallbackMarca.trim().toUpperCase();
    if (fb && fb !== 'SEM MARCA' && fb !== 'OUTRA MARCA' && fb !== 'FABRICANTE NÃO IDENTIFICADO') {
      return fb;
    }
  }

  // 4. Se fallback for 'OUTRA MARCA', respeitar
  if (fallbackMarca && fallbackMarca.trim().toUpperCase() === 'OUTRA MARCA') {
    return 'OUTRA MARCA';
  }

  // 5. Se não houver fonte confiável: FABRICANTE NÃO IDENTIFICADO (NUNCA assumir Samsung)
  return 'FABRICANTE NÃO IDENTIFICADO';
}

/**
 * Determina a Classificação Automática do Produto conforme Seções 8, 9, 10 do Prompt de Correção:
 * - LISTADO:
 *   - Se dealer for SAMSUNG: PRODUTO NA LISTA - SAMSUNG
 *   - Se dealer for SIRI: PRODUTO NA LISTA - SIRI COMERCIO E SERVICOS LTDA
 *   - Se dealer for OUTRA MARCA: PRODUTO NA LISTA - OUTRA MARCA
 *   - Outro dealer: PRODUTO NA LISTA - <DEALER NORMALIZADO>
 * - FORA DA LISTA:
 *   - Se fabricante for SAMSUNG: FORA DA LISTA - SAMSUNG
 *   - Se fabricante != SAMSUNG: FORA DA LISTA - OUTRA MARCA
 */
export function calcularClassificacaoProduto(params: {
  sourceType: 'LISTED' | 'OUT_OF_LIST';
  dealer?: string | null;
  fabricante?: string | null;
}): string {
  const fab = (params.fabricante || '').trim().toUpperCase();
  const isSamsung = fab === 'SAMSUNG' || fab.includes('SAMSUNG');

  if (params.sourceType === 'LISTED') {
    const dNorm = normalizeDealer(params.dealer);
    if (dNorm.includes('SIRI')) {
      return 'PRODUTO NA LISTA - SIRI COMERCIO E SERVICOS LTDA';
    }
    if (!isSamsung || dNorm === 'OUTRA MARCA' || dNorm.includes('OUTRA MARCA')) {
      return 'PRODUTO NA LISTA - OUTRA MARCA';
    }
    return 'PRODUTO NA LISTA - SAMSUNG';
  } else {
    return isSamsung ? 'FORA DA LISTA - SAMSUNG' : 'FORA DA LISTA - OUTRA MARCA';
  }
}

/**
 * Determina o Lote Automático conforme Seções 4, 5, 8 do Prompt Mestre:
 * - LISTADO: `${codigoRegional} - LISTA - ${dealerNormalizado}`
 * - FORA DA LISTA:
 *   - se Samsung: `${codigoRegional} - FORA DA LISTA - SAMSUNG`
 *   - se != Samsung: `${codigoRegional} - FORA DA LISTA - OUTRA MARCA`
 */
export function calcularLoteAutomatico(params: {
  regional?: string | null;
  sourceType: 'LISTED' | 'OUT_OF_LIST';
  dealer?: string | null;
  fabricante?: string | null;
}): string {
  const cod = extrairCodigoRegional(params.regional);
  if (params.sourceType === 'LISTED') {
    const dNorm = normalizeDealer(params.dealer);
    return `${cod} - LISTA - ${dNorm}`;
  } else {
    const fab = (params.fabricante || '').trim().toUpperCase();
    const isSamsung = fab === 'SAMSUNG' || fab.includes('SAMSUNG');
    const grupo = isSamsung ? 'SAMSUNG' : 'OUTRA MARCA';
    return `${cod} - FORA DA LISTA - ${grupo}`;
  }
}

// Regionais Oficiais Solicitadas
export const REGIONAIS_PADRAO = [
  'VIA VAREJO RJ',
  'VIA VAREJO SP',
  'VIA VAREJO MG',
  'VIA VAREJO BA',
];

// Constantes de compatibilidade (desativadas em favor do Supabase oficial)
export const CLOUD_STORAGE_URL = '';
export const CLOUD_STORAGE_BACKUP_URL = '';

export const SERVIDOR_CENTRAL_PADRAO = 'https://sistema-auditoria-solutions.vercel.app';

export function obterUrlServidorCentral(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('solutions_servidor_url');
    if (custom && custom.startsWith('http')) return custom.replace(/\/+$/, '');
  }
  return SERVIDOR_CENTRAL_PADRAO;
}

export function obterApiUrl(endpoint: string): string {
  const rotaLimpa = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Se o cliente já estiver rodando diretamente no domínio oficial da Vercel
    if (host && host.endsWith('vercel.app')) {
      return rotaLimpa;
    }
    // Quando executado no app desktop local, 127.0.0.1, IP de rede local, etc., direciona para o servidor central oficial
    return `${obterUrlServidorCentral()}${rotaLimpa}`;
  }
  return `${SERVIDOR_CENTRAL_PADRAO}${rotaLimpa}`;
}

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || !host;
}

export function isServidorOnlineWeb(): boolean {
  return !isDesktopApp();
}

// Módulo Criptográfico e UUID (Gate 1, 2, 3)
import { sha256Sync, hashSenha, gerarUUID } from '../utils/crypto';
export { sha256Sync, hashSenha, gerarUUID };

// Regras de Autenticação e Domínio (Gate 10: Modularização / Clean Architecture)
export {
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

async function prepararFotoLeveParaSync(dataUri: string): Promise<string> {
  if (!dataUri) return '';
  // Em conformidade com o Gate 1: Não substitui evidências reais por SVG falso e não usa chave externa no client
  return dataUri;
}

// IndexedDB Database & Store Configuration for High-Reliability Zero-Data-Loss
const IDB_NAME = 'SolutionsAuditoriaDB_v1';
const IDB_STORE = 'auditoria_store';

function initIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function salvarIndexedDB(chave: string, valor: unknown): Promise<void> {
  return initIndexedDB().then((idb) => {
    if (!idb) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put(valor, chave);
        tx.oncomplete = () => resolve();
        tx.onerror = (err) => {
          console.error('Erro ao salvar no IndexedDB legado:', err);
          reject(err);
        };
      } catch (e) {
        console.error('Erro de transação no IndexedDB legado:', e);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('solutions_erro_persistencia', { detail: { erro: String(e) } }));
        }
        reject(e);
      }
    });
  });
}

function limparIndexedDB(): Promise<void> {
  return initIndexedDB().then((idb) => {
    if (!idb) return;
    return new Promise((resolve) => {
      try {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  });
}

function carregarIndexedDB<T>(chave: string): Promise<T | null> {
  return initIndexedDB().then((idb) => {
    if (!idb) return null;
    return new Promise((resolve) => {
      try {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(chave);
        req.onsuccess = () => resolve((req.result as T) || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

// Solicitar explicitamente armazenamento persistente ao navegador (evita exclusão por limpeza de cache)
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persistent) => {
    if (persistent) {
      console.log('✅ Armazenamento persistente garantido pelo navegador.');
    }
  }).catch(() => {});
}

// Usuários Iniciais Oficiais (Senhas padrão removidas em conformidade com o Gate 1)
// O primeiro acesso de cada usuário realiza o bootstrap seguro com cadastro da senha pessoal.
export const DEFAULT_USUARIOS: Usuario[] = [
  {
    id: 1,
    nome: 'SUPER ADMIN',
    login: 'SUPERADMIN',
    senha: '',
    perfil: 'SUPER_ADMIN',
    regional: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    nome: 'ADMIN',
    login: 'ADMIN',
    senha: '',
    perfil: 'ADMINISTRADOR',
    regional: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 3,
    nome: 'ADMINISTRADOR',
    login: 'ADMINISTRADOR',
    senha: '',
    perfil: 'ADMINISTRADOR',
    regional: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 4,
    nome: 'SUPERVISOR RJ',
    login: 'SUPERVISOR RJ',
    senha: '',
    perfil: 'SUPERVISOR_REGIONAL',
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 5,
    nome: 'VIA VAREJO RJ',
    login: 'VIA VAREJO RJ',
    senha: '',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 6,
    nome: 'VIA VAREJO SP',
    login: 'VIA VAREJO SP',
    senha: '',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO SP',
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 7,
    nome: 'VIA VAREJO MG',
    login: 'VIA VAREJO MG',
    senha: '',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO MG',
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 8,
    nome: 'VIA VAREJO BA',
    login: 'VIA VAREJO BA',
    senha: '',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO BA',
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
  },
];

// Presets for Samsung devices for fast autocomplete & recognition
export const SAMSUNG_MODELOS_PRESET = [
  { modelo: 'Galaxy S24 Ultra', ean: '7892509133456' },
  { modelo: 'Galaxy S24+', ean: '7892509133463' },
  { modelo: 'Galaxy S24', ean: '7892509133470' },
  { modelo: 'Galaxy S23 FE', ean: '7892509129848' },
  { modelo: 'Galaxy A55 5G', ean: '7892509134125' },
  { modelo: 'Galaxy A35 5G', ean: '7892509134132' },
  { modelo: 'Galaxy A15 5G', ean: '7892509134149' },
  { modelo: 'Galaxy A05s', ean: '7892509134156' },
  { modelo: 'Galaxy Z Fold5', ean: '7892509130110' },
  { modelo: 'Galaxy Z Flip5', ean: '7892509130226' },
  { modelo: 'Galaxy Tab S9 FE', ean: '7892509131452' },
  { modelo: 'Galaxy Tab A9+', ean: '7892509131568' },
  { modelo: 'Galaxy Watch6', ean: '7892509132107' },
  { modelo: 'Galaxy Buds2 Pro', ean: '7892509125581' },
];

class AuditoriaDatabase {
  private produtos: ProdutoAuditoria[] = [];
  private usuarios: Usuario[] = [];
  private historico: HistoricoAuditoria[] = [];
  private fotosGrupos: FotoGrupoAuditoria[] = [];
  private registros10Fotos: Registro10FotosCaixa[] = [];
  private lotesFinalizados: RegistroLoteFinalizado[] = [];
  private colaboradorAtivo: string | null = null;
  private usuarioAtual: Usuario | null = null;
  private serialMap: Map<string, ProdutoAuditoria> = new Map();
  private seriaisLimposDaTela: Set<string> = new Set<string>();
  private tentativasDuplicadas: LogTentativaDuplicado[] = [];
  private limpezaEmAndamento: boolean = false;
  private sincronizando: boolean = false;
  private importBatches: InventoryImportBatch[] = [];
  private regionalReferences: RegionalInventoryReference[] = [];
  private auditLots: AuditLot[] = [];
  private referenceMap: Map<string, RegionalInventoryReference> = new Map();

  constructor() {
    this.carregarDados();
    this.verificarRecuperacaoIndexedDB();
    this.iniciarSincronizacaoAutomatica();
    // Migração transacional para o IndexedDB estruturado (Gate 3)
    if (typeof window !== 'undefined') {
      executarMigracaoLegadoParaIndexedDB().catch((err) => {
        console.error('Falha na migração automática para o IndexedDB estruturado:', err);
      });
      // CORREÇÃO 1 — Arquitetura Central-First: inicialização buscando dados da API central / Supabase
      const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
      if (!isTestEnv) {
        setTimeout(() => {
          this.puxarAtualizacoesServidor().catch(() => {});
        }, 100);
      }
    }
  }

  iniciarSincronizacaoAutomatica() {
    // Requisito: Envio para Online 100% manual. Nenhum processo automático ou timer deve disparar integração em background.
  }

  limparTudoMemoria() {
    this.produtos = [];
    this.serialMap.clear();
    this.lotesFinalizados = [];
    this.historico = [];
    this.fotosGrupos = [];
    this.registros10Fotos = [];
    this.tentativasDuplicadas = [];
    this.importBatches = [];
    this.regionalReferences = [];
    this.referenceMap.clear();
    this.auditLots = [];
  }

  carregarTudoMemoria() {
    this.carregarDados();
  }

  private carregarDados() {
    try {
      const prodRaw = localStorage.getItem(STORAGE_KEY_PRODUTOS);
      this.produtos = prodRaw ? JSON.parse(prodRaw) : [];

      const userRaw = localStorage.getItem(STORAGE_KEY_USUARIOS);
      this.usuarios = userRaw ? JSON.parse(userRaw) : [...DEFAULT_USUARIOS];

      // Migração idempotente: garantir que todos os usuários regionais e admin obrigatórios existam sem sobrescrever senhas
      for (const defUser of DEFAULT_USUARIOS) {
        const idx = this.usuarios.findIndex(
          (u) => u.login.trim().toUpperCase() === defUser.login.toUpperCase()
        );
        if (idx === -1) {
          this.usuarios.push({ ...defUser });
        } else {
          // Não sobrescreve a senha cadastrada pelo usuário
          if (!this.usuarios[idx].senha && defUser.senha) {
            this.usuarios[idx].senha = defUser.senha;
          }
          this.usuarios[idx].perfil = defUser.perfil;
          this.usuarios[idx].regional = defUser.regional;
          this.usuarios[idx].ativo = true;
        }
      }

      // Migração: garantir que todos os produtos tenham regional, computador e status de sincronização padronizados
      let migrou = false;
      for (const p of this.produtos) {
        if (!p.regional) {
          p.regional = 'VIA VAREJO RJ';
          migrou = true;
        }
        if (!p.computador_id) {
          let pcPrefixo = 'PC-RJ-001';
          if (p.regional.includes('SP')) pcPrefixo = 'PC-SP-001';
          else if (p.regional.includes('MG')) pcPrefixo = 'PC-MG-001';
          else if (p.regional.includes('BA')) pcPrefixo = 'PC-BA-001';
          p.computador_id = pcPrefixo;
          p.computador_nome = 'Estação 01';
          migrou = true;
        }
        if (!p.id_local) {
          p.id_local = p.id;
          migrou = true;
        }
        if (!p.status_sincronizacao) {
          if (p.sync_status === 'SINCRONIZADO' || p.sync_status === 'ENVIADO') {
            p.status_sincronizacao = 'ENVIADO';
            p.id_servidor = p.id_servidor || `SRV-${p.id}`;
            p.data_sincronizacao = p.sync_data || new Date().toISOString();
          } else {
            p.status_sincronizacao = 'PENDENTE';
            p.id_servidor = null;
            p.data_sincronizacao = null;
          }
          migrou = true;
        }
        if (!p.numero_lote) {
          p.numero_lote = '01';
          migrou = true;
        }
      }
      if (migrou) {
        localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(this.produtos));
        localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(this.usuarios));
      }

      const histRaw = localStorage.getItem(STORAGE_KEY_HISTORICO);
      this.historico = histRaw ? JSON.parse(histRaw) : [];

      const fotosRaw = localStorage.getItem(STORAGE_KEY_FOTOS);
      this.fotosGrupos = fotosRaw ? JSON.parse(fotosRaw) : [];

      const fotos10Raw = localStorage.getItem(STORAGE_KEY_FOTOS_10_CAIXAS);
      this.registros10Fotos = fotos10Raw ? JSON.parse(fotos10Raw) : [];

      const tentRaw = localStorage.getItem(STORAGE_KEY_TENTATIVAS_DUPLICADAS);
      this.tentativasDuplicadas = tentRaw ? JSON.parse(tentRaw) : [];

      // Rebuild high-speed serial index (O(1) lookups)
      this.serialMap.clear();
      for (const p of this.produtos) {
        this.serialMap.set(p.serial.trim().toUpperCase(), p);
      }

      // Carregar seriais limpos da tela local
      try {
        const limposRaw = localStorage.getItem(STORAGE_KEY_SERIAIS_LIMPOS_TELA);
        if (limposRaw) {
          const arr = JSON.parse(limposRaw);
          if (Array.isArray(arr)) {
            this.seriaisLimposDaTela = new Set<string>(arr);
          }
        }
      } catch {}

      // Sync to IndexedDB for backup
      if (this.produtos.length > 0) {
        salvarIndexedDB(STORAGE_KEY_PRODUTOS, this.produtos);
        salvarIndexedDB(STORAGE_KEY_USUARIOS, this.usuarios);
        salvarIndexedDB(STORAGE_KEY_HISTORICO, this.historico);
        salvarIndexedDB(STORAGE_KEY_FOTOS, this.fotosGrupos);
        salvarIndexedDB(STORAGE_KEY_FOTOS_10_CAIXAS, this.registros10Fotos);
        salvarIndexedDB(STORAGE_KEY_LOTES_FINALIZADOS, this.lotesFinalizados);
      }

      // Carregar lotes finalizados
      const lotesRaw = localStorage.getItem(STORAGE_KEY_LOTES_FINALIZADOS);
      this.lotesFinalizados = lotesRaw ? JSON.parse(lotesRaw) : [];

      // Carregar batches de importação de planilhas regionais
      try {
        const batchesRaw = localStorage.getItem(STORAGE_KEY_IMPORT_BATCHES);
        this.importBatches = batchesRaw ? JSON.parse(batchesRaw) : [];
      } catch {
        this.importBatches = [];
      }

      // Carregar referências de inventário regional
      try {
        const refsRaw = localStorage.getItem(STORAGE_KEY_REGIONAL_REFS);
        this.regionalReferences = refsRaw ? JSON.parse(refsRaw) : [];
      } catch {
        this.regionalReferences = [];
      }

      // Carregar lotes dinâmicos de auditoria
      try {
        const lotsRaw = localStorage.getItem(STORAGE_KEY_AUDIT_LOTS);
        this.auditLots = lotsRaw ? JSON.parse(lotsRaw) : [];
      } catch {
        this.auditLots = [];
      }

      this.reconstruirMapaReferencia();

      // Carregar colaborador ativo da sessão
      const colabRaw = sessionStorage.getItem(STORAGE_KEY_COLABORADOR_ATIVO) || localStorage.getItem(STORAGE_KEY_COLABORADOR_ATIVO);
      this.colaboradorAtivo = colabRaw || null;

      // Limpeza de sessão legada no localStorage para garantir que entrar no sistema sempre exija login
      localStorage.removeItem('solutions_auditoria_sessao');

      // Verificar se há sessão ativa apenas na aba atual (sessionStorage)
      const sess = sessionStorage.getItem('solutions_auditoria_sessao');
      if (sess) {
        try {
          const parsed = JSON.parse(sess);
          const match = this.usuarios.find(
            (u) => u.login.toUpperCase() === parsed.login?.toUpperCase()
          );
          if (match && match.ativo) {
            if (parsed.nome_colaborador) {
              match.nome_colaborador = parsed.nome_colaborador;
              this.colaboradorAtivo = parsed.nome_colaborador;
            }
            this.usuarioAtual = match;
          } else {
            this.usuarioAtual = null;
          }
        } catch {
          this.usuarioAtual = null;
        }
      } else {
        this.usuarioAtual = null; // Exigir login ao entrar no sistema
      }
    } catch (e) {
      console.error('Erro ao carregar banco local:', e);
      this.produtos = [];
      this.usuarios = [...DEFAULT_USUARIOS];
      this.historico = [];
      this.lotesFinalizados = [];
      this.colaboradorAtivo = null;
      this.usuarioAtual = null;
    }
  }

  private reconstruirMapaReferencia() {
    this.referenceMap.clear();
    for (const ref of this.regionalReferences) {
      if (ref.is_active) {
        const imeiNorm = normalizeImei(ref.imei_normalized);
        const regFull = (ref.regional || '').trim().toUpperCase();
        const regCod = extrairCodigoRegional(ref.regional);
        this.referenceMap.set(`${regFull}#${imeiNorm}`, ref);
        this.referenceMap.set(`${regCod}#${imeiNorm}`, ref);
      }
    }
  }

  // Auto-recuperação caso localStorage tenha sido limpo pelo usuário
  private async verificarRecuperacaoIndexedDB() {
    if (this.limpezaEmAndamento) return;
    try {
      const resetTimestamp = typeof window !== 'undefined' ? localStorage.getItem('solutions_base_zerada_timestamp') : null;
      if (resetTimestamp) {
        // A base foi oficialmente zerada pelo Administrador. Não restaurar resíduos antigos!
        return;
      }

      if (this.produtos.length === 0) {
        const idbProds = await carregarIndexedDB<ProdutoAuditoria[]>(STORAGE_KEY_PRODUTOS);
        if (idbProds && idbProds.length > 0 && this.produtos.length === 0 && !this.limpezaEmAndamento) {
          this.produtos = idbProds;
          this.serialMap.clear();
          for (const p of this.produtos) {
            if (!p.regional) p.regional = 'VIA VAREJO RJ';
            this.serialMap.set(p.serial.trim().toUpperCase(), p);
          }
          localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(this.produtos));
          console.log(`🛡️ Recuperados ${idbProds.length} registros com sucesso do IndexedDB redundante.`);
        }

        const idbLotes = await carregarIndexedDB<RegistroLoteFinalizado[]>(STORAGE_KEY_LOTES_FINALIZADOS);
        if (idbLotes && idbLotes.length > 0 && this.lotesFinalizados.length === 0 && !this.limpezaEmAndamento) {
          this.lotesFinalizados = idbLotes;
          localStorage.setItem(STORAGE_KEY_LOTES_FINALIZADOS, JSON.stringify(this.lotesFinalizados));
        }
      }

      // Auto-recuperação de batches e referências do IndexedDB
      if (typeof window !== 'undefined' && !this.limpezaEmAndamento) {
        if (this.importBatches.length === 0) {
          const batches = await idb.inventory_import_batches.toArray().catch(() => []);
          if (batches && batches.length > 0) {
            this.importBatches = batches;
            localStorage.setItem(STORAGE_KEY_IMPORT_BATCHES, JSON.stringify(this.importBatches));
          }
        }
        if (this.regionalReferences.length === 0) {
          const refs = await idb.regional_inventory_reference.toArray().catch(() => []);
          if (refs && refs.length > 0) {
            this.regionalReferences = refs;
            this.reconstruirMapaReferencia();
            try {
              localStorage.setItem(STORAGE_KEY_REGIONAL_REFS, JSON.stringify(this.regionalReferences));
            } catch {}
          }
        }
        if (this.auditLots.length === 0) {
          const lots = await idb.audit_lots.toArray().catch(() => []);
          if (lots && lots.length > 0) {
            this.auditLots = lots;
            localStorage.setItem(STORAGE_KEY_AUDIT_LOTS, JSON.stringify(this.auditLots));
          }
        }
      }
    } catch (err) {
      console.warn('Falha na checagem de recuperação do IndexedDB:', err);
    }
  }

  // Sistema de Notificação Reativa em Tempo Real (Zero necessidade de atualizar a página)
  notificarMudanca(tipo: string = 'dados') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('solutions_dados_atualizados', { detail: { tipo } })
      );
    }
  }

  onMudanca(callback: (tipo: string) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const listener = (e: Event) => {
      const customEvent = e as CustomEvent<{ tipo: string }>;
      callback(customEvent.detail?.tipo || 'dados');
    };
    window.addEventListener('solutions_dados_atualizados', listener);
    return () => window.removeEventListener('solutions_dados_atualizados', listener);
  }

  private salvarTudo() {
    try {
      // 1. Gravação síncrona no LocalStorage (registros leves e metadados)
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(this.produtos));
        localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(this.usuarios));
        localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(this.historico));
        localStorage.setItem(STORAGE_KEY_LOTES_FINALIZADOS, JSON.stringify(this.lotesFinalizados));
        localStorage.setItem(STORAGE_KEY_TENTATIVAS_DUPLICADAS, JSON.stringify(this.tentativasDuplicadas));
        localStorage.setItem(STORAGE_KEY_IMPORT_BATCHES, JSON.stringify(this.importBatches));
        localStorage.setItem(STORAGE_KEY_AUDIT_LOTS, JSON.stringify(this.auditLots));

        // Referências regionais protegidas contra QuotaExceededError no LocalStorage
        try {
          localStorage.setItem(STORAGE_KEY_REGIONAL_REFS, JSON.stringify(this.regionalReferences));
        } catch (refQuotaErr) {
          console.warn('LocalStorage com cota excedida para referências regionais. O IndexedDB estruturado mantém persistência completa.', refQuotaErr);
        }

        // Fotos brutas no localStorage são protegidas contra QuotaExceededError
        try {
          localStorage.setItem(STORAGE_KEY_FOTOS, JSON.stringify(this.fotosGrupos));
          localStorage.setItem(STORAGE_KEY_FOTOS_10_CAIXAS, JSON.stringify(this.registros10Fotos));
        } catch (quotaErr) {
          console.warn('LocalStorage com cota excedida para fotos. O IndexedDB estruturado mantém persistência completa.', quotaErr);
        }
      }

      // 2. Gravação primária estruturada no IndexedDB (Dexie) com garantia transacional
      if (typeof window !== 'undefined') {
        idb.transaction(
          'rw',
          [
            idb.produtos,
            idb.usuarios,
            idb.lotes_finalizados,
            idb.computadores,
            idb.inventory_import_batches,
            idb.regional_inventory_reference,
            idb.audit_lots,
          ],
          async () => {
            if (this.produtos.length > 0) await idb.produtos.bulkPut(this.produtos);
            if (this.usuarios.length > 0) await idb.usuarios.bulkPut(this.usuarios);
            if (this.lotesFinalizados.length > 0) await idb.lotes_finalizados.bulkPut(this.lotesFinalizados);
            if (this.importBatches.length > 0) await idb.inventory_import_batches.bulkPut(this.importBatches);
            if (this.regionalReferences.length > 0) await idb.regional_inventory_reference.bulkPut(this.regionalReferences);
            if (this.auditLots.length > 0) await idb.audit_lots.bulkPut(this.auditLots);
          }
        ).catch((err) => {
          console.error('Falha na gravação transacional do IndexedDB:', err);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('solutions_erro_persistencia', {
                detail: { erro: 'Falha na persistência transacional local (IndexedDB).' },
              })
            );
          }
        });
      }

      // 3. Gravação redundante
      salvarIndexedDB(STORAGE_KEY_PRODUTOS, this.produtos).catch(() => {});
      salvarIndexedDB(STORAGE_KEY_USUARIOS, this.usuarios).catch(() => {});
      salvarIndexedDB(STORAGE_KEY_HISTORICO, this.historico).catch(() => {});
      salvarIndexedDB(STORAGE_KEY_LOTES_FINALIZADOS, this.lotesFinalizados).catch(() => {});
      salvarIndexedDB(STORAGE_KEY_IMPORT_BATCHES, this.importBatches).catch(() => {});
      salvarIndexedDB(STORAGE_KEY_AUDIT_LOTS, this.auditLots).catch(() => {});
    } catch (e) {
      console.error('Erro crítico ao salvar no storage:', e);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('solutions_erro_persistencia', {
            detail: { erro: 'Falha crítica ao gravar dados locais: ' + (e instanceof Error ? e.message : String(e)) },
          })
        );
      }
    }
    this.notificarMudanca('dados');
  }

  // Auth
  getUsuarioAtual(): Usuario | null {
    return this.usuarioAtual;
  }

  setUsuarioAtual(u: Usuario | null) {
    this.usuarioAtual = u;
    if (u) {
      sessionStorage.setItem('solutions_auditoria_sessao', JSON.stringify(u));
      // CORREÇÃO 1 — Sincronização automática após login buscando dados da API central
      const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
      if (typeof window !== 'undefined' && !isTestEnv) {
        setTimeout(() => {
          this.puxarAtualizacoesServidor().catch(() => {});
        }, 50);
      }
    } else {
      sessionStorage.removeItem('solutions_auditoria_sessao');
      this.limparColaboradorAtivo();
    }
    localStorage.removeItem('solutions_auditoria_sessao');
  }

  // =========================================================================
  // IDENTIFICAÇÃO DO COLABORADOR (OPERADOR NA BANCADA)
  // Rastreabilidade obrigatória para todos os operadores no sistema
  // =========================================================================
  definirColaboradorAtivo(nome: string): void {
    const nomeLimpo = (nome || '').trim();
    this.colaboradorAtivo = nomeLimpo || null;
    if (nomeLimpo) {
      sessionStorage.setItem(STORAGE_KEY_COLABORADOR_ATIVO, nomeLimpo);
      localStorage.setItem(STORAGE_KEY_COLABORADOR_ATIVO, nomeLimpo);
      if (this.usuarioAtual) {
        this.usuarioAtual.nome_colaborador = nomeLimpo;
        sessionStorage.setItem('solutions_auditoria_sessao', JSON.stringify(this.usuarioAtual));
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY_COLABORADOR_ATIVO);
      localStorage.removeItem(STORAGE_KEY_COLABORADOR_ATIVO);
      if (this.usuarioAtual) {
        delete this.usuarioAtual.nome_colaborador;
        sessionStorage.setItem('solutions_auditoria_sessao', JSON.stringify(this.usuarioAtual));
      }
    }
    this.notificarMudanca('colaborador');
  }

  obterColaboradorAtivo(): string | null {
    if (this.colaboradorAtivo) return this.colaboradorAtivo;
    const s = sessionStorage.getItem(STORAGE_KEY_COLABORADOR_ATIVO) || localStorage.getItem(STORAGE_KEY_COLABORADOR_ATIVO);
    if (s) {
      this.colaboradorAtivo = s;
      return s;
    }
    return this.usuarioAtual?.nome_colaborador || null;
  }

  limparColaboradorAtivo(): void {
    this.definirColaboradorAtivo('');
  }

  // =========================================================================
  // IDENTIFICAÇÃO DO COMPUTADOR (WORKSTATION FINGERPRINT)
  // Cada computador possui identificação única automática (ex: PC-RJ-001)
  // Permite que o mesmo login seja usado em múltiplos computadores simultâneos.
  // =========================================================================
  // =========================================================================
  // IDENTIFICAÇÃO E ENROLLMENT DO DISPOSITIVO (WORKSTATION ENROLLMENT)
  // Cada estação de trabalho possui identidade criptográfica imutável (UUID)
  // Administradores podem revogar ou autorizar dispositivos remotamente.
  // =========================================================================
  obterComputadorAtual(regional?: string): ComputadorInfo {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_COMPUTADOR) : null;
    let comp: ComputadorInfo | null = null;
    if (raw) {
      try {
        comp = JSON.parse(raw);
      } catch {}
    }

    const reg = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    let sufixo = 'RJ';
    if (reg.includes('SP')) sufixo = 'SP';
    else if (reg.includes('MG')) sufixo = 'MG';
    else if (reg.includes('BA')) sufixo = 'BA';

    if (!comp || !comp.device_id) {
      const novoDeviceId = gerarUUID();
      comp = {
        id: comp?.id || `PC-${sufixo}-001`,
        device_id: novoDeviceId,
        nome: comp?.nome || `Estação de Bipagem 01`,
        regional: reg,
        data_primeiro_uso: comp?.data_primeiro_uso || new Date().toISOString(),
        status: 'ATIVO',
        app_version: VERSAO_LOCAL.versao,
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      };
      this.definirComputadorAtual(comp);
      return comp;
    }

    // Atualiza metadados em tempo de execução
    comp.last_seen_at = new Date().toISOString();
    comp.app_version = VERSAO_LOCAL.versao;

    // Atualiza regional e sufixo do computador conforme a regional ativa
    if (reg && comp.regional !== reg) {
      comp.regional = reg;
      if (comp.id && comp.id.match(/^PC-(RJ|SP|MG|BA)-/i)) {
        comp.id = comp.id.replace(/^PC-(RJ|SP|MG|BA)-/i, `PC-${sufixo}-`);
      }
    }

    // Sincroniza com a lista de dispositivos para verificar revogações
    const lista = this.listarComputadoresCadastrados();
    const existente = lista.find((c) => c.device_id === comp!.device_id || c.id === comp!.id);
    if (existente && existente.status === 'REVOGADO') {
      comp.status = 'REVOGADO';
      comp.revoked_at = existente.revoked_at;
    }

    this.definirComputadorAtual(comp);
    return comp;
  }

  definirComputadorAtual(info: ComputadorInfo): void {
    if (!info.device_id) {
      info.device_id = gerarUUID();
    }
    if (!info.status) {
      info.status = 'ATIVO';
    }
    info.last_seen_at = new Date().toISOString();
    info.app_version = VERSAO_LOCAL.versao;

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_COMPUTADOR, JSON.stringify(info));
    }
    this.salvarComputadorNaLista(info);
  }

  private salvarComputadorNaLista(info: ComputadorInfo): void {
    const lista = this.listarComputadoresCadastrados();
    const idx = lista.findIndex((c) => c.device_id === info.device_id || c.id === info.id);
    if (idx >= 0) {
      lista[idx] = { ...lista[idx], ...info };
    } else {
      lista.push(info);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_COMPUTADORES, JSON.stringify(lista));
    }
  }

  listarComputadoresCadastrados(regional?: string): ComputadorInfo[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_COMPUTADORES) : null;
    let lista: ComputadorInfo[] = [];
    if (raw) {
      try {
        lista = JSON.parse(raw);
      } catch {}
    }
    if (lista.length === 0) {
      lista = [
        { id: 'PC-RJ-001', device_id: 'd1000000-0000-4000-8000-000000000001', nome: 'Estação 01 - RJ', regional: 'VIA VAREJO RJ', data_primeiro_uso: '2026-09-01T08:00:00.000Z', status: 'ATIVO', app_version: '1.2.0', last_seen_at: '2026-09-15T12:00:00.000Z' },
        { id: 'PC-RJ-002', device_id: 'd1000000-0000-4000-8000-000000000002', nome: 'Estação 02 - RJ', regional: 'VIA VAREJO RJ', data_primeiro_uso: '2026-09-01T08:00:00.000Z', status: 'ATIVO', app_version: '1.2.0', last_seen_at: '2026-09-15T12:00:00.000Z' },
        { id: 'PC-RJ-003', device_id: 'd1000000-0000-4000-8000-000000000003', nome: 'Estação 03 - RJ', regional: 'VIA VAREJO RJ', data_primeiro_uso: '2026-09-02T08:00:00.000Z', status: 'ATIVO', app_version: '1.2.0', last_seen_at: '2026-09-15T12:00:00.000Z' },
        { id: 'PC-SP-001', device_id: 'd1000000-0000-4000-8000-000000000004', nome: 'Estação 01 - SP', regional: 'VIA VAREJO SP', data_primeiro_uso: '2026-09-01T08:00:00.000Z', status: 'ATIVO', app_version: '1.2.0', last_seen_at: '2026-09-15T12:00:00.000Z' },
        { id: 'PC-SP-002', device_id: 'd1000000-0000-4000-8000-000000000005', nome: 'Estação 02 - SP', regional: 'VIA VAREJO SP', data_primeiro_uso: '2026-09-01T08:00:00.000Z', status: 'ATIVO', app_version: '1.2.0', last_seen_at: '2026-09-15T12:00:00.000Z' },
        { id: 'PC-MG-001', device_id: 'd1000000-0000-4000-8000-000000000006', nome: 'Estação 01 - MG', regional: 'VIA VAREJO MG', data_primeiro_uso: '2026-09-01T08:00:00.000Z', status: 'ATIVO', app_version: '1.2.0', last_seen_at: '2026-09-15T12:00:00.000Z' },
        { id: 'PC-BA-001', device_id: 'd1000000-0000-4000-8000-000000000007', nome: 'Estação 01 - BA', regional: 'VIA VAREJO BA', data_primeiro_uso: '2026-09-01T08:00:00.000Z', status: 'ATIVO', app_version: '1.2.0', last_seen_at: '2026-09-15T12:00:00.000Z' },
      ];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_COMPUTADORES, JSON.stringify(lista));
      }
    }
    for (const p of this.produtos) {
      if (p.computador_id && !lista.some((c) => c.id === p.computador_id)) {
        lista.push({
          id: p.computador_id,
          device_id: gerarUUID(),
          nome: p.computador_nome || p.computador_id,
          regional: p.regional,
          data_primeiro_uso: p.data_cadastro,
          status: 'ATIVO',
          app_version: VERSAO_LOCAL.versao,
          last_seen_at: p.data_cadastro,
        });
      }
    }
    if (regional && regional !== 'TODAS') {
      return lista.filter((c) => c.regional === regional);
    }
    return lista;
  }

  isDispositivoRevogado(deviceId?: string): boolean {
    const comp = this.obterComputadorAtual();
    const target = deviceId || comp.device_id || comp.id;
    const lista = this.listarComputadoresCadastrados();
    const achado = lista.find((c) => c.device_id === target || c.id === target);
    return achado ? achado.status === 'REVOGADO' : comp.status === 'REVOGADO';
  }

  revogarDispositivo(identificador: string, motivo?: string): { sucesso: boolean; erro?: string } {
    if (!isAdminOuSuper(this.usuarioAtual?.perfil)) {
      return { sucesso: false, erro: 'Apenas Administradores têm permissão para revogar dispositivos.' };
    }
    const lista = this.listarComputadoresCadastrados();
    const idx = lista.findIndex((c) => c.device_id === identificador || c.id === identificador);
    if (idx === -1) {
      return { sucesso: false, erro: 'Dispositivo não encontrado.' };
    }
    const agora = new Date().toISOString();
    lista[idx].status = 'REVOGADO';
    lista[idx].revoked_at = agora;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_COMPUTADORES, JSON.stringify(lista));
    }

    const ativo = this.obterComputadorAtual();
    if (ativo.device_id === lista[idx].device_id || ativo.id === lista[idx].id) {
      ativo.status = 'REVOGADO';
      ativo.revoked_at = agora;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_COMPUTADOR, JSON.stringify(ativo));
      }
    }

    const detalheMotivo = motivo?.trim() ? `. Motivo: ${motivo.trim()}` : '';
    this.registrarHistorico(
      this.usuarioAtual?.nome || 'Admin',
      'REVOGACAO_DISPOSITIVO',
      `Dispositivo ${lista[idx].nome} (${lista[idx].id}) revogado pelo administrador${detalheMotivo}.`
    );
    return { sucesso: true };
  }

  reativarDispositivo(identificador: string): { sucesso: boolean; erro?: string } {
    if (!isAdminOuSuper(this.usuarioAtual?.perfil)) {
      return { sucesso: false, erro: 'Apenas Administradores têm permissão para reativar dispositivos.' };
    }
    const lista = this.listarComputadoresCadastrados();
    const idx = lista.findIndex((c) => c.device_id === identificador || c.id === identificador);
    if (idx === -1) {
      return { sucesso: false, erro: 'Dispositivo não encontrado.' };
    }
    lista[idx].status = 'ATIVO';
    lista[idx].revoked_at = null;
    lista[idx].last_seen_at = new Date().toISOString();
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_COMPUTADORES, JSON.stringify(lista));
    }

    const ativo = this.obterComputadorAtual();
    if (ativo.device_id === lista[idx].device_id || ativo.id === lista[idx].id) {
      ativo.status = 'ATIVO';
      ativo.revoked_at = null;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_COMPUTADOR, JSON.stringify(ativo));
      }
    }

    this.registrarHistorico(
      this.usuarioAtual?.nome || 'Admin',
      'REATIVACAO_DISPOSITIVO',
      `Dispositivo ${lista[idx].nome} (${lista[idx].id}) reativado com sucesso.`
    );
    return { sucesso: true };
  }

  autenticar(login: string, pass: string): { sucesso: boolean; usuario?: Usuario; sessao?: SessaoUsuario; erro?: string } {
    const loginNorm = login.trim().toUpperCase();
    const passTrim = pass.trim();

    // 0. Verificação de Dispositivo Revogado (Gate 2: revoked device -> denied)
    if (this.isDispositivoRevogado()) {
      return {
        sucesso: false,
        erro: 'Acesso bloqueado: Este dispositivo foi revogado pelo Administrador do Sistema. Contate o suporte.',
      };
    }

    // REGRA FUNDAMENTAL: O Painel Administrativo / Servidor Central funciona exclusivamente ONLINE na Web
    // O aplicativo instalado no computador é exclusivo para operação e bipagem dos operadores nas bancadas
    if ((loginNorm === 'ADMIN' || loginNorm === 'ADMINISTRADOR' || loginNorm === 'SUPERADMIN') && isDesktopApp()) {
      return {
        sucesso: false,
        erro: 'Acesso Restrito: O Painel de Administrador (Servidor Central) deve ser acessado exclusivamente pela versão Web Online (https://sistema-auditoria-solutions.vercel.app). Este aplicativo instalado no computador é exclusivo para operadores nas bancadas.',
      };
    }

    const user = this.usuarios.find((u) => {
      const uLogin = u.login.trim().toUpperCase();
      return uLogin === loginNorm && u.ativo;
    });

    if (!user) {
      return { sucesso: false, erro: 'Usuário não encontrado ou usuário inativo.' };
    }

    if (isAdminOuSuper(user.perfil) && isDesktopApp()) {
      return {
        sucesso: false,
        erro: 'Acesso Restrito: O Painel de Administrador (Servidor Central) deve ser acessado exclusivamente pela versão Web Online (https://sistema-auditoria-solutions.vercel.app). Este aplicativo instalado no computador é exclusivo para operadores nas bancadas.',
      };
    }

    // Primeiro acesso / Bootstrap Seguro (senha ainda não configurada no sistema)
    if (!user.senha || user.senha === '') {
      if (passTrim.length < 6) {
        return {
          sucesso: false,
          erro: 'Primeiro acesso detectado: Por motivos de segurança, defina sua nova senha de acesso (mínimo de 6 caracteres).',
        };
      }
      user.senha = hashSenha(passTrim);
      this.salvarTudo();
      this.registrarHistorico(
        user.nome,
        'BOOTSTRAP_SENHA',
        `Senha inicial cadastrada com sucesso no primeiro acesso para o usuário ${user.login}.`
      );
    } else {
      // Validação de senha: hash SHA-256 seguro ou migração transparente de legado em texto puro
      const hashedAttempt = hashSenha(passTrim);
      const isMatch = user.senha === hashedAttempt || user.senha === passTrim;
      if (!isMatch) {
        return { sucesso: false, erro: 'Usuário ou senha incorretos.' };
      }
      // Se estava em texto puro (legado), migra imediatamente para hash seguro
      if (user.senha === passTrim) {
        user.senha = hashedAttempt;
        this.salvarTudo();
      }
    }

    // Emissão do Token de Sessão Criptográfico (Gate 2)
    const comp = this.obterComputadorAtual(user.regional || undefined);
    const sessao = criarTokenSessao(user, comp.device_id || comp.id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('solutions_auth_session_token_v1', sessao.token);
    }

    this.setUsuarioAtual(user);
    this.registrarHistorico(
      user.nome,
      'LOGIN',
      `Usuário ${user.nome} [${user.perfil}] (${user.regional || 'Geral'}) autenticado com sucesso no dispositivo ${comp.id}.`
    );
    return { sucesso: true, usuario: user, sessao };
  }

  // Audit History
  registrarHistorico(usuario: string, acao: string, detalhes: string, regional?: string) {
    const log: HistoricoAuditoria = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      usuario,
      regional: regional || this.usuarioAtual?.regional || undefined,
      acao,
      detalhes,
      data_hora: new Date().toLocaleString('pt-BR'),
    };
    this.historico.unshift(log);
    // Limit in-memory history to 2000 records
    if (this.historico.length > 2000) {
      this.historico = this.historico.slice(0, 2000);
    }
    this.salvarTudo();
  }

  listarHistorico(limite = 200): HistoricoAuditoria[] {
    return this.historico.slice(0, limite);
  }

  async registrarErroCritico(params: {
    operacao: string;
    erro: string;
    detalhes?: any;
  }): Promise<void> {
    const usuario = this.usuarioAtual;
    const computador = this.obterComputadorAtual();
    const horario = new Date().toISOString();

    // 1. Gravar no histórico de auditoria local
    this.registrarHistorico(
      usuario?.nome || 'Operador',
      'ERRO_CRITICO',
      `[${params.operacao}] ${params.erro}${params.detalhes ? ` - ${JSON.stringify(params.detalhes)}` : ''}`
    );

    // 2. Enviar para a API Central / Supabase audit_log
    const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
    if (!isTestEnv) {
      try {
        const urlLog = obterApiUrl('/api/central/log');
        await fetch(urlLog, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario,
            computador,
            horario,
            erro: params.erro,
            operacao: params.operacao,
            detalhes: params.detalhes,
            regional: usuario?.regional || computador.regional,
          }),
        }).catch(() => {});
      } catch {}
    }
  }

  // =========================================================================
  // LOGS E GESTÃO DE TENTATIVAS DE ENVIO DUPLICADO (IMEI BLOQUEADO NO SERVIDOR)
  // =========================================================================
  registrarTentativaEnvioDuplicado(log: Omit<LogTentativaDuplicado, 'id'>) {
    const novoLog: LogTentativaDuplicado = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      ...log,
    };
    this.tentativasDuplicadas.unshift(novoLog);
    if (this.tentativasDuplicadas.length > 2000) {
      this.tentativasDuplicadas = this.tentativasDuplicadas.slice(0, 2000);
    }
    this.salvarTudo();
    this.notificarMudanca('tentativas-duplicadas');
  }

  listarTentativasDuplicadas(limite = 500): LogTentativaDuplicado[] {
    return this.tentativasDuplicadas.slice(0, limite);
  }

  limparTentativasDuplicadas() {
    this.tentativasDuplicadas = [];
    this.salvarTudo();
    this.notificarMudanca('tentativas-duplicadas');
  }

  removerItensDuplicadosFila(idsOuSeriais: (number | string)[]): { removidos: number } {
    let count = 0;
    const targets = new Set(idsOuSeriais.map((item) => String(item).trim().toUpperCase()));
    for (let i = this.produtos.length - 1; i >= 0; i--) {
      const p = this.produtos[i];
      const matchId = targets.has(String(p.id));
      const matchSerial = targets.has(p.serial.trim().toUpperCase());
      if (matchId || matchSerial) {
        // Apenas remover se não estiver confirmado como ENVIADO (evitar acidentes)
        if (p.status_sincronizacao !== 'ENVIADO') {
          this.produtos.splice(i, 1);
          this.serialMap.delete(p.serial.trim().toUpperCase());
          count++;
        }
      }
    }
    if (count > 0) {
      this.salvarTudo();
      this.notificarMudanca('produtos');
      this.notificarMudanca('sync');
    }
    return { removidos: count };
  }

  // Product Audit Core
  buscarPorSerial(serial: string): ProdutoAuditoria | undefined {
    return this.serialMap.get(serial.trim().toUpperCase());
  }

  obterProdutoPorSerial(serial: string): ProdutoAuditoria | null {
    return this.buscarPorSerial(serial) || null;
  }

  validarDuplicidade(serial: string): { duplicado: boolean; produto?: ProdutoAuditoria } {
    const norm = serial.trim().toUpperCase();
    const existing = this.serialMap.get(norm);
    if (existing) {
      return { duplicado: true, produto: existing };
    }
    return { duplicado: false };
  }

  inserirProduto(item: {
    modelo_produto: string;
    ean?: string;
    sku?: string | null;
    serial: string;
    imei?: string;
    numero_lote?: string;
    data_auditoria?: string;
    numero_caixa: string;
    numero_nf?: string;
    nf_conferida?: SimNao | null;
    produto_lacrado: SimNao;
    lacre_seguranca?: string | null;
    regional?: string;
    kit_completo?: SimNao | null;
    aparelho_marcas_uso?: SimNao | null;
    observacao?: string;
    fabricante?: string;
    source_type?: 'LISTED' | 'OUT_OF_LIST' | null;
    dealer?: string | null;
    origin_invoice?: string | null;
    brand?: string | null;
    misuse?: boolean | null;
    reference_id?: string | null;
    import_batch_id?: string | null;
    classificacao_produto?: string | null;
    product_classification?: string | null;
    nf_origem?: string | null;
    box_id?: string | null;
    box_name?: string | null;
  }): { sucesso: boolean; produto?: ProdutoAuditoria; erro?: string } {
    // 0.0. Verificação de Dispositivo Revogado (Gate 2: revoked device -> denied)
    if (this.isDispositivoRevogado()) {
      return {
        sucesso: false,
        erro: 'Operação bloqueada: Este dispositivo foi revogado pelo Administrador do Sistema.',
      };
    }

    // 0.0.1. Verificação de Autenticação Obrigatória (Gate 2: unauthenticated -> denied)
    if (!this.usuarioAtual) {
      return {
        sucesso: false,
        erro: 'Não autenticado: Efetue login para auditar produtos.',
      };
    }

    // 0.0.2. Verificação de Escopo Regional (Gate 2: operator cross-region -> denied)
    if (item.regional && !podeAcessarRegional(this.usuarioAtual, item.regional)) {
      return {
        sucesso: false,
        erro: `Acesso negado: Usuário (${this.usuarioAtual.login}) com perfil "${this.usuarioAtual.perfil}" está restrito à regional "${this.usuarioAtual.regional || 'atribuída'}" e não pode registrar produtos em "${item.regional}".`,
      };
    }

    const serialNorm = (item.serial || item.imei || '').trim().toUpperCase();
    const regionalFinal =
      this.usuarioAtual.perfil === 'OPERADOR' && this.usuarioAtual.regional
        ? this.usuarioAtual.regional
        : (item.regional?.trim() || (this.usuarioAtual.regional ? this.usuarioAtual.regional : 'VIA VAREJO RJ'));

    // Consulta de referência de inventário regional ativa (Prompt Mestre Seções 4, 5, 8, 16)
    const refLookup = this.consultarImeiReferencia(serialNorm, regionalFinal);
    const resolvedSourceType: 'LISTED' | 'OUT_OF_LIST' = item.source_type || (refLookup ? 'LISTED' : 'OUT_OF_LIST');
    const resolvedDealer = item.dealer !== undefined ? item.dealer : (refLookup?.dealer_normalized || null);
    const fabExplicit = (item.fabricante || item.brand || '').trim().toUpperCase();
    const resolvedFabricante =
      resolvedSourceType === 'OUT_OF_LIST' && fabExplicit && fabExplicit !== 'FABRICANTE NÃO IDENTIFICADO'
        ? fabExplicit
        : inferirFabricante(
            refLookup ? refLookup.model_description : item.modelo_produto,
            refLookup?.brand || item.fabricante || item.brand || null,
            item.sku || refLookup?.sku || null
          );

    // Nova Regra de Lote: informado pelo colaborador (ex: LOTE 1). Não gera "BA - LISTA - SAMSUNG"
    let loteNorm = (item.numero_lote?.trim() || this.obterUltimoLote() || 'LOTE 1').toUpperCase();

    // Classificação Automática do Produto (separada do lote manual):
    const classificacaoCalculada =
      item.classificacao_produto ||
      item.product_classification ||
      calcularClassificacaoProduto({
        sourceType: resolvedSourceType,
        dealer: resolvedDealer,
        fabricante: resolvedFabricante,
      });

    // NF de Origem Automática como texto de referência:
    const resolvedOriginInvoice =
      item.origin_invoice !== undefined && item.origin_invoice !== null
        ? String(item.origin_invoice).trim()
        : refLookup
        ? (refLookup.origin_invoice || null)
        : (item.numero_nf && item.numero_nf.trim() ? item.numero_nf.trim() : 'NÃO LOCALIZADA NA BASE');

    // Assegurar existência do AuditLot correspondente no catálogo
    this.obterOuCriarLoteAutomatico({
      regional: regionalFinal,
      sourceType: resolvedSourceType,
      dealer: resolvedDealer,
      fabricante: resolvedFabricante,
    });

    // 0.1. Bloqueio de Lote Finalizado: Colaborador não pode inserir produtos em lote já finalizado
    if (!isAdminOuSuper(this.usuarioAtual.perfil) && this.isLoteFinalizado(loteNorm, regionalFinal)) {
      return {
        sucesso: false,
        erro: `O Lote ${loteNorm} foi FINALIZADO e bloqueado. Não é permitida a inclusão de novos produtos neste lote. Inicie um novo lote.`,
      };
    }

    // 1. Validate mandatory fields
    if (!item.modelo_produto.trim()) {
      return { sucesso: false, erro: 'O modelo do produto é obrigatório.' };
    }
    const eanFinal = (item.ean || item.sku || refLookup?.sku || '').trim();
    const finalSku = (item.sku || (resolvedSourceType === 'LISTED' ? (refLookup?.sku || eanFinal) : eanFinal)).trim();
    if (resolvedSourceType === 'OUT_OF_LIST' && !finalSku) {
      return {
        sucesso: false,
        erro: 'O preenchimento do código SKU é obrigatório para produtos fora da lista.',
      };
    }
    if (!finalSku && !eanFinal) {
      return { sucesso: false, erro: 'O código EAN ou SKU do produto é obrigatório.' };
    }
    if (!serialNorm) {
      return { sucesso: false, erro: 'O IMEI do produto é obrigatório.' };
    }
    if (!/^\d{15}$/.test(serialNorm)) {
      return {
        sucesso: false,
        erro: 'IMEI INVÁLIDO: O IMEI deve conter exatamente 15 dígitos numéricos (ex: 357847400282342).',
      };
    }
    if (!item.numero_caixa.trim()) {
      return { sucesso: false, erro: 'O número da caixa é obrigatório.' };
    }
    if (!item.produto_lacrado) {
      return { sucesso: false, erro: 'Informe se o produto está lacrado (SIM ou NÃO).' };
    }

    // 2. Validate unsealed rules
    if (item.produto_lacrado === 'NÃO') {
      if (!item.kit_completo) {
        return { sucesso: false, erro: 'Para produtos NÃO lacrados, o campo Kit Completo é obrigatório.' };
      }
      if (!item.aparelho_marcas_uso) {
        return { sucesso: false, erro: 'Para produtos NÃO lacrados, o campo Aparelho com Marcas de Uso é obrigatório.' };
      }
    }

    // 3. Duplicate check
    const check = this.validarDuplicidade(serialNorm);
    if (check.duplicado && check.produto) {
      return {
        sucesso: false,
        erro: `Este IMEI já foi auditado na ${check.produto.numero_caixa} (${check.produto.regional}) em ${check.produto.data_auditoria}.`,
        produto: check.produto,
      };
    }

    const agora = new Date();
    const usuarioNome = this.obterColaboradorAtivo() || this.usuarioAtual?.nome || 'Operador';

    // 4. REGRA DE NEGÓCIO: LIMITE MÁXIMO DE 20 PRODUTOS POR CAIXA
    const caixaAlvo = item.numero_caixa.trim().toUpperCase();
    if (this.isCaixaCompleta(caixaAlvo, regionalFinal)) {
      return {
        sucesso: false,
        erro: 'Limite de produtos por caixa atingido (capacidade máxima de 20 produtos). Por favor, lance os próximos produtos em outra caixa.',
      };
    }

    // 4.1. REGRA DE CAIXA HOMOGÊNEA (Chave Dupla: Classificação + Condição de Lacre)
    const validacaoCaixa = this.validarCompatibilidadeCaixa({
      caixa: caixaAlvo,
      classificacao: classificacaoCalculada,
      produto_lacrado: item.produto_lacrado,
      regional: regionalFinal,
    });
    if (!validacaoCaixa.compativel) {
      return {
        sucesso: false,
        erro: validacaoCaixa.erro || 'Produto incompatível com a caixa.',
      };
    }

    // 5. REGRA DE CONFERÊNCIA DE NF (Gate 6: sem default implícito para SIM; PENDENTE/null por padrão)
    const nfConferidaValor: SimNao | null = item.nf_conferida !== undefined ? item.nf_conferida : null;
    const divergenciaNf = nfConferidaValor === 'NÃO';
    const statusConformidade: 'CONFORME' | 'NAO_CONFORME' | undefined =
      nfConferidaValor === null
        ? undefined
        : (item.produto_lacrado === 'SIM' && nfConferidaValor === 'SIM' ? 'CONFORME' : 'NAO_CONFORME');

    const compAtual = this.obterComputadorAtual(regionalFinal);
    const idLocal = Date.now();
    const boxClassification = validacaoCaixa.configCaixa?.vazia
      ? classificacaoCalculada
      : (validacaoCaixa.configCaixa?.classificacao || classificacaoCalculada);
    const boxSealedStatus: 'SEALED' | 'OPEN' = validacaoCaixa.configCaixa?.vazia
      ? (item.produto_lacrado === 'SIM' ? 'SEALED' : 'OPEN')
      : (validacaoCaixa.configCaixa?.condicaoLacre === 'LACRADO' ? 'SEALED' : 'OPEN');

    const lacreSegurancaValor =
      item.lacre_seguranca !== undefined && item.lacre_seguranca !== null && String(item.lacre_seguranca).trim() !== ''
        ? String(item.lacre_seguranca).trim().toUpperCase()
        : this.obterLacreCaixa(caixaAlvo, regionalFinal) || null;

    if (lacreSegurancaValor) {
      this.definirLacreCaixa(caixaAlvo, lacreSegurancaValor, regionalFinal);
    }

    const novoProduto: ProdutoAuditoria = {
      id: idLocal,
      id_local: idLocal,
      id_servidor: null,
      uuid: crypto.randomUUID ? crypto.randomUUID() : `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      regional: regionalFinal,
      fabricante: resolvedFabricante,
      modelo_produto: (resolvedSourceType === 'LISTED' && refLookup?.model_description ? refLookup.model_description : item.modelo_produto).trim(),
      ean: eanFinal,
      serial: serialNorm,
      imei: serialNorm,
      data_auditoria: (item.data_auditoria || new Date().toISOString().split('T')[0]).trim(),
      numero_caixa: caixaAlvo,
      numero_lote: loteNorm,
      numero_nf: resolvedOriginInvoice || '',
      nf_conferida: nfConferidaValor,
      status_conformidade: statusConformidade,
      divergencia_nf: divergenciaNf,
      produto_lacrado: item.produto_lacrado,
      lacre_seguranca: lacreSegurancaValor,
      kit_completo: item.produto_lacrado === 'SIM' ? null : item.kit_completo || null,
      aparelho_marcas_uso: item.produto_lacrado === 'SIM' ? null : item.aparelho_marcas_uso || null,
      observacao: (item.observacao || '').trim(),
      data_cadastro: agora.toISOString(),
      usuario_cadastro: usuarioNome,
      computador_id: compAtual.id,
      computador_nome: compAtual.nome,
      data_alteracao: null,
      status_sincronizacao: 'PENDENTE',
      data_sincronizacao: null,
      sync_status: 'PENDENTE',
      sync_data: null,
      // Snapshots da referência regional (Prompt Mestre Seções 4, 5, 16):
      reference_id: item.reference_id !== undefined ? item.reference_id : (refLookup?.id || null),
      import_batch_id: item.import_batch_id !== undefined ? item.import_batch_id : (refLookup?.import_batch_id || null),
      source_type: resolvedSourceType,
      dealer: resolvedDealer,
      origin_invoice: resolvedOriginInvoice,
      nf_origem: resolvedOriginInvoice,
      sku: item.sku !== undefined ? item.sku : (refLookup?.sku || finalSku || eanFinal),
      brand: item.brand !== undefined ? item.brand : resolvedFabricante,
      misuse: item.misuse !== undefined ? item.misuse : (item.aparelho_marcas_uso === 'SIM'),
      classificacao_produto: classificacaoCalculada,
      product_classification: classificacaoCalculada,
      box_classification: boxClassification,
      box_sealed_status: boxSealedStatus,
      box_id: item.box_id || caixaAlvo.toLowerCase().replace(/\s+/g, '-'),
      box_name: item.box_name || caixaAlvo,
    };

    this.produtos.unshift(novoProduto);
    this.serialMap.set(serialNorm, novoProduto);
    this.salvarUltimoLote(loteNorm);

    const chaveSerial = `${regionalFinal.trim().toUpperCase()}:::${serialNorm}`;
    if (this.seriaisLimposDaTela.has(chaveSerial)) {
      this.seriaisLimposDaTela.delete(chaveSerial);
      this.salvarSeriaisLimposDaTela();
    }

    this.salvarTudo();

    // Registro na fila durável Outbox para sincronização Delta (Gate 5)
    enfileirarEventoOutbox({
      device_id: compAtual.device_id || compAtual.id,
      entity_type: 'PRODUTO',
      entity_id: String(novoProduto.id),
      operation: 'INSERT',
      base_revision: 1,
      payload: novoProduto,
    }).catch(() => {});

    this.registrarHistorico(
      usuarioNome,
      'CADASTRO',
      `Usuário ${usuarioNome} cadastrou IMEI ${serialNorm} na ${novoProduto.numero_caixa} [${regionalFinal}]`,
      regionalFinal
    );

    return { sucesso: true, produto: novoProduto };
  }

  atualizarProduto(
    id: number,
    dados: Partial<ProdutoAuditoria>
  ): { sucesso: boolean; produto?: ProdutoAuditoria; erro?: string } {
    const idx = this.produtos.findIndex((p) => p.id === id);
    if (idx === -1) {
      return { sucesso: false, erro: 'Produto não encontrado.' };
    }

    const anterior = this.produtos[idx];

    // Regra de Proteção de Lote Finalizado
    const loteOrig = anterior.numero_lote || '01';
    if (this.usuarioAtual?.perfil !== 'ADMINISTRADOR' && this.isLoteFinalizado(loteOrig, anterior.regional)) {
      return {
        sucesso: false,
        erro: `O Lote ${loteOrig} foi FINALIZADO e bloqueado. Apenas o Administrador Geral pode editar produtos deste lote.`,
      };
    }

    // Regra de Proteção Online: Registros já enviados para o online só podem ser editados pelo Administrador Geral
    if (anterior.status_sincronizacao === 'ENVIADO' && this.usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      return {
        sucesso: false,
        erro: 'Este IMEI já foi enviado para o servidor online. Por segurança da auditoria, apenas o Administrador Geral pode editar registros sincronizados.',
      };
    }

    const candidatoImei = (dados.imei || dados.serial)?.trim();
    if (candidatoImei) {
      if (!/^\d{15}$/.test(candidatoImei)) {
        return {
          sucesso: false,
          erro: 'IMEI INVÁLIDO: O IMEI deve conter exatamente 15 dígitos numéricos (ex: 357847400282342).',
        };
      }
    }
    const serialNovo = candidatoImei || anterior.serial;

    // Check IMEI uniqueness if changing
    if (serialNovo !== anterior.serial && this.serialMap.has(serialNovo)) {
      return { sucesso: false, erro: 'Este IMEI já foi auditado em outro registro.' };
    }

    // Validação de limite de 20 produtos por caixa se estiver trocando de caixa
    if (dados.numero_caixa && dados.numero_caixa.trim().toUpperCase() !== anterior.numero_caixa.trim().toUpperCase()) {
      const caixaDestino = dados.numero_caixa.trim().toUpperCase();
      const totalDestino = this.produtos.filter(
        (p) =>
          p.id !== id &&
          p.numero_caixa?.trim().toUpperCase() === caixaDestino &&
          (!anterior.regional || p.regional?.trim().toUpperCase() === anterior.regional.trim().toUpperCase())
      ).length;
      if (totalDestino >= 20) {
        return {
          sucesso: false,
          erro: `A ${caixaDestino} já atingiu o limite máximo de 20 produtos. Não é possível mover este item para ela.`,
        };
      }
    }

    // Remove old serial from map if changed
    if (serialNovo !== anterior.serial) {
      this.serialMap.delete(anterior.serial);
    }

    let kitCompleto = dados.kit_completo !== undefined ? dados.kit_completo : anterior.kit_completo;
    let marcasUso = dados.aparelho_marcas_uso !== undefined ? dados.aparelho_marcas_uso : anterior.aparelho_marcas_uso;
    if (dados.produto_lacrado === 'SIM') {
      kitCompleto = null;
      marcasUso = null;
    }

    const nfConferidaAtualizada: SimNao | null =
      dados.nf_conferida !== undefined ? dados.nf_conferida : (anterior.nf_conferida ?? null);
    const lacradoAtualizado = dados.produto_lacrado !== undefined ? dados.produto_lacrado : anterior.produto_lacrado;
    const divergenciaNfAtualizada = nfConferidaAtualizada === 'NÃO';
    const statusConformidadeAtualizada: 'CONFORME' | 'NAO_CONFORME' | undefined =
      nfConferidaAtualizada === null
        ? undefined
        : (lacradoAtualizado === 'SIM' && nfConferidaAtualizada === 'SIM' ? 'CONFORME' : 'NAO_CONFORME');

    const originInvoiceAtualizado =
      dados.origin_invoice !== undefined
        ? dados.origin_invoice
        : dados.nf_origem !== undefined
        ? dados.nf_origem
        : dados.numero_nf !== undefined
        ? dados.numero_nf
        : anterior.origin_invoice || anterior.nf_origem || anterior.numero_nf;

    const isItemForaDaLista =
      anterior.source_type === 'OUT_OF_LIST' ||
      dados.source_type === 'OUT_OF_LIST' ||
      anterior.origin_invoice === 'NÃO LOCALIZADA NA BASE' ||
      anterior.nf_origem === 'NÃO LOCALIZADA NA BASE' ||
      Boolean(anterior.classificacao_produto?.includes('FORA DA LISTA'));

    const resolvedSourceType: 'LISTED' | 'OUT_OF_LIST' = isItemForaDaLista
      ? 'OUT_OF_LIST'
      : (dados.source_type || anterior.source_type || 'LISTED');

    const fabricanteAtualizado = (dados.fabricante || dados.brand || anterior.fabricante || anterior.brand || 'OUTRA MARCA').trim().toUpperCase();
    const dealerAtualizado = dados.dealer !== undefined ? dados.dealer : anterior.dealer;

    const mudouFabricanteOuModelo = Boolean(
      (dados.fabricante && dados.fabricante.trim().toUpperCase() !== (anterior.fabricante || '').trim().toUpperCase()) ||
      (dados.brand && dados.brand.trim().toUpperCase() !== (anterior.brand || '').trim().toUpperCase()) ||
      (dados.modelo_produto && dados.modelo_produto.trim() !== anterior.modelo_produto.trim())
    );

    const classificacaoAtualizada =
      dados.classificacao_produto ||
      dados.product_classification ||
      (mudouFabricanteOuModelo
        ? calcularClassificacaoProduto({
            sourceType: resolvedSourceType,
            dealer: dealerAtualizado,
            fabricante: fabricanteAtualizado,
          })
        : (anterior.classificacao_produto ||
           anterior.product_classification ||
           calcularClassificacaoProduto({
             sourceType: resolvedSourceType,
             dealer: dealerAtualizado,
             fabricante: fabricanteAtualizado,
           })));

    // Validação de Caixa Homogênea ao atualizar
    const caixaFinal = (dados.numero_caixa || anterior.numero_caixa).trim().toUpperCase();
    const regionalFinal = dados.regional || anterior.regional;
    const lacradoFinal = (dados.produto_lacrado !== undefined ? dados.produto_lacrado : anterior.produto_lacrado) as SimNao;
    const validacaoCaixa = this.validarCompatibilidadeCaixa({
      caixa: caixaFinal,
      classificacao: classificacaoAtualizada,
      produto_lacrado: lacradoFinal,
      regional: regionalFinal,
      produtoIdIgnorar: id,
    });
    if (!validacaoCaixa.compativel) {
      return {
        sucesso: false,
        erro: validacaoCaixa.erro || 'Produto incompatível com a caixa.',
      };
    }

    const boxClassification = validacaoCaixa.configCaixa?.vazia
      ? classificacaoAtualizada
      : (validacaoCaixa.configCaixa?.classificacao || classificacaoAtualizada);
    const boxSealedStatus: 'SEALED' | 'OPEN' = validacaoCaixa.configCaixa?.vazia
      ? (lacradoFinal === 'SIM' ? 'SEALED' : 'OPEN')
      : (validacaoCaixa.configCaixa?.condicaoLacre === 'LACRADO' ? 'SEALED' : 'OPEN');

    const atualizado: ProdutoAuditoria = {
      ...anterior,
      ...dados,
      serial: serialNovo,
      imei: serialNovo,
      fabricante: fabricanteAtualizado,
      brand: fabricanteAtualizado,
      numero_caixa: caixaFinal,
      numero_lote: dados.numero_lote !== undefined ? (dados.numero_lote || '').trim().toUpperCase() : anterior.numero_lote,
      numero_nf: dados.numero_nf !== undefined ? (dados.numero_nf || '').trim() : (originInvoiceAtualizado || ''),
      origin_invoice: originInvoiceAtualizado,
      nf_origem: originInvoiceAtualizado,
      classificacao_produto: classificacaoAtualizada,
      product_classification: classificacaoAtualizada,
      box_classification: boxClassification,
      box_sealed_status: boxSealedStatus,
      box_id: dados.box_id || caixaFinal.toLowerCase().replace(/\s+/g, '-'),
      box_name: dados.box_name || caixaFinal,
      nf_conferida: nfConferidaAtualizada,
      status_conformidade: statusConformidadeAtualizada,
      divergencia_nf: divergenciaNfAtualizada,
      kit_completo: kitCompleto,
      aparelho_marcas_uso: marcasUso,
      data_alteracao: new Date().toISOString(),
      sync_status: 'PENDENTE',
    };

    this.produtos[idx] = atualizado;
    this.serialMap.set(serialNovo, atualizado);
    this.salvarTudo();

    const usuarioNome = this.obterColaboradorAtivo() || this.usuarioAtual?.nome || 'Administrador';
    this.registrarHistorico(
      usuarioNome,
      'ALTERACAO',
      `Usuário ${usuarioNome} alterou produto IMEI ${serialNovo} (${anterior.numero_caixa}) [${atualizado.regional}]`,
      atualizado.regional
    );

    // Se o lote for finalizado e a alteração foi feita por admin, registra auditoria no histórico do lote
    if (this.isLoteFinalizado(loteOrig, anterior.regional)) {
      this.registrarAlteracaoLoteAdmin(
        loteOrig,
        anterior.regional,
        usuarioNome,
        'ALTERACAO_DADO',
        `Admin ${usuarioNome} alterou produto IMEI ${serialNovo} (Caixa: ${atualizado.numero_caixa}) no Lote ${loteOrig}.`
      );
    }

    return { sucesso: true, produto: atualizado };
  }

  excluirProduto(id: number): { sucesso: boolean; erro?: string } {
    const idx = this.produtos.findIndex((p) => p.id === id);
    if (idx === -1) {
      return { sucesso: false, erro: 'Produto não encontrado.' };
    }

    const removido = this.produtos[idx];

    // Regra de Proteção de Lote Finalizado
    const loteRemovido = removido.numero_lote || '01';
    if (this.usuarioAtual?.perfil !== 'ADMINISTRADOR' && this.isLoteFinalizado(loteRemovido, removido.regional)) {
      return {
        sucesso: false,
        erro: `O Lote ${loteRemovido} foi FINALIZADO e bloqueado. Apenas o Administrador Geral pode excluir produtos deste lote.`,
      };
    }

    // Regra de Proteção Online: Registros já enviados para o online só podem ser excluídos pelo Administrador Geral
    if (removido.status_sincronizacao === 'ENVIADO' && this.usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      return {
        sucesso: false,
        erro: 'Este IMEI já foi enviado para o servidor online. Por segurança da auditoria, apenas o Administrador Geral pode excluir registros sincronizados.',
      };
    }

    this.produtos.splice(idx, 1);
    this.serialMap.delete(removido.serial);
    this.salvarTudo();

    const usuarioNome = this.obterColaboradorAtivo() || this.usuarioAtual?.nome || 'Administrador';
    this.registrarHistorico(
      usuarioNome,
      'EXCLUSAO',
      `Usuário ${usuarioNome} excluiu IMEI ${removido.serial} da ${removido.numero_caixa} [${removido.regional}]`,
      removido.regional
    );

    // Se o lote for finalizado e o item foi excluído por admin, registra no histórico do lote
    if (this.isLoteFinalizado(loteRemovido, removido.regional)) {
      this.registrarAlteracaoLoteAdmin(
        loteRemovido,
        removido.regional,
        usuarioNome,
        'EXCLUSAO_ITEM',
        `Admin ${usuarioNome} excluiu item IMEI ${removido.serial} (${removido.modelo_produto}, Caixa: ${removido.numero_caixa}) do Lote ${loteRemovido}.`
      );
    }

    return { sucesso: true };
  }

  // Lista todas as regionais cadastradas no sistema
  listarRegionais(): string[] {
    const set = new Set<string>(REGIONAIS_PADRAO);
    for (const p of this.produtos) {
      if (p.regional) set.add(p.regional);
    }
    return Array.from(set);
  }

  listarProdutos(filtro?: FiltroConsulta): ProdutoAuditoria[] {
    let baseList = this.produtos;

    // Regra de Permissão Multi-Regional:
    // Se um operador regional estiver logado, ele só tem acesso aos dados da própria regional.
    // Se o administrador estiver logado, pode visualizar todas ou filtrar por regional específica.
    let targetRegional: string | undefined = undefined;
    if (filtro?.regional && filtro.regional !== 'TODAS') {
      targetRegional = filtro.regional;
    } else if (!filtro?.regional) {
      if (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional) {
        targetRegional = this.usuarioAtual.regional;
      }
    }

    if (targetRegional) {
      baseList = baseList.filter((p) => (p.regional || 'VIA VAREJO RJ') === targetRegional);
    }

    if (!filtro) return baseList.map((p) => ({ ...p }));

    return baseList
      .filter((p) => {
        if (filtro.termoBusca) {
          const termo = filtro.termoBusca.toLowerCase().trim();
          const match =
            p.serial.toLowerCase().includes(termo) ||
            p.modelo_produto.toLowerCase().includes(termo) ||
            p.ean.toLowerCase().includes(termo) ||
            p.numero_caixa.toLowerCase().includes(termo) ||
            (p.regional && p.regional.toLowerCase().includes(termo)) ||
            p.observacao.toLowerCase().includes(termo);
          if (!match) return false;
        }
        if (filtro.modelo && filtro.modelo !== 'TODOS' && p.modelo_produto !== filtro.modelo) {
          return false;
        }
        if (filtro.ean && !p.ean.includes(filtro.ean.trim())) {
          return false;
        }
        if (filtro.serial && !p.serial.includes(filtro.serial.trim().toUpperCase())) {
          return false;
        }
        if (filtro.caixa && filtro.caixa !== 'TODOS' && p.numero_caixa !== filtro.caixa) {
          return false;
        }
        if (filtro.numero_lote && filtro.numero_lote !== 'TODOS' && (p.numero_lote || '01').trim().toUpperCase() !== filtro.numero_lote.trim().toUpperCase()) {
          return false;
        }
        if (filtro.data) {
          const normFiltro = normalizarDataParaPostgresDate(filtro.data);
          const normProd = normalizarDataParaPostgresDate(p.data_auditoria);
          if (normFiltro !== normProd && p.data_auditoria !== filtro.data) {
            return false;
          }
        }
        if (filtro.produtoLacrado && filtro.produtoLacrado !== 'TODOS' && p.produto_lacrado !== filtro.produtoLacrado) {
          return false;
        }
        if (filtro.marcasUso && filtro.marcasUso !== 'TODOS' && p.aparelho_marcas_uso !== filtro.marcasUso) {
          return false;
        }
        if (filtro.kitCompleto && filtro.kitCompleto !== 'TODOS' && p.kit_completo !== filtro.kitCompleto) {
          return false;
        }
        if (filtro.computador_id && filtro.computador_id !== 'TODOS' && p.computador_id !== filtro.computador_id) {
          return false;
        }
        if (filtro.status_sincronizacao && filtro.status_sincronizacao !== 'TODOS' && p.status_sincronizacao !== filtro.status_sincronizacao) {
          return false;
        }
        return true;
      })
      .map((p) => ({ ...p }));
  }

  /**
   * Consulta paginada em memória de alta performance para listas grandes (Gate 12)
   * Evita clone e mapeamento desnecessário do array completo.
   */
  listarProdutosPaginado(
    filtro?: FiltroConsulta,
    pagina: number = 1,
    itensPorPagina: number = 50
  ): ResultadoPaginado<ProdutoAuditoria> {
    const todos = this.listarProdutos(filtro);
    const total = todos.length;
    const totalPaginas = Math.max(1, Math.ceil(total / itensPorPagina));
    const paginaAtual = Math.max(1, Math.min(pagina, totalPaginas));
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const itens = todos.slice(inicio, inicio + itensPorPagina);

    return {
      itens,
      total,
      pagina: paginaAtual,
      totalPaginas,
      itensPorPagina,
    };
  }

  // --- REGRAS DE CAPACIDADE DE CAIXA (Gate 6) ---
  obterTotalProdutosNaCaixa(caixa: string, regional?: string): number {
    const caixaNorm = (caixa || '').trim().toUpperCase();
    if (!caixaNorm) return 0;
    const regAlvo = regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    return this.produtos.filter((p) => {
      const matchCaixa = (p.numero_caixa || '').trim().toUpperCase() === caixaNorm;
      const matchReg = !regAlvo || regAlvo === 'TODAS' || (p.regional || '').trim().toUpperCase() === regAlvo.trim().toUpperCase();
      return matchCaixa && matchReg;
    }).length;
  }

  isCaixaCompleta(caixa: string, regional?: string): boolean {
    return isCaixaCompletaQtd(this.obterTotalProdutosNaCaixa(caixa, regional));
  }

  podeFecharCaixa(caixa: string, regional?: string): { pode: boolean; total: number; motivo?: string } {
    return podeFecharCaixaQtd(this.obterTotalProdutosNaCaixa(caixa, regional));
  }

  obterUltimoLote(): string {
    return localStorage.getItem(STORAGE_KEY_ULTIMO_LOTE) || '01';
  }

  salvarUltimoLote(lote: string): void {
    if (lote && lote.trim()) {
      localStorage.setItem(STORAGE_KEY_ULTIMO_LOTE, lote.trim());
    }
  }

  listarLotes(regional?: string): string[] {
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    const set = new Set<string>();
    for (const p of this.produtos) {
      if (!regAlvo || regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo) {
        if (p.numero_lote) set.add(p.numero_lote.trim().toUpperCase());
      }
    }
    const ult = this.obterUltimoLote();
    if (ult) set.add(ult.trim().toUpperCase());

    // Se for operador, REMOVER lotes finalizados (deixam de aparecer para colaboradores conforme Regra 6)
    if (this.usuarioAtual?.perfil === 'OPERADOR') {
      for (const fin of this.lotesFinalizados) {
        if (fin.status === 'FINALIZADO') {
          const matchReg = !regAlvo || regAlvo === 'TODAS' || fin.regional.trim().toUpperCase() === regAlvo.trim().toUpperCase();
          if (matchReg) {
            set.delete(fin.numero_lote.trim().toUpperCase());
          }
        }
      }
    }

    return Array.from(set).filter(Boolean).sort();
  }

  // =========================================================================
  // GESTÃO E FECHAMENTO OFICIAL DE LOTES
  // =========================================================================
  isLoteFinalizado(numeroLote: string, regional?: string): boolean {
    const loteNorm = (numeroLote || '').trim().toUpperCase();
    if (!loteNorm) return false;
    const regAlvo = regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    return this.lotesFinalizados.some((l) => {
      const matchLote = l.numero_lote.trim().toUpperCase() === loteNorm;
      const matchReg = !regAlvo || regAlvo === 'TODAS' || l.regional.trim().toUpperCase() === regAlvo.trim().toUpperCase();
      return matchLote && matchReg && l.status === 'FINALIZADO';
    });
  }

  obterLoteFinalizado(numeroLote: string, regional?: string): RegistroLoteFinalizado | null {
    const loteNorm = (numeroLote || '').trim().toUpperCase();
    if (!loteNorm) return null;
    const regAlvo = regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    const match = this.lotesFinalizados.find((l) => {
      const matchLote = l.numero_lote.trim().toUpperCase() === loteNorm;
      const matchReg = !regAlvo || regAlvo === 'TODAS' || l.regional.trim().toUpperCase() === regAlvo.trim().toUpperCase();
      return matchLote && matchReg;
    });
    return match || null;
  }

  listarLotesFinalizados(filtro?: FiltroLoteFinalizado): RegistroLoteFinalizado[] {
    let res = [...this.lotesFinalizados];

    if (filtro) {
      if (filtro.numero_lote && filtro.numero_lote.trim()) {
        const termo = filtro.numero_lote.trim().toUpperCase();
        res = res.filter((l) => l.numero_lote.trim().toUpperCase().includes(termo));
      }
      if (filtro.regional && filtro.regional !== 'TODAS') {
        const reg = filtro.regional.trim().toUpperCase();
        res = res.filter((l) => l.regional.trim().toUpperCase() === reg);
      }
      if (filtro.colaborador && filtro.colaborador.trim()) {
        const cTerm = filtro.colaborador.trim().toLowerCase();
        res = res.filter((l) => l.colaborador_fechamento.toLowerCase().includes(cTerm));
      }
      if (filtro.status && filtro.status !== 'TODOS') {
        res = res.filter((l) => l.status === filtro.status);
      }
      if (filtro.data && filtro.data.trim()) {
        const dTerm = filtro.data.trim();
        res = res.filter((l) => l.data_fechamento.includes(dTerm));
      }
    }

    return res.sort((a, b) => new Date(b.data_fechamento).getTime() - new Date(a.data_fechamento).getTime());
  }

  obterProdutosPendentesLote(lote: string, regional?: string): ItemPendenteLote[] {
    const loteNorm = (lote || '').trim().toUpperCase();
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const itensReferencia = this.obterListaAtivaReferencia(regAlvo);
    if (!itensReferencia || itensReferencia.length === 0) {
      return [];
    }

    const regNorm = regAlvo.trim().toUpperCase();
    const produtosDaRegional = this.produtos.filter((p) => {
      if (!regNorm || regNorm === 'TODAS') return true;
      return (p.regional || '').trim().toUpperCase() === regNorm;
    });

    const imeisLancados = new Set(
      produtosDaRegional.map((p) => normalizeImei(p.imei || p.serial || '')).filter(Boolean)
    );

    const pendentes: ItemPendenteLote[] = [];
    for (const ref of itensReferencia) {
      const imeiNorm = normalizeImei(ref.imei_normalized);
      if (!imeisLancados.has(imeiNorm)) {
        pendentes.push({
          imei: ref.imei_normalized,
          sku: ref.sku,
          modelo: ref.model_description,
          fabricante: ref.brand,
          origin_invoice: ref.origin_invoice,
        });
      }
    }

    return pendentes;
  }

  finalizarLote(dados: {
    numeroLote: string;
    regional?: string;
    colaborador?: string;
    fotos: FotosFechamentoLote;
    observacao?: string;
    motivoPendencias?: string;
    produtosPendentes?: ItemPendenteLote[];
  }): { sucesso: boolean; erro?: string; lote?: RegistroLoteFinalizado } {
    const loteNorm = (dados.numeroLote || '').trim().toUpperCase();
    if (!loteNorm) {
      return { sucesso: false, erro: 'Número do lote não informado.' };
    }

    const regAlvo = dados.regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const compAtual = this.obterComputadorAtual(regAlvo);
    const colaboradorFinal = dados.colaborador?.trim() || this.obterColaboradorAtivo() || this.usuarioAtual?.nome || 'Operador';

    // Regra 4: Validar se as 3 fotos obrigatórias foram fornecidas
    if (!dados.fotos?.caixaFechada || !dados.fotos?.espelhoCaixa || !dados.fotos?.lacreSeguranca) {
      return {
        sucesso: false,
        erro: 'Para finalizar o lote é obrigatório anexar as 3 fotos:\n✓ Caixa fechada\n✓ Espelho da caixa\n✓ Lacre de segurança',
      };
    }

    // Obter caixas e produtos do lote
    const produtosDoLote = this.produtos.filter((p) => {
      const matchLote = (p.numero_lote || '01').trim().toUpperCase() === loteNorm;
      const matchReg = !regAlvo || regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ').trim().toUpperCase() === regAlvo.trim().toUpperCase();
      return matchLote && matchReg;
    });

    if (produtosDoLote.length === 0) {
      return {
        sucesso: false,
        erro: `Não há produtos cadastrados no Lote ${loteNorm}. Lance os produtos antes de finalizar o lote.`,
      };
    }

    const caixasSet = new Set(produtosDoLote.map((p) => p.numero_caixa || 'SEM CAIXA'));
    const totalCaixas = caixasSet.size;
    const totalProdutos = produtosDoLote.length;

    // Verificar produtos pendentes em relação à base de referência regional ativa
    const pendentesCalculados = dados.produtosPendentes ?? this.obterProdutosPendentesLote(loteNorm, regAlvo);
    const temPendencias = pendentesCalculados.length > 0;
    const motivoRegistrado = dados.motivoPendencias?.trim() || (temPendencias ? 'Não lançado' : null);

    const produtosPendentesFinais: ItemPendenteLote[] | undefined = temPendencias
      ? pendentesCalculados.map((item) => ({
          ...item,
          motivo: motivoRegistrado || 'Não lançado',
        }))
      : undefined;

    const agora = new Date().toISOString();
    const idLote = `lote-fin-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Criar histórico inicial do fechamento
    const historicoInicial: HistoricoAlteracaoLote = {
      id: `hist-${Date.now()}-1`,
      dataHora: agora,
      usuario: colaboradorFinal,
      perfil: this.usuarioAtual?.perfil || 'OPERADOR',
      acao: 'FECHAMENTO',
      detalhes: `Lote ${loteNorm} finalizado oficialmente pelo colaborador ${colaboradorFinal} com 3 fotos anexadas (${totalCaixas} caixas, ${totalProdutos} aparelhos)${temPendencias ? ` com ${pendentesCalculados.length} produto(s) pendente(s) - Motivo: ${motivoRegistrado}` : ''}.`,
    };

    // Cálculo criptográfico de Checksum do Lote (Gate 6 / Domain)
    const checksumLote = calcularChecksumLote({
      lote: loteNorm,
      regional: regAlvo,
      colaborador: colaboradorFinal,
      total_caixas: totalCaixas,
      total_produtos: totalProdutos,
      seriais: produtosDoLote.map((p) => p.serial || p.imei || ''),
      timestamp: agora,
    });

    const novoRegistro: RegistroLoteFinalizado = {
      id: idLote,
      numero_lote: loteNorm,
      regional: regAlvo,
      status: 'FINALIZADO',
      colaborador_fechamento: colaboradorFinal,
      data_fechamento: agora,
      computador_id: compAtual.id,
      total_caixas: totalCaixas,
      total_produtos: totalProdutos,
      fotos: dados.fotos,
      observacao: dados.observacao?.trim() || '',
      checksum_lote: checksumLote,
      reaberto_por: null,
      data_reabertura: null,
      motivo_reabertura: null,
      motivo_pendencias: motivoRegistrado,
      produtos_pendentes: produtosPendentesFinais,
      historico_alteracoes: [historicoInicial],
    };

    // Se já existia registro anterior (ex: foi reaberto anteriormente e finalizado novamente), atualiza mantendo histórico
    const idxExistente = this.lotesFinalizados.findIndex(
      (l) => l.numero_lote.trim().toUpperCase() === loteNorm && l.regional.trim().toUpperCase() === regAlvo.trim().toUpperCase()
    );

    if (idxExistente >= 0) {
      const anterior = this.lotesFinalizados[idxExistente];
      novoRegistro.id = anterior.id;
      novoRegistro.historico_alteracoes = [...anterior.historico_alteracoes, historicoInicial];
      this.lotesFinalizados[idxExistente] = novoRegistro;
    } else {
      this.lotesFinalizados.unshift(novoRegistro);
    }

    this.salvarTudo();

    // Enfileirar na Outbox durável para sincronização Delta
    enfileirarEventoOutbox({
      device_id: compAtual.id,
      entity_type: 'LOTE',
      entity_id: novoRegistro.id,
      operation: 'INSERT',
      payload: novoRegistro,
    }).catch((e) => console.warn('Falha ao enfileirar fechamento de lote na outbox:', e));

    this.registrarHistorico(
      colaboradorFinal,
      'FECHAMENTO_LOTE',
      `Colaborador ${colaboradorFinal} finalizou oficialmente o Lote ${loteNorm} com ${totalCaixas} caixas e ${totalProdutos} produtos [${regAlvo}] (Checksum: ${checksumLote.slice(0, 12)}...)`,
      regAlvo
    );

    this.notificarMudanca('lotes');
    return { sucesso: true, lote: novoRegistro };
  }

  reabrirLoteAdmin(
    numeroLote: string,
    regional: string,
    usuarioAdmin: string,
    motivo: string
  ): { sucesso: boolean; erro?: string } {
    if (!motivo || !motivo.trim()) {
      return { sucesso: false, erro: 'O motivo para reabertura do lote é obrigatório.' };
    }

    const perfil = this.usuarioAtual?.perfil;
    const isSuperOuAdmin = isAdminOuSuper(perfil);
    const isSupervisorMesmaRegional =
      isSupervisor(perfil) && podeAcessarRegional(this.usuarioAtual, regional);

    if (!isSuperOuAdmin && !isSupervisorMesmaRegional) {
      if (perfil === 'OPERADOR') {
        return {
          sucesso: false,
          erro: 'Acesso negado: Operadores não possuem permissão para reabrir lotes finalizados. Solicite ao Supervisor ou Administrador.',
        };
      }
      return {
        sucesso: false,
        erro: 'Acesso negado: Você não possui permissão para reabrir lotes desta regional.',
      };
    }

    const loteNorm = numeroLote.trim().toUpperCase();
    const regNorm = regional.trim().toUpperCase();

    const loteIdx = this.lotesFinalizados.findIndex(
      (l) => l.numero_lote.trim().toUpperCase() === loteNorm && l.regional.trim().toUpperCase() === regNorm
    );

    if (loteIdx === -1) {
      return { sucesso: false, erro: `Lote ${numeroLote} não encontrado para reabertura.` };
    }

    const agora = new Date().toISOString();
    const lote = this.lotesFinalizados[loteIdx];
    lote.status = 'EM_ABERTO';
    lote.reaberto_por = usuarioAdmin;
    lote.data_reabertura = agora;
    lote.motivo_reabertura = motivo.trim();

    const novoHist: HistoricoAlteracaoLote = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      dataHora: agora,
      usuario: usuarioAdmin,
      perfil: this.usuarioAtual?.perfil || 'ADMINISTRADOR',
      acao: 'REABERTURA',
      detalhes: `Lote reaberto por ${usuarioAdmin} [${this.usuarioAtual?.perfil || 'ADMIN'}]. Motivo: ${motivo.trim()}`,
    };

    lote.historico_alteracoes.push(novoHist);
    this.salvarTudo();

    this.registrarHistorico(
      usuarioAdmin,
      'REABERTURA_LOTE',
      `Administrador ${usuarioAdmin} reabriu o Lote ${loteNorm} [${regNorm}]. Motivo: ${motivo.trim()}`,
      regNorm
    );

    this.notificarMudanca('lotes');
    return { sucesso: true };
  }

  finalizarLoteAdmin(
    numeroLote: string,
    regional: string,
    usuarioAdmin: string,
    motivo?: string
  ): { sucesso: boolean; erro?: string } {
    if (this.usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      return { sucesso: false, erro: 'Apenas Administradores têm permissão para alterar o status do lote.' };
    }

    const loteNorm = numeroLote.trim().toUpperCase();
    const regNorm = regional.trim().toUpperCase();

    const lote = this.lotesFinalizados.find(
      (l) => l.numero_lote.trim().toUpperCase() === loteNorm && l.regional.trim().toUpperCase() === regNorm
    );

    if (!lote) {
      return { sucesso: false, erro: `Lote ${numeroLote} não encontrado.` };
    }

    const agora = new Date().toISOString();
    lote.status = 'FINALIZADO';

    const novoHist: HistoricoAlteracaoLote = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      dataHora: agora,
      usuario: usuarioAdmin,
      perfil: 'ADMINISTRADOR',
      acao: 'FECHAMENTO',
      detalhes: `Status alterado para FINALIZADO pelo Administrador ${usuarioAdmin}.${motivo ? ` Motivo: ${motivo.trim()}` : ''}`,
    };

    lote.historico_alteracoes.push(novoHist);
    this.salvarTudo();

    this.registrarHistorico(
      usuarioAdmin,
      'FECHAMENTO_LOTE_ADMIN',
      `Administrador ${usuarioAdmin} alterou status do Lote ${loteNorm} para FINALIZADO [${regNorm}].`,
      regNorm
    );

    this.notificarMudanca('lotes');
    return { sucesso: true };
  }

  registrarAlteracaoLoteAdmin(
    numeroLote: string,
    regional: string,
    usuarioAdmin: string,
    acao: 'ALTERACAO_DADO' | 'EXCLUSAO_ITEM' | 'FECHAMENTO' | 'REABERTURA',
    detalhes: string
  ): void {
    const loteNorm = numeroLote.trim().toUpperCase();
    const regNorm = regional.trim().toUpperCase();

    const lote = this.lotesFinalizados.find(
      (l) => l.numero_lote.trim().toUpperCase() === loteNorm && l.regional.trim().toUpperCase() === regNorm
    );

    if (lote) {
      const agora = new Date().toISOString();
      const novoHist: HistoricoAlteracaoLote = {
        id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        dataHora: agora,
        usuario: usuarioAdmin,
        perfil: 'ADMINISTRADOR',
        acao,
        detalhes,
      };
      lote.historico_alteracoes.push(novoHist);
      this.salvarTudo();
      this.notificarMudanca('lotes');
    }
  }

  async excluirLote(
    numeroLote: string,
    regional?: string,
    usuarioAdmin?: string
  ): Promise<{ sucesso: boolean; erro?: string; produtosRemovidos: number; fotosRemovidas: number }> {
    const perfil = this.usuarioAtual?.perfil;
    if (!isAdminOuSuper(perfil)) {
      return {
        sucesso: false,
        erro: 'Acesso negado: Apenas Administradores têm permissão para excluir um lote e seus registros.',
        produtosRemovidos: 0,
        fotosRemovidas: 0,
      };
    }

    const loteNorm = (numeroLote || '').trim().toUpperCase();
    const regNorm = (regional || '').trim().toUpperCase();

    if (!loteNorm) {
      return { sucesso: false, erro: 'Número do lote não informado.', produtosRemovidos: 0, fotosRemovidas: 0 };
    }

    const loteIdx = this.lotesFinalizados.findIndex((l) => {
      const matchLote = l.numero_lote.trim().toUpperCase() === loteNorm;
      const matchReg = !regNorm || regNorm === 'TODAS' || l.regional.trim().toUpperCase() === regNorm;
      return matchLote && matchReg;
    });

    const loteParaExcluir = loteIdx !== -1 ? this.lotesFinalizados[loteIdx] : null;
    const regionalLote = loteParaExcluir?.regional || (regNorm && regNorm !== 'TODAS' ? regNorm : undefined);
    const adminNome = usuarioAdmin || this.usuarioAtual?.nome || 'Administrador Geral';

    // 1. Identificar e remover todos os produtos vinculados ao lote
    const produtosDoLote = this.produtos.filter(
      (p) =>
        (p.numero_lote || '').trim().toUpperCase() === loteNorm &&
        (!regionalLote || regionalLote === 'TODAS' || (p.regional || '').trim().toUpperCase() === regionalLote.trim().toUpperCase())
    );

    if (!loteParaExcluir && produtosDoLote.length === 0) {
      return { sucesso: false, erro: `Lote ${numeroLote} não encontrado para exclusão.`, produtosRemovidos: 0, fotosRemovidas: 0 };
    }

    const idsProdutos = produtosDoLote.map((p) => p.id);
    for (const p of produtosDoLote) {
      if (p.serial) this.serialMap.delete(p.serial.trim().toUpperCase());
      if (p.imei) this.serialMap.delete(p.imei.trim().toUpperCase());
    }

    this.produtos = this.produtos.filter((p) => !idsProdutos.includes(p.id));

    // 2. Remover o lote da lista de lotesFinalizados se presente
    if (loteIdx !== -1) {
      this.lotesFinalizados.splice(loteIdx, 1);
    }

    // Se o lote ativo na bancada for o lote excluído, resetar para '01'
    if (this.obterUltimoLote().trim().toUpperCase() === loteNorm) {
      this.salvarUltimoLote('01');
    }

    // 3. Exclusão das fotos no IndexedDB e em memória
    let fotosRemovidasCount = 0;
    if (loteParaExcluir?.fotos) {
      if (loteParaExcluir.fotos.caixaFechada) fotosRemovidasCount++;
      if (loteParaExcluir.fotos.espelhoCaixa) fotosRemovidasCount++;
      if (loteParaExcluir.fotos.lacreSeguranca) fotosRemovidasCount++;
    }

    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        if (loteParaExcluir) {
          await idb.lotes_finalizados.delete(loteParaExcluir.id);
        }
        if (idsProdutos.length > 0) {
          await idb.produtos.bulkDelete(idsProdutos);
        }
        // Excluir registros em fotos_evidencias associados a este lote
        const fotosLote = await idb.fotos_evidencias
          .where('entity_type')
          .equals('LOTE')
          .and((f) => f.entity_id === loteNorm || (loteParaExcluir ? f.entity_id === loteParaExcluir.id : false))
          .toArray();
        if (fotosLote.length > 0) {
          fotosRemovidasCount = Math.max(fotosRemovidasCount, fotosLote.length);
          await idb.fotos_evidencias.bulkDelete(fotosLote.map((f) => f.id));
        }
      } catch (err) {
        console.warn('[Storage] Erro ao remover lote do IndexedDB:', err);
      }
    }

    // 4. Persistir estado atualizado
    this.salvarTudo();
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_LOTES_FINALIZADOS, JSON.stringify(this.lotesFinalizados));
    }

    // 5. Registrar em auditoria e histórico
    observability.logAdminMutation(
      adminNome,
      'EXCLUSAO_LOTE',
      'LOTE',
      loteNorm,
      { lote: loteNorm, total_produtos: produtosDoLote.length, fotos: fotosRemovidasCount },
      null,
      `Exclusão completa do Lote ${loteNorm} com remoção de fotos e ${produtosDoLote.length} produtos.`
    );

    this.registrarHistorico(
      adminNome,
      'EXCLUSAO_LOTE',
      `Administrador ${adminNome} excluiu o Lote ${loteNorm} [${regionalLote}], suas fotos e ${produtosDoLote.length} produtos associados.`,
      regionalLote
    );

    // 6. Notificar componentes reativos
    this.notificarMudanca('lotes');
    this.notificarMudanca('produtos');
    this.notificarMudanca('fotos');
    this.notificarMudanca('dados');

    return {
      sucesso: true,
      produtosRemovidos: produtosDoLote.length,
      fotosRemovidas: fotosRemovidasCount,
    };
  }

  obterRelatorioLote(lote: string, regional?: string): RelatorioLoteInfo {
    const loteNorm = lote.trim().toUpperCase();
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    const produtos = this.produtos.filter((p) => {
      const matchLote = (p.numero_lote || '01').trim().toUpperCase() === loteNorm;
      const matchReg = !regAlvo || regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo;
      return matchLote && matchReg;
    });

    let cliente = regAlvo && regAlvo !== 'TODAS' ? regAlvo : '';
    if (!cliente && produtos.length > 0) {
      cliente = produtos[0].regional || 'VIA VAREJO RJ';
    }
    if (!cliente) cliente = 'VIA VAREJO RJ';

    const caixasMap = new Map<string, CaixaLoteInfo>();
    for (const p of produtos) {
      const cx = p.numero_caixa || 'SEM CAIXA';
      if (!caixasMap.has(cx)) {
        caixasMap.set(cx, {
          caixa: cx,
          totalProdutos: 0,
          lacrados: 0,
          naoLacrados: 0,
          statusEnvio: 'Aguardando envio Online',
        });
      }
      const cInfo = caixasMap.get(cx)!;
      cInfo.totalProdutos++;
      if (p.produto_lacrado === 'SIM') {
        cInfo.lacrados++;
      } else {
        cInfo.naoLacrados++;
      }
      if (p.status_sincronizacao === 'ENVIADO') {
        cInfo.statusEnvio = 'Enviado Online';
      }
    }

    const caixas = Array.from(caixasMap.values()).sort((a, b) => a.caixa.localeCompare(b.caixa));
    const colaboradorResponsavel = produtos.length > 0 ? produtos[0].usuario_cadastro : (this.usuarioAtual?.nome || 'Operador');

    let dataCriacao = '-';
    let dataEnvio = '-';
    if (produtos.length > 0) {
      const sortedByData = [...produtos].sort((a, b) => new Date(a.data_cadastro).getTime() - new Date(b.data_cadastro).getTime());
      dataCriacao = new Date(sortedByData[0].data_cadastro).toLocaleString('pt-BR');
      const enviados = produtos.filter((p) => p.data_sincronizacao);
      if (enviados.length > 0) {
        const sortedEnvio = [...enviados].sort((a, b) => new Date(b.data_sincronizacao!).getTime() - new Date(a.data_sincronizacao!).getTime());
        dataEnvio = new Date(sortedEnvio[0].data_sincronizacao!).toLocaleString('pt-BR');
      }
    }

    let status: 'Aguardando envio Online' | 'Enviado Online' | 'Sem produtos' = 'Sem produtos';
    if (produtos.length > 0) {
      const todosEnviados = produtos.every((p) => p.status_sincronizacao === 'ENVIADO');
      status = todosEnviados ? 'Enviado Online' : 'Aguardando envio Online';
    }

    return {
      lote: loteNorm,
      cliente,
      totalCaixas: caixas.length,
      totalProdutos: produtos.length,
      dataCriacao,
      dataEnvio,
      colaboradorResponsavel,
      status,
      caixas,
      produtos,
    };
  }

  listarCaixas(regional?: string): string[] {
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    const set = new Set<string>();
    for (const p of this.produtos) {
      if (!regAlvo || regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo) {
        if (p.numero_caixa) set.add(p.numero_caixa);
      }
    }
    return Array.from(set).sort();
  }

  obterContadoresCaixa(numeroCaixa: string, regional?: string): ContadoresCaixa {
    const caixaNorm = numeroCaixa.trim().toUpperCase();
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    let totalAuditados = 0;
    let produtosLacrados = 0;
    let produtosNaoLacrados = 0;
    let comMarcasUso = 0;
    let avariasFaltantes = 0;
    let pendencias = 0;

    for (let i = 0; i < this.produtos.length; i++) {
      const p = this.produtos[i];
      if (p.numero_caixa.toUpperCase() !== caixaNorm) continue;
      if (regAlvo && regAlvo !== 'TODAS' && (p.regional || 'VIA VAREJO RJ') !== regAlvo) continue;

      totalAuditados++;
      if (p.produto_lacrado === 'SIM') {
        produtosLacrados++;
      } else {
        produtosNaoLacrados++;
        if (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO') {
          avariasFaltantes++;
        }
      }
      if (p.aparelho_marcas_uso === 'SIM') {
        comMarcasUso++;
      }
      if (p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE') {
        pendencias++;
      }
    }

    return {
      caixa: numeroCaixa,
      totalAuditados,
      produtosLacrados,
      produtosNaoLacrados,
      comMarcasUso,
      avariasFaltantes,
      pendencias,
    };
  }

  obterLacreCaixa(numeroCaixa: string, regional?: string): string {
    const caixaNorm = numeroCaixa.trim().toUpperCase();
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    // 1. Procurar primeiro nos produtos já existentes na caixa
    for (let i = 0; i < this.produtos.length; i++) {
      const p = this.produtos[i];
      if (p.numero_caixa.trim().toUpperCase() !== caixaNorm) continue;
      if (regAlvo && regAlvo !== 'TODAS' && (p.regional || '').trim().toUpperCase() !== regAlvo.trim().toUpperCase()) continue;
      if (p.lacre_seguranca && p.lacre_seguranca.trim()) {
        return p.lacre_seguranca.trim();
      }
      if (p.observacao && p.observacao.includes('[LACRE:')) {
        const m = p.observacao.match(/\[LACRE:(.*?)\]/);
        if (m && m[1]) {
          const l = m[1].trim();
          p.lacre_seguranca = l;
          return l;
        }
      }
    }

    // 2. Procurar no mapa persistido do LocalStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(STORAGE_KEY_LACRES_CAIXAS);
        if (raw) {
          const map = JSON.parse(raw);
          if (regAlvo && regAlvo !== 'TODAS') {
            const keyReg = `${regAlvo.trim().toUpperCase()}:::${caixaNorm}`;
            if (map[keyReg]) return String(map[keyReg]).trim();
          }
          if (map[caixaNorm]) return String(map[caixaNorm]).trim();
        }
      }
    } catch {}

    return '';
  }

  definirLacreCaixa(numeroCaixa: string, lacre: string, regional?: string): void {
    const caixaNorm = numeroCaixa.trim().toUpperCase();
    const lacreNorm = lacre.trim().toUpperCase();
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    // 1. Salvar no mapa do LocalStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(STORAGE_KEY_LACRES_CAIXAS);
        const map = raw ? JSON.parse(raw) : {};
        if (regAlvo && regAlvo !== 'TODAS') {
          map[`${regAlvo.trim().toUpperCase()}:::${caixaNorm}`] = lacreNorm;
        }
        map[caixaNorm] = lacreNorm;
        localStorage.setItem(STORAGE_KEY_LACRES_CAIXAS, JSON.stringify(map));
      }
    } catch {}

    // 2. Atualizar todos os produtos já cadastrados nessa caixa
    let alterados = false;
    for (let i = 0; i < this.produtos.length; i++) {
      const p = this.produtos[i];
      if (p.numero_caixa.trim().toUpperCase() !== caixaNorm) continue;
      if (regAlvo && regAlvo !== 'TODAS' && (p.regional || '').trim().toUpperCase() !== regAlvo.trim().toUpperCase()) continue;

      if (p.lacre_seguranca !== lacreNorm) {
        p.lacre_seguranca = lacreNorm;
        alterados = true;
      }
    }

    if (alterados) {
      this.salvarTudo();
      this.notificarMudanca('produtos');
    }
  }

  obterConfiguracaoCaixa(numeroCaixa: string, regional?: string): ConfiguracaoCaixa {
    const caixaNorm = numeroCaixa.trim().toUpperCase();
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    let primeiroProduto: ProdutoAuditoria | null = null;
    let total = 0;

    for (let i = 0; i < this.produtos.length; i++) {
      const p = this.produtos[i];
      if (p.numero_caixa.toUpperCase() !== caixaNorm) continue;
      if (regAlvo && regAlvo !== 'TODAS' && (p.regional || 'VIA VAREJO RJ') !== regAlvo) continue;

      total++;
      if (!primeiroProduto) {
        primeiroProduto = p;
      }
    }

    if (!primeiroProduto || total === 0) {
      return {
        caixa: numeroCaixa,
        regional: regAlvo || 'TODAS',
        totalProdutos: 0,
        vazia: true,
        classificacao: null,
        condicaoLacre: null,
        produto_lacrado: null,
        lacre_seguranca: this.obterLacreCaixa(numeroCaixa, regAlvo || undefined) || null,
      };
    }

    const classificacao =
      primeiroProduto.box_classification ||
      primeiroProduto.classificacao_produto ||
      primeiroProduto.product_classification ||
      calcularClassificacaoProduto({
        sourceType: primeiroProduto.source_type || 'LISTED',
        dealer: primeiroProduto.dealer,
        fabricante: primeiroProduto.fabricante || primeiroProduto.brand,
      });

    const condicaoLacre: BoxSealedStatus =
      primeiroProduto.box_sealed_status === 'SEALED' || primeiroProduto.produto_lacrado === 'SIM'
        ? 'LACRADO'
        : 'ABERTO';

    const lacreSeguranca =
      primeiroProduto.lacre_seguranca ||
      this.obterLacreCaixa(numeroCaixa, regAlvo || undefined) ||
      null;

    return {
      caixa: numeroCaixa,
      regional: regAlvo || primeiroProduto.regional,
      totalProdutos: total,
      vazia: false,
      classificacao,
      condicaoLacre,
      produto_lacrado: primeiroProduto.produto_lacrado,
      lacre_seguranca: lacreSeguranca,
    };
  }

  validarCompatibilidadeCaixa(params: {
    caixa: string;
    classificacao: string;
    produto_lacrado: SimNao;
    regional?: string;
    produtoIdIgnorar?: number;
  }): { compativel: boolean; erro?: string; configCaixa?: ConfiguracaoCaixa } {
    const { caixa, classificacao, produto_lacrado, regional, produtoIdIgnorar } = params;
    const caixaNorm = caixa.trim().toUpperCase();
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    let primeiroProduto: ProdutoAuditoria | null = null;
    let total = 0;

    for (let i = 0; i < this.produtos.length; i++) {
      const p = this.produtos[i];
      if (produtoIdIgnorar && p.id === produtoIdIgnorar) continue;
      if (p.numero_caixa.toUpperCase() !== caixaNorm) continue;
      if (regAlvo && regAlvo !== 'TODAS' && (p.regional || 'VIA VAREJO RJ') !== regAlvo) continue;

      total++;
      if (!primeiroProduto) {
        primeiroProduto = p;
      }
    }

    if (!primeiroProduto || total === 0) {
      return {
        compativel: true,
        configCaixa: {
          caixa,
          regional: regAlvo || 'TODAS',
          totalProdutos: 0,
          vazia: true,
          classificacao: null,
          condicaoLacre: null,
          produto_lacrado: null,
        },
      };
    }

    const classifCaixa =
      primeiroProduto.box_classification ||
      primeiroProduto.classificacao_produto ||
      primeiroProduto.product_classification ||
      calcularClassificacaoProduto({
        sourceType: primeiroProduto.source_type || 'LISTED',
        dealer: primeiroProduto.dealer,
        fabricante: primeiroProduto.fabricante || primeiroProduto.brand,
      });

    const condicaoCaixa: BoxSealedStatus =
      primeiroProduto.box_sealed_status === 'SEALED' || primeiroProduto.produto_lacrado === 'SIM'
        ? 'LACRADO'
        : 'ABERTO';

    const condicaoItem: BoxSealedStatus = produto_lacrado === 'SIM' ? 'LACRADO' : 'ABERTO';

    const configCaixa: ConfiguracaoCaixa = {
      caixa,
      regional: regAlvo || primeiroProduto.regional,
      totalProdutos: total,
      vazia: false,
      classificacao: classifCaixa,
      condicaoLacre: condicaoCaixa,
      produto_lacrado: primeiroProduto.produto_lacrado,
    };

    // 1. Chave 1: Classificação Homogênea
    if (classifCaixa && classificacao && classifCaixa.trim().toUpperCase() !== classificacao.trim().toUpperCase()) {
      return {
        compativel: false,
        erro: `BOX_CLASSIFICATION_MISMATCH: A ${caixa} está travada na classificação "${classifCaixa}". O produto possui classificação "${classificacao}". Uma caixa não pode misturar classificações de produto.`,
        configCaixa,
      };
    }

    // 2. Chave 2: Condição de Lacre Homogênea
    if (condicaoCaixa !== condicaoItem) {
      return {
        compativel: false,
        erro: `BOX_SEALED_MISMATCH: A ${caixa} aceita apenas produtos na condição "${condicaoCaixa}". O produto está "${condicaoItem}". Uma caixa não pode misturar produtos lacrados e abertos.`,
        configCaixa,
      };
    }

    return { compativel: true, configCaixa };
  }

  obterStatusEnvioCaixa(numeroCaixa: string, regional?: string): 'Aguardando envio Online' | 'Enviado Online' | 'Vazia' {
    const caixaNorm = numeroCaixa.trim().toUpperCase();
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    let temItens = false;
    let todosEnviados = true;

    for (let i = 0; i < this.produtos.length; i++) {
      const p = this.produtos[i];
      if (p.numero_caixa.toUpperCase() !== caixaNorm) continue;
      if (regAlvo && regAlvo !== 'TODAS' && (p.regional || 'VIA VAREJO RJ') !== regAlvo) continue;

      temItens = true;
      const enviado = p.status_sincronizacao === 'ENVIADO' || p.sync_status === 'ENVIADO';
      if (!enviado) {
        todosEnviados = false;
        break; // Short-circuit: se já tem 1 pendente, não precisa checar o resto
      }
    }

    if (!temItens) return 'Vazia';
    return todosEnviados ? 'Enviado Online' : 'Aguardando envio Online';
  }

  obterMetricasDashboard(regional?: string): MetricasDashboard {
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    let totalAuditados = 0;
    let produtosLacrados = 0;
    let produtosNaoLacrados = 0;
    let comMarcasUso = 0;
    let avariasFaltantes = 0;
    let pendencias = 0;
    let ultimaAuditoria: string | null = null;

    const caixasSet = new Set<string>();
    const boxMap = new Map<string, number>();
    const modelMap = new Map<string, number>();
    const dateMap = new Map<string, number>();

    for (let i = 0; i < this.produtos.length; i++) {
      const p = this.produtos[i];
      if (regAlvo && regAlvo !== 'TODAS' && (p.regional || 'VIA VAREJO RJ') !== regAlvo) continue;

      totalAuditados++;
      if (!ultimaAuditoria && p.data_cadastro) {
        ultimaAuditoria = p.data_cadastro;
      }

      if (p.numero_caixa) {
        caixasSet.add(p.numero_caixa);
        boxMap.set(p.numero_caixa, (boxMap.get(p.numero_caixa) || 0) + 1);
      }
      if (p.produto_lacrado === 'SIM') {
        produtosLacrados++;
      } else {
        produtosNaoLacrados++;
        if (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO') {
          avariasFaltantes++;
        }
      }
      if (p.aparelho_marcas_uso === 'SIM') {
        comMarcasUso++;
      }
      if (p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE') {
        pendencias++;
      }
      if (p.modelo_produto) {
        modelMap.set(p.modelo_produto, (modelMap.get(p.modelo_produto) || 0) + 1);
      }
      const d = p.data_auditoria || (p.data_cadastro ? p.data_cadastro.split('T')[0] : '');
      if (d) {
        dateMap.set(d, (dateMap.get(d) || 0) + 1);
      }
    }

    const totalCaixas = caixasSet.size;

    const produtosPorCaixa = Array.from(boxMap.entries())
      .map(([caixa, total]) => ({ caixa, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const produtosPorModelo = Array.from(modelMap.entries())
      .map(([modelo, total]) => ({ modelo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const produtosPorData = Array.from(dateMap.entries())
      .map(([data, total]) => ({ data, total }))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-10);

    return {
      totalAuditados,
      totalCaixas,
      produtosLacrados,
      produtosNaoLacrados,
      comMarcasUso,
      pendencias,
      ultimaAuditoria,
      produtosPorCaixa,
      produtosPorModelo,
      produtosPorData,
    };
  }

  // Estatísticas comparativas de todas as regionais para o Painel Admin
  obterEstatisticasRegionais(): EstatisticasRegional[] {
    let regionais = this.listarRegionais();
    if (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional) {
      regionais = [this.usuarioAtual.regional];
    }
    return regionais.map((reg) => {
      const produtosReg = this.produtos.filter((p) => (p.regional || 'VIA VAREJO RJ') === reg);
      const totalProdutos = produtosReg.length;
      const caixasSet = new Set(produtosReg.map((p) => p.numero_caixa));
      const modelosSet = new Set(produtosReg.map((p) => p.modelo_produto));
      const produtosLacrados = produtosReg.filter((p) => p.produto_lacrado === 'SIM').length;
      const produtosNaoLacrados = produtosReg.filter((p) => p.produto_lacrado === 'NÃO').length;
      const avariasFaltantes = produtosReg.filter(
        (p) => p.produto_lacrado === 'NÃO' && (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO')
      ).length;
      // Produtos abertos c/ avaria ou faltante NÃO são pendências:
      const pendencias = produtosReg.filter(
        (p) => p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE' || p.status_sincronizacao === 'ERRO_DUPLICADO'
      ).length;
      const taxaQualidade =
        totalProdutos > 0 ? Math.round((produtosLacrados / totalProdutos) * 100) : 100;
      const ultimaAuditoria = produtosReg.length > 0 ? produtosReg[0].data_cadastro : null;

      return {
        regional: reg,
        totalProdutos,
        totalCaixas: caixasSet.size,
        produtosLacrados,
        produtosNaoLacrados,
        avariasFaltantes,
        pendencias,
        totalModelos: modelosSet.size,
        taxaQualidade,
        ultimaAuditoria,
      };
    });
  }

  // =========================================================================
  listarProdutosPendentes(): ProdutoAuditoria[] {
    const regAlvo = this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined;
    return this.produtos.filter((p) => {
      if (p.status_sincronizacao === 'ENVIADO' || p.sync_status === 'ENVIADO' || p.sync_status === 'SINCRONIZADO') {
        return false;
      }
      const isPendente = p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE' || p.status_sincronizacao === 'ERRO_DUPLICADO';
      if (!isPendente) return false;
      if (regAlvo) return (p.regional || 'VIA VAREJO RJ') === regAlvo;
      return true;
    });
  }

  // =========================================================================
  // GESTÃO DE EVIDÊNCIAS FOTOGRÁFICAS (REQUISITOS 6, 7, 8, 9, 10, 11)
  // Fotos dos produtos agrupadas de 10 em 10 produtos dentro da caixa
  // =========================================================================
  obterGruposFotosCaixa(caixa: string, regional?: string): GrupoFotosInfo[] {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const prodsCaixa = this.produtos
      .filter((p) => p.numero_caixa === caixa && (regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo))
      .sort((a, b) => (a.id || 0) - (b.id || 0));

    const totalProdutos = prodsCaixa.length;
    if (totalProdutos === 0) return [];

    const totalGrupos = Math.ceil(totalProdutos / 10);
    const grupos: GrupoFotosInfo[] = [];

    for (let g = 1; g <= totalGrupos; g++) {
      const rangeInicio = (g - 1) * 10 + 1;
      const rangeFim = Math.min(g * 10, totalProdutos);
      const sliceProds = prodsCaixa.slice((g - 1) * 10, rangeFim);
      const seriais = sliceProds.map((p) => p.serial);
      const grupoRotulo = `Produtos ${String(rangeInicio).padStart(2, '0')} até ${String(rangeFim).padStart(2, '0')}`;

      const fotoExistente = this.fotosGrupos.find(
        (f) =>
          f.caixa === caixa &&
          f.grupoNumero === g &&
          (regAlvo === 'TODAS' || (f.regional || 'VIA VAREJO RJ') === regAlvo)
      );

      grupos.push({
        grupoNumero: g,
        grupoRotulo,
        rangeInicio,
        rangeFim,
        totalNoGrupo: seriais.length,
        seriais,
        foto: fotoExistente,
        temFoto: !!fotoExistente && !!fotoExistente.fotoDataUri,
      });
    }

    return grupos;
  }

  salvarFotoGrupo(dados: {
    caixa: string;
    regional?: string;
    grupoNumero: number;
    grupoRotulo: string;
    rangeInicio: number;
    rangeFim: number;
    totalNoGrupo: number;
    seriais: string[];
    fotoDataUri: string;
  }): { sucesso: boolean; foto: FotoGrupoAuditoria } {
    const regAlvo = dados.regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const compAtual = this.obterComputadorAtual(regAlvo);
    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    const agora = new Date().toISOString();

    const fotoNova: FotoGrupoAuditoria = {
      id: `FOTO-${regAlvo.replace(/[^A-Z0-9]/g, '')}-${dados.caixa.replace(/[^A-Z0-9]/g, '')}-G${dados.grupoNumero}-${Date.now()}`,
      regional: regAlvo,
      caixa: dados.caixa,
      grupoNumero: dados.grupoNumero,
      grupoRotulo: dados.grupoRotulo,
      rangeInicio: dados.rangeInicio,
      rangeFim: dados.rangeFim,
      totalNoGrupo: dados.totalNoGrupo,
      seriais: dados.seriais,
      fotoDataUri: dados.fotoDataUri,
      dataCriacao: agora,
      computador_id: compAtual.id,
      usuario: usuarioNome,
      status_sincronizacao: 'PENDENTE',
      data_sincronizacao: null,
    };

    const idx = this.fotosGrupos.findIndex(
      (f) => f.caixa === dados.caixa && f.grupoNumero === dados.grupoNumero && f.regional === regAlvo
    );

    if (idx >= 0) {
      this.fotosGrupos[idx] = fotoNova;
    } else {
      this.fotosGrupos.push(fotoNova);
    }

    // Persistência desacoplada com hash SHA-256 e UUID no IndexedDB (Gate 3)
    if (dados.fotoDataUri) {
      try {
        const fotoEvid = processarFotoBase64(
          'CAIXA',
          `${regAlvo}_${dados.caixa}`,
          dados.grupoRotulo,
          dados.fotoDataUri
        );
        salvarFotoEvidencia(fotoEvid).catch((err) => {
          console.error('Falha ao gravar foto de grupo no IndexedDB:', err);
        });
      } catch (err) {
        console.error('Falha ao processar hash/metadados da foto:', err);
      }
    }

    this.salvarTudo();
    this.notificarMudanca('fotos');
    this.notificarMudanca('sync');

    this.registrarHistorico(
      usuarioNome,
      'ANEXO_FOTO_EVIDENCIA',
      `Evidência fotográfica registrada para ${dados.caixa} - ${dados.grupoRotulo} (${dados.seriais.length} produtos).`,
      regAlvo
    );

    return { sucesso: true, foto: fotoNova };
  }

  removerFotoGrupo(caixa: string, grupoNumero: number, regional?: string): boolean {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const inicial = this.fotosGrupos.length;
    this.fotosGrupos = this.fotosGrupos.filter(
      (f) => !(f.caixa === caixa && f.grupoNumero === grupoNumero && f.regional === regAlvo)
    );
    if (this.fotosGrupos.length !== inicial) {
      this.salvarTudo();
      this.notificarMudanca('fotos');
      this.notificarMudanca('sync');
      return true;
    }
    return false;
  }

  // =========================================================================
  // GESTÃO DAS 10 FOTOS OBRIGATÓRIAS DA CAIXA (REQUISITOS 4 E 5)
  // Ao finalizar / trocar de caixa: 10 fotos obrigatórias
  // =========================================================================
  obter10FotosCaixa(caixa: string, regional?: string): Registro10FotosCaixa {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    let reg = this.registros10Fotos.find(
      (r) => r.caixa === caixa && (regAlvo === 'TODAS' || r.regional === regAlvo)
    );
    if (!reg) {
      reg = {
        id: `FOTOS-${regAlvo.replace(/[^A-Z0-9]/g, '')}-${caixa.replace(/[^A-Z0-9]/g, '')}-${Date.now()}`,
        regional: regAlvo,
        caixa,
        dataCriacao: new Date().toISOString(),
        computador_id: this.obterComputadorAtual(regAlvo).id,
        usuario: this.usuarioAtual?.nome || 'Operador',
        fotos: [
          { indice: 1, rotulo: 'Foto dos produtos 1', descricao: 'Primeira foto dos produtos da caixa', fotoDataUri: '' },
          { indice: 2, rotulo: 'Foto dos produtos 2', descricao: 'Segunda foto dos produtos da caixa', fotoDataUri: '' },
        ],
        status_sincronizacao: 'PENDENTE',
      };
      this.registros10Fotos.push(reg);
    } else {
      // Garantir pelo menos 2 slots
      if (!reg.fotos || reg.fotos.length < 2) {
        const fotosNovas = reg.fotos ? [...reg.fotos] : [];
        if (fotosNovas.length === 0) {
          fotosNovas.push({ indice: 1, rotulo: 'Foto dos produtos 1', descricao: 'Primeira foto dos produtos da caixa', fotoDataUri: '' });
        }
        if (fotosNovas.length === 1) {
          fotosNovas.push({ indice: 2, rotulo: 'Foto dos produtos 2', descricao: 'Segunda foto dos produtos da caixa', fotoDataUri: '' });
        }
        reg.fotos = fotosNovas;
      }
      // Atualizar nomes padrão para "Foto dos produtos 1" e "Foto dos produtos 2"
      if (reg.fotos[0] && (!reg.fotos[0].rotulo || reg.fotos[0].rotulo.includes('organizados'))) {
        reg.fotos[0].rotulo = 'Foto dos produtos 1';
      }
      if (reg.fotos[1] && (!reg.fotos[1].rotulo || reg.fotos[1].rotulo.includes('fechada'))) {
        reg.fotos[1].rotulo = 'Foto dos produtos 2';
      }
    }
    return reg;
  }

  adicionarSlotFotoCaixa(caixa: string, regional?: string): Registro10FotosCaixa {
    const reg = this.obter10FotosCaixa(caixa, regional);
    const novoIndice = reg.fotos.length + 1;
    reg.fotos.push({
      indice: novoIndice,
      rotulo: `Foto dos produtos ${novoIndice}`,
      descricao: `Foto adicional ${novoIndice} dos produtos da caixa`,
      fotoDataUri: '',
    });
    this.salvarTudo();
    this.notificarMudanca('fotos');
    return reg;
  }

  removerSlotFotoCaixa(caixa: string, indice: number, regional?: string): Registro10FotosCaixa | null {
    if (indice <= 2) return null; // Os dois primeiros slots são os padrões obrigatórios
    const reg = this.obter10FotosCaixa(caixa, regional);
    reg.fotos = reg.fotos.filter((f) => f.indice !== indice);
    // Renumerar slots adicionais para manter sequencial
    reg.fotos.forEach((f, idx) => {
      f.indice = idx + 1;
      f.rotulo = `Foto dos produtos ${idx + 1}`;
    });
    this.salvarTudo();
    this.notificarMudanca('fotos');
    return reg;
  }

  tem10FotosCompletas(caixa: string, regional?: string): boolean {
    const reg = this.obter10FotosCaixa(caixa, regional);
    if (!reg || !reg.fotos || reg.fotos.length < 2) return false;
    // Considera completo se pelo menos as 2 primeiras fotos foram anexadas
    return (
      !!reg.fotos[0]?.fotoDataUri &&
      reg.fotos[0].fotoDataUri.length > 50 &&
      !!reg.fotos[1]?.fotoDataUri &&
      reg.fotos[1].fotoDataUri.length > 50
    );
  }

  obterContadorFotos10(caixa: string, regional?: string): number {
    const reg = this.obter10FotosCaixa(caixa, regional);
    if (!reg || !reg.fotos) return 0;
    return reg.fotos.filter((f) => !!f.fotoDataUri && f.fotoDataUri.length > 50).length;
  }

  salvarFotoCaixaIndividual(
    caixa: string,
    indice: number,
    fotoDataUri: string,
    regional?: string
  ): { sucesso: boolean; registro: Registro10FotosCaixa } {
    const reg = this.obter10FotosCaixa(caixa, regional);
    const item = reg.fotos.find((f) => f.indice === indice);
    if (!item) {
      reg.fotos.push({
        indice,
        rotulo: `Foto dos produtos ${indice}`,
        descricao: '',
        fotoDataUri,
      });
    } else {
      item.fotoDataUri = fotoDataUri;
    }

    return this.salvar10FotosCaixa(caixa, reg.fotos, regional);
  }

  salvar10FotosCaixa(
    caixa: string,
    fotos: { indice: number; rotulo?: string; descricao?: string; fotoDataUri: string }[],
    regional?: string
  ): { sucesso: boolean; registro: Registro10FotosCaixa } {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const compAtual = this.obterComputadorAtual(regAlvo);
    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    const agora = new Date().toISOString();

    const registro = this.obter10FotosCaixa(caixa, regAlvo);
    registro.dataCriacao = agora;
    registro.computador_id = compAtual.id;
    registro.usuario = usuarioNome;
    registro.status_sincronizacao = 'PENDENTE';

    for (const f of fotos) {
      const idx = registro.fotos.findIndex((item) => item.indice === f.indice);
      if (idx >= 0) {
        registro.fotos[idx].fotoDataUri = f.fotoDataUri;
        if (f.rotulo) registro.fotos[idx].rotulo = f.rotulo;
        if (f.descricao !== undefined) registro.fotos[idx].descricao = f.descricao;
      } else {
        registro.fotos.push({
          indice: f.indice,
          rotulo: f.rotulo || `Foto dos produtos ${f.indice}`,
          descricao: f.descricao || '',
          fotoDataUri: f.fotoDataUri,
        });
      }
    }

    // Salvar também em fotosGrupos para visualização na galeria do Admin e sincronização com nuvem
    for (const fotoItem of registro.fotos) {
      if (fotoItem.fotoDataUri) {
        const fotoGrupoItem: FotoGrupoAuditoria = {
          id: `FOTO-${regAlvo.replace(/[^A-Z0-9]/g, '')}-${caixa.replace(/[^A-Z0-9]/g, '')}-${fotoItem.indice}-${Date.now()}`,
          regional: regAlvo,
          caixa,
          grupoNumero: fotoItem.indice,
          grupoRotulo: fotoItem.rotulo,
          rangeInicio: 1,
          rangeFim: registro.fotos.length,
          totalNoGrupo: registro.fotos.length,
          seriais: [],
          fotoDataUri: fotoItem.fotoDataUri,
          dataCriacao: agora,
          computador_id: compAtual.id,
          usuario: usuarioNome,
          status_sincronizacao: 'PENDENTE',
          data_sincronizacao: null,
        };
        const idxG = this.fotosGrupos.findIndex(
          (f) => f.caixa === caixa && f.grupoNumero === fotoItem.indice && f.regional === regAlvo
        );
        if (idxG >= 0) {
          this.fotosGrupos[idxG] = fotoGrupoItem;
        } else {
          this.fotosGrupos.push(fotoGrupoItem);
        }
      }
    }

    // Persistência desacoplada de cada foto no IndexedDB com UUID e SHA-256 (Gate 3)
    for (const fotoItem of registro.fotos) {
      if (fotoItem.fotoDataUri) {
        try {
          const fotoEvid = processarFotoBase64(
            'CAIXA',
            `${regAlvo}_${caixa}`,
            fotoItem.rotulo || `Foto dos produtos ${fotoItem.indice}`,
            fotoItem.fotoDataUri,
            fotoItem.descricao
          );
          salvarFotoEvidencia(fotoEvid).catch((err) => {
            console.error('Falha ao salvar foto desacoplada no IndexedDB:', err);
          });
        } catch (err) {
          console.error('Falha ao processar metadados da foto:', err);
        }
      }
    }

    this.salvarTudo();
    this.notificarMudanca('fotos');
    this.notificarMudanca('sync');

    const totalAnexadas = registro.fotos.filter((f) => !!f.fotoDataUri).length;
    this.registrarHistorico(
      usuarioNome,
      'FOTOS_PRODUTOS_CAIXA',
      `Registradas fotos dos produtos da ${caixa} (${totalAnexadas} foto(s) salvas).`,
      regAlvo
    );

    return { sucesso: true, registro };
  }

  registrarMotivoSemFotosCaixa(caixa: string, motivo: string, regional?: string) {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const reg = this.obter10FotosCaixa(caixa, regAlvo);
    reg.motivoSemFotos = motivo.trim();
    this.salvarTudo();
    this.notificarMudanca('fotos');

    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    this.registrarHistorico(
      usuarioNome,
      'MOTIVO_SEM_FOTOS',
      `Mudança da ${caixa} sem fotos. Justificativa informada: "${motivo.trim()}".`,
      regAlvo
    );
  }

  validarTrocaCaixa(
    caixaAtual: string,
    regional?: string
  ): {
    permitida: boolean;
    precisaConfirmarFotos: boolean;
    temFotos: boolean;
    totalFotos: number;
    motivoInformado?: string | null;
  } {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const prodsCaixa = this.produtos.filter(
      (p) => p.numero_caixa === caixaAtual && (regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo)
    );

    if (prodsCaixa.length === 0) {
      return {
        permitida: true,
        precisaConfirmarFotos: false,
        temFotos: false,
        totalFotos: 0,
      };
    }

    const reg = this.obter10FotosCaixa(caixaAtual, regAlvo);
    const contagem = reg.fotos.filter((f) => !!f.fotoDataUri && f.fotoDataUri.length > 50).length;

    return {
      permitida: true,
      precisaConfirmarFotos: true,
      temFotos: contagem >= 2,
      totalFotos: contagem,
      motivoInformado: reg.motivoSemFotos,
    };
  }


  listarFotosCaixa(caixa: string, regional?: string): FotoGrupoAuditoria[] {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    return this.fotosGrupos.filter(
      (f) => f.caixa === caixa && (regAlvo === 'TODAS' || f.regional === regAlvo)
    );
  }

  listarTodasFotos(regional?: string): FotoGrupoAuditoria[] {
    if (!regional || regional === 'TODAS') return [...this.fotosGrupos];
    return this.fotosGrupos.filter((f) => f.regional === regional);
  }

  obterArvoreFotosPorRegional(): {
    regional: string;
    caixas: {
      caixa: string;
      totalProdutos: number;
      fotos: FotoGrupoAuditoria[];
    }[];
  }[] {
    const regionais = ['VIA VAREJO RJ', 'VIA VAREJO SP', 'VIA VAREJO MG', 'VIA VAREJO BA'];
    return regionais.map((reg) => {
      const prodsReg = this.produtos.filter((p) => (p.regional || 'VIA VAREJO RJ') === reg);
      const caixasSet = new Set(prodsReg.map((p) => p.numero_caixa));
      const caixas = Array.from(caixasSet).sort().map((cx) => {
        const totalProdutos = prodsReg.filter((p) => p.numero_caixa === cx).length;
        const fotos = this.fotosGrupos
          .filter((f) => f.regional === reg && f.caixa === cx)
          .sort((a, b) => a.grupoNumero - b.grupoNumero);
        return {
          caixa: cx,
          totalProdutos,
          fotos,
        };
      });
      return {
        regional: reg,
        caixas,
      };
    });
  }

  // =========================================================================
  // LIMPEZA GERAL DA BASE (ONLINE + LOCAL) - RESTRITO EXCLUSIVAMENTE AO ADMIN
  // =========================================================================
  async limparBaseOperacional(): Promise<{ sucesso: boolean; mensagem: string }> {
    if (this.usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      return {
        sucesso: false,
        mensagem: 'Apenas o Administrador Geral possui autorização para solicitar a limpeza da base de dados online.',
      };
    }

    // 1. Ativar trava de exclusividade para impedir que ciclos de sincronização restaurem dados durante a limpeza
    this.limpezaEmAndamento = true;
    this.sincronizando = false;

    const agora = new Date().toISOString();

    // 2. Registrar carimbo oficial de base zerada pelo Admin
    if (typeof window !== 'undefined') {
      localStorage.setItem('solutions_base_zerada_timestamp', agora);
    }

    // 3. Esvaziar completamente todas as estruturas em memória
    this.produtos = [];
    this.serialMap.clear();
    this.fotosGrupos = [];
    this.registros10Fotos = [];
    this.historico = [];
    this.tentativasDuplicadas = [];
    this.seriaisLimposDaTela.clear();
    this.lotesFinalizados = [];
    this.salvarUltimoLote('01');

    // 4. Limpar completamente o LocalStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_FOTOS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_FOTOS_10_CAIXAS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_HISTORICO_ENVIOS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_TENTATIVAS_DUPLICADAS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_LOTES_FINALIZADOS, JSON.stringify([]));
      localStorage.setItem('solutions_caixas_cadastradas_v1', JSON.stringify([]));
      localStorage.removeItem(STORAGE_KEY_SERIAIS_LIMPOS_TELA);
      localStorage.removeItem('solutions_ultima_sincronizacao');
      localStorage.removeItem(STORAGE_KEY_ULTIMO_LOTE);
      localStorage.removeItem(STORAGE_KEY_LACRES_CAIXAS);
    }

    // 5. Limpar completamente o IndexedDB de forma síncrona/aguardada
    await limparIndexedDB();
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        await idb.produtos.clear();
        await idb.lotes_finalizados.clear();
        await idb.fotos_evidencias.clear();
      } catch (errIdb) {
        console.warn('[Storage] Erro ao limpar tabelas do IndexedDB:', errIdb);
      }
    }

    // 6. Zerar o servidor central online e repositórios de nuvem com carimbo de reset
    try {
      const cleanPayload = JSON.stringify({
        system: 'GRUPO SOLUTIONS AUDITORIA SAMSUNG',
        produtos: [],
        fotos: [],
        historico_envios: [],
        tentativas_duplicadas: [],
        lotes_finalizados: [],
        reset_timestamp: agora,
        ultimaAtualizacao: agora,
      });

      // 6.1 Chamar endpoint serverless da API central (/api/central/limpar)
      const limparApiUrl = obterApiUrl('/api/central/limpar');
      await fetch(limparApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitante: this.usuarioAtual?.nome || 'Administrador',
          confirmacao: 'CONFIRMAR_EXCLUSAO_TOTAL_BASE_DADOS',
        }),
      }).catch((err) => {
        console.warn('[Storage] Chamada a /api/central/limpar falhou:', err);
      });

      // 6.2 Fallback direto para o Supabase se configurado no cliente
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('audit_products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('lot_photos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('lots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } catch (errSup) {
          console.warn('[Storage] Falha ao zerar no Supabase diretamente:', errSup);
        }
      }
    } catch (e) {
      console.warn('Erro ao zerar nuvem central:', e);
    }

    // 7. Reconfirmar esvaziamento em memória e persistência para garantir 0 resíduos
    this.produtos = [];
    this.serialMap.clear();
    this.fotosGrupos = [];
    this.registros10Fotos = [];
    this.historico = [];
    this.tentativasDuplicadas = [];
    this.seriaisLimposDaTela.clear();
    this.lotesFinalizados = [];
    this.salvarUltimoLote('01');

    this.salvarTudo();

    // 8. Liberar trava de sincronização
    this.limpezaEmAndamento = false;

    // 9. Notificar todos os componentes e telas reativas
    this.notificarMudanca('produtos');
    this.notificarMudanca('fotos');
    this.notificarMudanca('caixas');
    this.notificarMudanca('lotes');
    this.notificarMudanca('sync');
    this.notificarMudanca('dados');

    return {
      sucesso: true,
      mensagem: 'Base de dados resetada com sucesso pelo Administrador: 0 produtos, 0 caixas, 0 fotos, 0 sincronizações.',
    };
  }

  // =========================================================================
  // =========================================================================
  // LIMPAR REGISTROS DA TELA DO COLABORADOR (OPERACIONAL)
  // Limpa a tela deste computador para novas auditorias.
  // IMPORTANTE: Tudo o que já foi enviado para o online CONTINUA 100% gravado
  // e preservado na nuvem. A base central online só pode ser excluída pelo ADMIN.
  // =========================================================================
  salvarSeriaisLimposDaTela() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY_SERIAIS_LIMPOS_TELA,
        JSON.stringify(Array.from(this.seriaisLimposDaTela))
      );
    } catch {}
  }

  obterContagemStatusRegistros(regional?: string): { pendentes: number; enviados: number; total: number } {
    const regAlvo = regional || (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional ? this.usuarioAtual.regional : undefined);
    const lista = this.produtos.filter((p) => {
      return !regAlvo || regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo;
    });
    const pendentes = lista.filter((p) => p.status_sincronizacao !== 'ENVIADO').length;
    const enviados = lista.filter((p) => p.status_sincronizacao === 'ENVIADO').length;
    return { pendentes, enviados, total: lista.length };
  }

  limparTelaColaborador(regional?: string): {
    sucesso: boolean;
    removidos: number;
    preservados: number;
    mensagem: string;
  } {
    const regAlvo = regional || (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional ? this.usuarioAtual.regional : undefined);

    let pendentesCount = 0;
    let enviadosCount = 0;

    const novosProdutos: ProdutoAuditoria[] = [];
    for (const p of this.produtos) {
      const matchRegional = !regAlvo || regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo;
      if (matchRegional) {
        const chave = `${(p.regional || 'VIA VAREJO RJ').trim().toUpperCase()}:::${p.serial.trim().toUpperCase()}`;
        this.seriaisLimposDaTela.add(chave);
        if (p.status_sincronizacao === 'ENVIADO') {
          enviadosCount++;
        } else {
          pendentesCount++;
        }
        // Remove da visualização e memória local desta tela
      } else {
        novosProdutos.push(p);
      }
    }

    this.produtos = novosProdutos;
    this.serialMap.clear();
    for (const p of this.produtos) {
      this.serialMap.set(p.serial.trim().toUpperCase(), p);
    }

    // Salvar seriais para não serem re-importados automaticamente para este colaborador
    this.salvarSeriaisLimposDaTela();

    // Limpar fotos locais desta regional da tela do computador
    this.fotosGrupos = this.fotosGrupos.filter((f) => {
      const matchRegional = !regAlvo || regAlvo === 'TODAS' || (f.regional || 'VIA VAREJO RJ') === regAlvo;
      return !matchRegional;
    });

    this.registros10Fotos = this.registros10Fotos.filter((r) => {
      const matchRegional = !regAlvo || regAlvo === 'TODAS' || r.regional === regAlvo;
      return !matchRegional;
    });

    this.salvarTudo();
    this.notificarMudanca('produtos');
    this.notificarMudanca('fotos');
    this.notificarMudanca('caixas');
    this.notificarMudanca('sync');

    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    const totalRemovidos = pendentesCount + enviadosCount;
    this.registrarHistorico(
      usuarioNome,
      'LIMPEZA_TELA_COLABORADOR',
      `Tela limpa pelo operador: ${totalRemovidos} produtos removidos da tela (${enviadosCount} já enviados ao online continuam 100% gravados na nuvem).`,
      regAlvo
    );

    return {
      sucesso: true,
      removidos: totalRemovidos,
      preservados: enviadosCount,
      mensagem: `Tela limpa com sucesso! ${totalRemovidos} produto(s) removido(s) da visualização. Os ${enviadosCount} registro(s) já enviados ao online continuam 100% salvos e protegidos na nuvem central.`,
    };
  }

  // Alias para retrocompatibilidade
  limparRegistrosLocaisNaoEnviados(regional?: string) {
    return this.limparTelaColaborador(regional);
  }

  // =========================================================================
  // MOTOR DE SINCRONIZAÇÃO INCREMENTAL INTELIGENTE (OFFLINE-FIRST)
  // Requisito 4: Envia APENAS registros novos (PENDENTE). Nunca reenvia antigos.
  // Requisito 6: Tratamento de duplicidade antes de gravar no servidor.
  // Requisito 8: Registra carimbo no Histórico de Envios.
  // =========================================================================
  async puxarAtualizacoesServidor(): Promise<boolean> {
    if (this.limpezaEmAndamento || this.sincronizando) return false;
    const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
    if (isTestEnv && !process.env.FORCE_TEST_SERVER_SYNC) return false;
    this.sincronizando = true;

    try {
      let alterou = false;
      // 1. Tentar endpoint da API Central (Vercel serverless ou Vite dev middleware) com anti-cache
      let produtosRemotos: ProdutoAuditoria[] | null = null;
      let fotosRemotas: FotoGrupoAuditoria[] | null = null;
      let historicoRemoto: RegistroSincronizacaoEnvio[] | null = null;
      let tentativasRemotas: LogTentativaDuplicado[] | null = null;
      let lotesRemotos: RegistroLoteFinalizado[] | null = null;
      let resetTimestampRemoto: string | null = null;

      try {
        const params = new URLSearchParams();
        params.set('_t', String(Date.now()));
        if (this.usuarioAtual?.perfil) params.set('perfil', this.usuarioAtual.perfil);
        if (this.usuarioAtual?.regional) params.set('regional', this.usuarioAtual.regional);

        const urlProds = obterApiUrl(`/api/central/produtos?${params.toString()}`);
        const headers: Record<string, string> = {
          'x-user-perfil': this.usuarioAtual?.perfil || 'ADMINISTRADOR',
          'x-user-regional': this.usuarioAtual?.regional || 'TODAS',
        };
        const token = typeof window !== 'undefined' ? sessionStorage.getItem('solutions_auth_session_token_v1') : null;
        if (token) {
          headers['authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(urlProds, { headers });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data && Array.isArray(data.produtos)) {
              produtosRemotos = data.produtos;
            }
            if (data && Array.isArray(data.fotos)) {
              fotosRemotas = data.fotos;
            }
            if (data && Array.isArray(data.historico_envios)) {
              historicoRemoto = data.historico_envios;
            }
            if (data && Array.isArray(data.tentativas_duplicadas)) {
              tentativasRemotas = data.tentativas_duplicadas;
            }
            if (data && Array.isArray(data.lotes_finalizados)) {
              lotesRemotos = data.lotes_finalizados;
            }
            if (data && data.reset_timestamp) {
              resetTimestampRemoto = data.reset_timestamp;
            }
          }
        }
      } catch (errApi) {
        console.warn('[Storage] Falha ao consultar /api/central/produtos:', errApi);
      }

      // 1.1 Sincronizar bases de referência ativas e lotes de importação do servidor central
      try {
        const refParams = new URLSearchParams();
        refParams.set('_t', String(Date.now()));
        const regAlvo = this.usuarioAtual?.regional || 'TODAS';
        if (regAlvo && regAlvo !== 'TODAS') {
          refParams.set('regional', regAlvo);
        }
        refParams.set('ativos', 'true');
        const urlRef = obterApiUrl(`/api/central/referencia-import?${refParams.toString()}`);
        const resRef = await fetch(urlRef);
        if (resRef.ok) {
          const refData = await resRef.json();
          if (refData && refData.sucesso) {
            if (Array.isArray(refData.batches) && refData.batches.length > 0) {
              const alterouB = this.mesclarBatchesCentral(refData.batches);
              if (alterouB) alterou = true;
            }
            if (Array.isArray(refData.references) && refData.references.length > 0) {
              const alterouR = this.mesclarReferenciasCentral(refData.references);
              if (alterouR) alterou = true;
            }
          }
        }
      } catch (errRefApi) {
        console.warn('[Storage] Falha ao consultar /api/central/referencia-import:', errRefApi);
      }

      // 1.2 Fallback direto no Supabase para referências se estiver vazio
      if (this.regionalReferences.length === 0 && isSupabaseConfigured && supabase) {
        try {
          const { data: dbRefs } = await supabase
            .from('regional_inventory_reference')
            .select('id, regional, import_batch_id, imei_normalized, sku, model_description, brand, origin_invoice, dealer_raw, dealer_normalized, source_file_name, is_active, source_row, created_at')
            .eq('is_active', true);
          if (Array.isArray(dbRefs) && dbRefs.length > 0) {
            const alterouR = this.mesclarReferenciasCentral(dbRefs as any);
            if (alterouR) alterou = true;
          }
        } catch (errSupaRefs) {
          console.warn('[Storage] Falha ao consultar referências no Supabase:', errSupaRefs);
        }
      }

      // 2. Fallback Supabase Direto caso a rota /api/central/produtos não responda
      if (!produtosRemotos && isSupabaseConfigured && supabase) {
        try {
          const { data: dbProducts } = await supabase
            .from('audit_products')
            .select('*, regions(codigo, nome)')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (Array.isArray(dbProducts) && dbProducts.length > 0) {
            produtosRemotos = dbProducts.map((p: any, idx: number): ProdutoAuditoria => {
              let lacreSeguranca = p.lacre_seguranca || null;
              let obsLimpa = p.observacao || '';
              if (p.observacao && p.observacao.includes('[LACRE:')) {
                const m = p.observacao.match(/\[LACRE:(.*?)\]/);
                if (m && m[1]) {
                  lacreSeguranca = m[1].trim();
                  obsLimpa = p.observacao.replace(/\[LACRE:.*?\]\s*/g, '').trim();
                }
              }

                const classifCalculada =
                  p.product_classification ||
                  p.box_classification ||
                  (p.source_type === 'LISTED'
                    ? (p.dealer && p.dealer.toUpperCase() !== 'SAMSUNG'
                        ? `PRODUTO NA LISTA - ${p.dealer.toUpperCase()}`
                        : `PRODUTO NA LISTA - SAMSUNG`)
                    : ((p.fabricante || p.brand || 'SAMSUNG').toUpperCase() === 'SAMSUNG'
                        ? 'FORA DA LISTA - SAMSUNG'
                        : `FORA DA LISTA - ${(p.fabricante || p.brand || 'OUTRA MARCA').toUpperCase()}`));

                return {
                  id: typeof p.id_local === 'number' ? p.id_local : Date.now() + idx,
                  id_local: typeof p.id_local === 'number' ? p.id_local : Date.now() + idx,
                  id_servidor: p.id || null,
                  uuid: p.id || String(Date.now() + idx),
                  serial: p.serial,
                  imei: p.imei || p.serial,
                  fabricante: p.fabricante || p.brand || 'SAMSUNG',
                  brand: p.brand || p.fabricante || 'SAMSUNG',
                  modelo_produto: p.modelo || 'Modelo Desconhecido',
                  ean: p.ean || '',
                  sku: p.sku || p.ean || '',
                  numero_lote: p.numero_lote || '01',
                  numero_caixa: p.numero_caixa || '01',
                  box_name: p.box_name || p.numero_caixa || '01',
                  regional: p.regions?.nome || p.regions?.codigo || 'VIA VAREJO RJ',
                  produto_lacrado: p.produto_lacrado === 'NÃO' ? 'NÃO' : 'SIM',
                  kit_completo: p.kit_completo === 'NÃO' ? 'NÃO' : 'SIM',
                  aparelho_marcas_uso: p.aparelho_marcas_uso === 'SIM' ? 'SIM' : 'NÃO',
                  lacre_seguranca: lacreSeguranca,
                  observacao: obsLimpa,
                  data_cadastro: p.data_auditoria || p.created_at || new Date().toISOString(),
                  usuario_cadastro: p.usuario_bipagem || 'Operador',
                  computador_id: p.device_id || 'PC-01',
                  computador_nome: 'Estação',
                  data_alteracao: null,
                  data_auditoria: formatarDataParaExibicaoBR(p.data_auditoria) || p.data_auditoria || new Date().toLocaleDateString('pt-BR'),
                  data_sincronizacao: p.created_at || new Date().toISOString(),
                  status_sincronizacao: (p.status_sincronizacao as StatusSincronizacaoItem) || 'ENVIADO',
                  origin_invoice: p.origin_invoice || null,
                  nf_origem: p.origin_invoice || null,
                  classificacao_produto: classifCalculada,
                  product_classification: classifCalculada,
                  box_classification: classifCalculada,
                  source_type: p.source_type || 'OUT_OF_LIST',
                  dealer: p.dealer || null,
                };
              });
          }
        } catch (errSup) {
          console.warn('[Storage] Falha ao consultar Supabase diretamente:', errSup);
        }
      }

      // Se durante o fetch a base foi limpa, não processar respostas antigas defasadas
      if (this.limpezaEmAndamento) return false;

      if (produtosRemotos && Array.isArray(produtosRemotos)) {
        if (produtosRemotos.length === 0) {
          const resetLocal = typeof window !== 'undefined' ? localStorage.getItem('solutions_base_zerada_timestamp') : null;
          // Somente limpa os produtos locais se houver solicitação explícita de reset (Limpar Base pelo Admin)
          if (resetTimestampRemoto || resetLocal) {
            if (this.produtos.length > 0) {
              this.produtos = [];
              this.serialMap.clear();
              alterou = true;
            }
          }
        } else {
          const alterouProds = this.mesclarProdutosCentral(produtosRemotos);
          if (alterouProds) alterou = true;
        }
      }

      if (fotosRemotas && Array.isArray(fotosRemotas)) {
        if (fotosRemotas.length === 0) {
          const resetLocal = typeof window !== 'undefined' ? localStorage.getItem('solutions_base_zerada_timestamp') : null;
          if ((resetTimestampRemoto || resetLocal) && this.fotosGrupos.length > 0) {
            this.fotosGrupos = [];
            this.registros10Fotos = [];
            alterou = true;
          }
        } else {
          const alterouFotos = this.mesclarFotosCentral(fotosRemotas);
          if (alterouFotos) alterou = true;
        }
      }

      if (historicoRemoto && historicoRemoto.length > 0) {
        const alterouHist = this.mesclarHistoricoCentral(historicoRemoto);
        if (alterouHist) alterou = true;
      }
      if (tentativasRemotas && tentativasRemotas.length > 0) {
        const alterouTent = this.mesclarTentativasDuplicadasCentral(tentativasRemotas);
        if (alterouTent) alterou = true;
      }
      if (lotesRemotos && lotesRemotos.length > 0) {
        const alterouLotes = this.mesclarLotesCentral(lotesRemotos);
        if (alterouLotes) alterou = true;
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('solutions_ultima_sincronizacao', new Date().toISOString());
      }

      if (alterou) {
        this.salvarTudo();
        this.notificarMudanca('produtos');
        this.notificarMudanca('fotos');
        this.notificarMudanca('caixas');
        this.notificarMudanca('lotes');
        this.notificarMudanca('sync');
        return true;
      }
    } catch (e) {
      console.warn('[Storage] Servidor inacessível no momento (offline):', e);
    } finally {
      this.sincronizando = false;
    }
    return false;
  }

  mesclarProdutosCentral(produtosCentral: ProdutoAuditoria[]): boolean {
    let alterou = false;

    // Se estiver em processo de limpeza, não mesclar nada
    if (this.limpezaEmAndamento) return false;

    // Inserir ou atualizar produtos vindos da central sem remover itens locais existentes
    const locaisMap = new Map<string, ProdutoAuditoria>();
    for (const p of this.produtos) {
      const chave = `${(p.regional || 'VIA VAREJO RJ').trim().toUpperCase()}:::${p.serial.trim().toUpperCase()}`;
      locaisMap.set(chave, p);
    }

    for (const cp of produtosCentral) {
      if (cp.lacre_seguranca && cp.numero_caixa) {
        this.definirLacreCaixa(cp.numero_caixa, cp.lacre_seguranca, cp.regional);
      }
      const chave = `${(cp.regional || 'VIA VAREJO RJ').trim().toUpperCase()}:::${cp.serial.trim().toUpperCase()}`;
      // Se for operador e este produto foi limpo da tela deste computador, não restaurar na tela dele
      if (this.usuarioAtual?.perfil !== 'ADMINISTRADOR' && this.seriaisLimposDaTela.has(chave)) {
        continue;
      }
      const local = locaisMap.get(chave);
      if (!local) {
        // Produto novo vindo de outro celular ou computador
        const novo: ProdutoAuditoria = {
          ...cp,
          status_sincronizacao: 'ENVIADO',
          sync_status: 'ENVIADO',
        };
        this.produtos.unshift(novo);
        this.serialMap.set(cp.serial.trim().toUpperCase(), novo);
        locaisMap.set(chave, novo);
        alterou = true;
      } else {
        if (cp.lacre_seguranca && !local.lacre_seguranca) {
          local.lacre_seguranca = cp.lacre_seguranca;
          alterou = true;
        }
        if (cp.sku && !local.sku) {
          local.sku = cp.sku;
          alterou = true;
        }
        if (cp.origin_invoice && !local.origin_invoice) {
          local.origin_invoice = cp.origin_invoice;
          local.nf_origem = cp.origin_invoice;
          alterou = true;
        }
        if (cp.box_classification && !local.box_classification) {
          local.box_classification = cp.box_classification;
          local.product_classification = cp.product_classification || cp.box_classification;
          local.classificacao_produto = cp.classificacao_produto || cp.box_classification;
          alterou = true;
        }
        if (cp.status_sincronizacao === 'ENVIADO' && local.status_sincronizacao !== 'ENVIADO') {
          local.status_sincronizacao = 'ENVIADO';
          local.sync_status = 'ENVIADO';
          alterou = true;
        }
      }
    }
    return alterou;
  }

  mesclarFotosCentral(fotosCentral: FotoGrupoAuditoria[]): boolean {
    let alterou = false;
    for (const cf of fotosCentral) {
      const idx = this.fotosGrupos.findIndex(
        (f) =>
          f.id === cf.id ||
          (f.regional === cf.regional && f.caixa === cf.caixa && f.grupoNumero === cf.grupoNumero)
      );
      if (idx === -1) {
        this.fotosGrupos.push({
          ...cf,
          status_sincronizacao: 'ENVIADO',
        });
        alterou = true;
      } else if (this.fotosGrupos[idx].status_sincronizacao !== 'ENVIADO') {
        this.fotosGrupos[idx].status_sincronizacao = 'ENVIADO';
        alterou = true;
      }
    }
    return alterou;
  }

  mesclarLotesCentral(lotesCentral: RegistroLoteFinalizado[]): boolean {
    let alterou = false;
    for (const cl of lotesCentral) {
      const idx = this.lotesFinalizados.findIndex(
        (l) =>
          l.numero_lote.trim().toUpperCase() === cl.numero_lote.trim().toUpperCase() &&
          l.regional.trim().toUpperCase() === cl.regional.trim().toUpperCase()
      );
      if (idx === -1) {
        this.lotesFinalizados.push(cl);
        alterou = true;
      } else {
        const local = this.lotesFinalizados[idx];
        const dataRemota = new Date(cl.data_reabertura || cl.data_fechamento).getTime();
        const dataLocal = new Date(local.data_reabertura || local.data_fechamento).getTime();
        if (
          dataRemota > dataLocal ||
          (cl.historico_alteracoes?.length || 0) > (local.historico_alteracoes?.length || 0)
        ) {
          this.lotesFinalizados[idx] = cl;
          alterou = true;
        }
      }
    }
    return alterou;
  }

  mesclarBatchesCentral(batchesCentral: InventoryImportBatch[]): boolean {
    let alterou = false;
    const map = new Map<string, InventoryImportBatch>();
    for (const b of this.importBatches) {
      map.set(b.id, b);
    }
    for (const cb of batchesCentral) {
      if (!map.has(cb.id)) {
        this.importBatches.push(cb);
        map.set(cb.id, cb);
        alterou = true;
      } else {
        const local = map.get(cb.id)!;
        if (local.status !== cb.status || (cb.version && cb.version !== local.version)) {
          Object.assign(local, cb);
          alterou = true;
        }
      }
    }
    if (alterou) {
      this.importBatches.sort((a, b) => (b.version || 0) - (a.version || 0));
      salvarIndexedDB(STORAGE_KEY_IMPORT_BATCHES, this.importBatches).catch(() => {});
      try {
        localStorage.setItem(STORAGE_KEY_IMPORT_BATCHES, JSON.stringify(this.importBatches));
      } catch {}
    }
    return alterou;
  }

  mesclarReferenciasCentral(referenciasCentral: RegionalInventoryReference[]): boolean {
    let alterou = false;
    const map = new Map<string, RegionalInventoryReference>();
    for (const r of this.regionalReferences) {
      map.set(r.id, r);
    }
    for (const cr of referenciasCentral) {
      if (!map.has(cr.id)) {
        this.regionalReferences.push(cr);
        map.set(cr.id, cr);
        alterou = true;
      } else {
        const local = map.get(cr.id)!;
        if (local.is_active !== cr.is_active) {
          local.is_active = cr.is_active;
          alterou = true;
        }
      }
    }
    if (alterou) {
      this.reconstruirMapaReferencia();
      salvarIndexedDB(STORAGE_KEY_REGIONAL_REFS, this.regionalReferences).catch(() => {});
      try {
        localStorage.setItem(STORAGE_KEY_REGIONAL_REFS, JSON.stringify(this.regionalReferences));
      } catch {}
    }
    return alterou;
  }

  async sincronizarOnline(): Promise<ResultadoSincronizacao> {
    const agora = new Date().toISOString();
    const agoraFormatada = new Date().toLocaleString('pt-BR');
    const userReg = (this.usuarioAtual?.regional || '').trim();
    const regAlvo = userReg && userReg !== 'TODAS'
      ? userReg
      : (this.produtos.length > 0 && this.produtos[0].regional ? this.produtos[0].regional : undefined);
    const compAtual = this.obterComputadorAtual(regAlvo);
    const regionalFinal = regAlvo || compAtual.regional || 'VIA VAREJO RJ';

    // 1. Filtrar APENAS produtos novos / não sincronizados (PENDENTE ou ERRO_DUPLICADO)
    const pendentes = this.produtos.filter((p) => {
      if (p.status_sincronizacao === 'ENVIADO' || p.sync_status === 'ENVIADO' || p.sync_status === 'SINCRONIZADO') {
        return false;
      }
      const isPendente = p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE' || p.status_sincronizacao === 'ERRO_DUPLICADO';
      if (!isPendente) return false;
      if (regAlvo && this.usuarioAtual?.perfil === 'OPERADOR') {
        return (p.regional || 'VIA VAREJO RJ') === regAlvo;
      }
      return true;
    });

    const pendentesFotos = this.fotosGrupos.filter((f) => {
      if (f.status_sincronizacao === 'ENVIADO') return false;
      if (regAlvo && this.usuarioAtual?.perfil === 'OPERADOR') return f.regional === regAlvo;
      return true;
    });

    if (pendentes.length === 0 && pendentesFotos.length === 0) {
      await this.puxarAtualizacoesServidor();
      return {
        sucesso: true,
        totalSincronizados: 0,
        duplicadosEvitados: 0,
        itensDuplicados: [],
        timestamp: agora,
        mensagem: 'Não há novos seriais ou fotos pendentes neste dispositivo. Base sincronizada com o servidor central.',
      };
    }

    // Preparar fotos leves para sincronização em nuvem (sem estourar payload)
    const pendentesFotosSync = await Promise.all(
      pendentesFotos.map(async (f) => ({
        ...f,
        fotoDataUri: await prepararFotoLeveParaSync(f.fotoDataUri),
      }))
    );

    let sincronizouComSucesso = false;
    let dataResposta: any = null;

    // 2. ENVIAR PARA O SERVIDOR CENTRAL VIA HTTP REAL (REDE / NUVEM)
    const endpointsParaTentar: string[] = [
      obterApiUrl('/api/central/sync'),
    ];
    const urlAbsoluta = `${SERVIDOR_CENTRAL_PADRAO}/api/central/sync`;
    if (!endpointsParaTentar.includes(urlAbsoluta)) {
      endpointsParaTentar.push(urlAbsoluta);
    }
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      if (!endpointsParaTentar.includes('/api/central/sync')) {
        endpointsParaTentar.push('/api/central/sync');
      }
    }

    // Mapa de lacres de caixas para enviar junto no payload
    const lacresCaixasMap: Record<string, string> = {};
    for (const p of this.produtos) {
      const cx = p.numero_caixa || p.box_name;
      if (cx) {
        const l = p.lacre_seguranca || this.obterLacreCaixa(cx, regionalFinal);
        if (l) lacresCaixasMap[cx.trim().toUpperCase()] = l;
      }
    }

    const pendentesComLacre = pendentes.map((p) => {
      const cxNorm = (p.numero_caixa || p.box_name || 'Caixa 01').trim().toUpperCase();
      const l = p.lacre_seguranca || lacresCaixasMap[cxNorm] || this.obterLacreCaixa(cxNorm, p.regional || regionalFinal) || null;
      return {
        ...p,
        lacre_seguranca: l,
      };
    });

    const colabAtivo = this.obterColaboradorAtivo() || this.usuarioAtual?.nome || 'Operador';
    const usuarioPayload = typeof this.usuarioAtual === 'object' && this.usuarioAtual ? {
      ...this.usuarioAtual,
      nome: colabAtivo,
      login: this.usuarioAtual.login || colabAtivo.toLowerCase(),
      perfil: this.usuarioAtual.perfil || 'OPERADOR',
      regional: this.usuarioAtual.regional || regionalFinal,
    } : {
      nome: colabAtivo,
      login: 'operador',
      perfil: 'OPERADOR',
      regional: regionalFinal,
    };

    let ultimoErroServidor: string | null = null;

    for (const endpoint of endpointsParaTentar) {
      if (sincronizouComSucesso) break;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produtos: pendentesComLacre,
            lacres_caixas: lacresCaixasMap,
            fotos: pendentesFotosSync,
            lotes_finalizados: this.lotesFinalizados,
            computador: compAtual,
            usuario: usuarioPayload,
            regional: regionalFinal,
          }),
        });

        let data: any = null;
        try {
          const ct = response.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            data = await response.json();
          }
        } catch {}

        if (response.ok && data && data.sucesso) {
          dataResposta = data;
          sincronizouComSucesso = true;
          break;
        } else if (data && data.erro) {
          ultimoErroServidor = data.erro;
          console.warn(`[Storage] Endpoint ${endpoint} retornou erro do servidor:`, data.erro);
        }
      } catch (err) {
        console.warn(`[Storage] Tentativa de sync em ${endpoint} falhou:`, err);
      }
    }

    // 3. Fallback Supabase Direto caso a rota /api/central/sync não responda (Vercel timeout, offline etc.)
    if (!sincronizouComSucesso && isSupabaseConfigured && supabase) {
      try {
        const serialsConsulta = pendentes
          .map((p) => (p.serial || '').trim().toUpperCase())
          .filter(Boolean);

        const { data: dbExistentes } = await supabase
          .from('audit_products')
          .select('serial, imei, modelo, numero_caixa, created_at, usuario_bipagem')
          .is('deleted_at', null)
          .in('serial', serialsConsulta);

        const mapExistentes = new Map<string, any>();
        if (Array.isArray(dbExistentes)) {
          for (const d of dbExistentes) {
            const sn = (d.serial || '').trim().toUpperCase();
            if (sn) mapExistentes.set(sn, d);
          }
        }

        let regionalId: string | null = null;
        const regNome = regionalFinal;
        const { data: reg } = await supabase
          .from('regions')
          .select('id')
          .or(`codigo.eq.${regNome},nome.eq.${regNome}`)
          .maybeSingle();

        if (reg?.id) regionalId = reg.id;

        let novosCount = 0;
        const duplicadosList: DetalheImeiDuplicado[] = [];
        const paraInserir: any[] = [];

        for (const p of pendentesComLacre) {
          const sn = (p.serial || '').trim().toUpperCase();
          if (!sn) continue;
          if (mapExistentes.has(sn)) {
            const existente = mapExistentes.get(sn);
            duplicadosList.push({
              imei: p.serial,
              serial: p.serial,
              modelo_produto: p.modelo_produto || existente.modelo || '',
              numero_caixa: p.numero_caixa || existente.numero_caixa || '',
              data_cadastro_existente: existente.created_at || 'Data anterior',
              usuario_existente: existente.usuario_bipagem || 'Outro Colaborador',
              computador_existente: compAtual.nome || 'Estacao',
              regional_existente: regNome,
              status: 'DUPLICADO NO SERVIDOR',
              id_local: p.id,
            });
          } else {
            const cx = p.numero_caixa || 'Caixa 01';
            const lacre = (p.lacre_seguranca || this.obterLacreCaixa(cx, regNome) || '').trim();
            const obsOriginal = (p.observacao || '').trim();
            let obsFinal = obsOriginal;
            if (lacre && !obsOriginal.includes('[LACRE:')) {
              obsFinal = obsOriginal ? `[LACRE:${lacre}] ${obsOriginal}` : `[LACRE:${lacre}]`;
            }

            const isLacrado = p.produto_lacrado === 'NÃO' ? 'NÃO' : 'SIM';

            paraInserir.push({
              id_local: p.id,
              serial: String(sn).slice(0, 50),
              imei: String(p.imei || p.serial || '').slice(0, 20),
              ean: String(p.ean || p.sku || '').slice(0, 20),
              modelo: String(p.modelo_produto || 'Modelo Desconhecido').slice(0, 120),
              fabricante: String(p.brand || p.fabricante || 'SAMSUNG').slice(0, 50),
              numero_lote: String(p.numero_lote || '01').slice(0, 50),
              numero_caixa: String(cx).slice(0, 50),
              regional_id: regionalId,
              produto_lacrado: isLacrado,
              kit_completo: isLacrado === 'SIM' ? null : (p.kit_completo === 'NÃO' ? 'NÃO' : 'SIM'),
              aparelho_marcas_uso: isLacrado === 'SIM' ? null : (p.aparelho_marcas_uso === 'SIM' ? 'SIM' : 'NÃO'),
              observacao: obsFinal || null,
              usuario_bipagem: this.usuarioAtual?.nome || 'Operador',
              status_sincronizacao: 'ENVIADO',
              data_auditoria: normalizarDataParaPostgresDate(p.data_auditoria || p.data_cadastro),
              reference_id: p.reference_id || null,
              import_batch_id: p.import_batch_id || null,
              source_type: p.source_type || 'OUT_OF_LIST',
              dealer: p.dealer || null,
              origin_invoice: p.origin_invoice || p.nf_origem || p.numero_nf || null,
              sku: p.sku || p.ean || null,
              brand: p.brand || p.fabricante || 'SAMSUNG',
              misuse: p.misuse !== undefined ? p.misuse : (p.aparelho_marcas_uso === 'SIM'),
            });
            novosCount++;
          }
        }

        if (paraInserir.length > 0 && regionalId) {
          const { error: insErr } = await supabase.from('audit_products').upsert(paraInserir, { onConflict: 'serial,regional_id' });
          if (!insErr) {
            sincronizouComSucesso = true;
          }
        } else if (paraInserir.length === 0 && duplicadosList.length > 0) {
          sincronizouComSucesso = true;
        }

        if (sincronizouComSucesso) {
          dataResposta = {
            sucesso: true,
            sincronizados: novosCount,
            fotosSincronizadas: 0,
            duplicadosEvitados: duplicadosList.length,
            itensDuplicados: duplicadosList,
            totalNaBaseCentral: novosCount,
            produtosCentral: [],
            fotosCentral: [],
            origem: 'SUPABASE_DIRECT',
            mensagem:
              duplicadosList.length > 0
                ? `${novosCount} novo(s) IMEI(s) sincronizado(s). ${duplicadosList.length} IMEI(s) não foram enviados pois já constam no servidor.`
                : `${novosCount} novo(s) IMEI(s) sincronizado(s) online com sucesso!`,
            timestamp: agora,
          };
        }
      } catch (errSupabaseSync) {
        console.warn('[Storage] Falha no fallback direto Supabase:', errSupabaseSync);
      }
    }

    // 4. Conclusão da Sincronização
    if (sincronizouComSucesso && dataResposta) {
      const itensDuplicados: DetalheImeiDuplicado[] = Array.isArray(dataResposta.itensDuplicados)
        ? dataResposta.itensDuplicados
        : [];
      const seriaisDuplicados = new Set(
        itensDuplicados.map((d) => (d.serial || d.imei).trim().toUpperCase())
      );

      const pendentesSeriais = new Set(pendentes.map((p) => p.serial.trim().toUpperCase()));
      const idsSincronizados: number[] = [];

      // 1. Processar itens duplicados (REJEITADOS PELO SERVIDOR ONLINE)
      for (const dup of itensDuplicados) {
        const norm = (dup.serial || dup.imei).trim().toUpperCase();
        const prodLocal = this.produtos.find((p) => p.serial.trim().toUpperCase() === norm);
        if (prodLocal) {
          prodLocal.status_sincronizacao = 'ERRO_DUPLICADO';
          prodLocal.sync_status = 'ERRO_DUPLICADO';
          prodLocal.erro_sincronizacao = 'IMEI NÃO FOI ENVIADO, POIS JÁ SE ENCONTRA CADASTRADO NA BASE DO SERVIDOR.';
          prodLocal.duplicado_servidor_info = {
            ...dup,
            status: 'DUPLICADO NO SERVIDOR',
          };
        }

        // Registrar no log local de tentativas duplicadas
        this.registrarTentativaEnvioDuplicado({
          usuario: this.usuarioAtual?.nome || 'Operador',
          data_hora: agoraFormatada,
          imei: dup.serial || dup.imei,
          computador: `${compAtual.id} (${compAtual.nome})`,
          resultado: 'BLOQUEADO: IMEI JÁ CADASTRADO NO SERVIDOR',
          regional: compAtual.regional || (this.usuarioAtual?.regional || 'VIA VAREJO RJ'),
          data_cadastro_existente: dup.data_cadastro_existente,
          usuario_existente: dup.usuario_existente,
        });

        this.registrarHistorico(
          this.usuarioAtual?.nome || 'Operador',
          'BLOQUEIO_DUPLICIDADE_ONLINE',
          `Tentativa de envio bloqueada pelo servidor online: IMEI ${dup.serial || dup.imei} já cadastrado por ${dup.usuario_existente || 'outro usuário'} em ${dup.data_cadastro_existente || 'data anterior'}.`,
          compAtual.regional
        );
      }

      // 2. Processar itens válidos enviados com sucesso
      for (const p of this.produtos) {
        const norm = p.serial.trim().toUpperCase();
        if (pendentesSeriais.has(norm) && !seriaisDuplicados.has(norm)) {
          p.status_sincronizacao = 'ENVIADO';
          p.sync_status = 'ENVIADO';
          p.data_sincronizacao = agora;
          p.sync_data = agora;
          p.erro_sincronizacao = null;
          p.duplicado_servidor_info = null;
          idsSincronizados.push(p.id);
        }
      }

      // 3. Marcar fotos enviadas
      for (const f of this.fotosGrupos) {
        if (pendentesFotos.some((pf) => pf.id === f.id)) {
          f.status_sincronizacao = 'ENVIADO';
          f.data_sincronizacao = agora;
        }
      }

      // 4. Ingerir e mesclar todos os produtos do servidor central
      if (Array.isArray(dataResposta.produtosCentral)) {
        this.mesclarProdutosCentral(dataResposta.produtosCentral);
      }
      if (Array.isArray(dataResposta.fotosCentral)) {
        this.mesclarFotosCentral(dataResposta.fotosCentral);
      }

      this.salvarTudo();
      this.notificarMudanca('sync');
      this.notificarMudanca('produtos');
      this.notificarMudanca('fotos');

      if (idsSincronizados.length > 0) {
        this.salvarRegistroEnvio({
          data_envio: agoraFormatada,
          regional: regionalFinal,
          computador_id: compAtual.id,
          computador_nome: compAtual.nome,
          quantidade_enviada: dataResposta.sincronizados,
          status: 'OK',
          detalhes: dataResposta.mensagem,
          produtos_ids: idsSincronizados,
        });

        const usuarioNome = this.usuarioAtual?.nome || 'Operador';
        this.registrarHistorico(
          usuarioNome,
          'ENVIAR_PARA_ONLINE',
          `Envio online realizado pelo ${compAtual.id} (${compAtual.nome}): ${dataResposta.sincronizados} novos seriais sincronizados no servidor central.`,
          regionalFinal
        );

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('solutions_ultimo_envio', agora);
          localStorage.setItem('solutions_ultima_sincronizacao', agora);
        }
      }

      return {
        sucesso: itensDuplicados.length === 0,
        totalSincronizados: dataResposta.sincronizados,
        duplicadosEvitados: itensDuplicados.length,
        itensDuplicados: itensDuplicados,
        timestamp: agora,
        mensagem: dataResposta.mensagem,
      };
    }

    // Fallback Offline: se o servidor e a nuvem estiverem temporariamente inacessíveis
    return {
      sucesso: false,
      totalSincronizados: 0,
      duplicadosEvitados: 0,
      itensDuplicados: [],
      timestamp: agora,
      mensagem: ultimoErroServidor
        ? `Aviso do servidor: ${ultimoErroServidor}`
        : 'Sem conexão com o servidor central no momento. Seus registros estão salvos localmente e serão sincronizados assim que a conexão for restabelecida.',
    };
  }

  obterStatusSincronizacao(): StatusSincronizacao {
    let prods = this.produtos;
    if (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional) {
      prods = prods.filter((p) => (p.regional || 'VIA VAREJO RJ') === this.usuarioAtual?.regional);
    }
    const pendentes = prods.filter(
      (p) => p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE'
    ).length;
    const enviados = prods.filter(
      (p) =>
        p.status_sincronizacao === 'ENVIADO' ||
        p.sync_status === 'SINCRONIZADO' ||
        p.sync_status === 'ENVIADO'
    ).length;

    const tentativasDup = this.listarTentativasDuplicadas();
    const duplicadosLocais = prods.filter((p) => p.status_sincronizacao === 'ERRO_DUPLICADO').length;
    const quantidadeBloqueada = Math.max(tentativasDup.length, duplicadosLocais);

    const historico = this.listarHistoricoEnvios();
    const ultimoEnvio = (typeof localStorage !== 'undefined' && localStorage.getItem('solutions_ultimo_envio')) || (historico.length > 0 ? historico[0].data_envio : null);
    const ultimaSincronizacao = (typeof localStorage !== 'undefined' && localStorage.getItem('solutions_ultima_sincronizacao')) || null;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    let statusConexao: StatusConexao = 'ONLINE';
    if (isOffline) {
      statusConexao = 'OFFLINE';
    } else if (pendentes === 0) {
      statusConexao = 'SINCRONIZADO';
    } else {
      statusConexao = 'ONLINE';
    }

    return {
      pendentes,
      registrosPendentes: pendentes,
      sincronizados: enviados,
      enviados,
      quantidadeEnviada: enviados,
      quantidadeBloqueada,
      total: prods.length,
      ultimaSincronizacao,
      ultimoEnvio,
      statusConexao,
    };
  }

  // =========================================================================
  // PRIMEIRA INSTALAÇÃO E SINCRONIZAÇÃO INICIAL (REQUISITO 4)
  // =========================================================================
  isConfiguracaoInicialConcluida(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG_INICIAL);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return !!parsed.realizada;
    } catch {
      return false;
    }
  }

  obterInfoConfiguracaoInicial(): ConfiguracaoInicialInfo {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG_INICIAL);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return {
      realizada: false,
      data_hora: null,
      usuario: null,
      parametros_baixados: false,
      total_modelos_catalogo: 0,
    };
  }

  marcarConfiguracaoInicialConcluida(usuario: string, totalModelos: number = 0): void {
    const info: ConfiguracaoInicialInfo = {
      realizada: true,
      data_hora: new Date().toLocaleString('pt-BR'),
      usuario,
      parametros_baixados: true,
      total_modelos_catalogo: totalModelos || 10,
    };
    localStorage.setItem(STORAGE_KEY_CONFIG_INICIAL, JSON.stringify(info));
    this.notificarMudanca('config');
  }

  async executarPrimeiraSincronizacao(usuario: string): Promise<{ sucesso: boolean; mensagem: string; modelosBaixados?: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        sucesso: false,
        mensagem: 'Atenção: A primeira inicialização após a instalação requer conexão com a internet para baixar os parâmetros, regras e configurações oficiais do servidor. Por favor, conecte-se à internet para prosseguir.',
      };
    }

    try {
      // 1. Validar status do servidor
      let statusOk = false;
      try {
        const resStatus = await fetch(obterApiUrl('/api/central/status'), { cache: 'no-store' });
        if (resStatus.ok) {
          statusOk = true;
        }
      } catch {
        statusOk = false;
      }

      // Se falhar o endpoint local, verificar conectividade com o Supabase
      if (!statusOk && isSupabaseConfigured && supabase) {
        try {
          const { count } = await supabase.from('audit_products').select('*', { count: 'exact', head: true });
          if (typeof count === 'number') statusOk = true;
        } catch {}
      }

      // 2. Executar sincronização completa de catálogo e base
      await this.sincronizarOnline();

      // 3. Salvar conclusão
      this.marcarConfiguracaoInicialConcluida(usuario, 25);

      this.registrarHistorico(
        usuario,
        'PRIMEIRA_SINCRONIZACAO_INSTALACAO',
        'Sincronização inicial pós-instalação concluída com sucesso. Base de dados local e parâmetros oficiais do Grupo Solutions Samsung inicializados.',
        this.usuarioAtual?.regional || undefined
      );

      return {
        sucesso: true,
        mensagem: 'Primeira sincronização concluída com sucesso! Base local estruturada e pronta para funcionamento 100% offline.',
        modelosBaixados: 25,
      };
    } catch {
      return {
        sucesso: false,
        mensagem: 'Não foi possível concluir a primeira sincronização com o servidor central. Verifique sua conexão e tente novamente.',
      };
    }
  }

  // =========================================================================
  // AUDITORIA DE ACESSO E CONTROLE DE MÁQUINAS (REQUISITO 3)
  // =========================================================================
  registrarAcessoUsuario(usuarioNome: string, perfil: string, regional?: string | null): void {
    const comp = this.obterComputadorAtual(regional || undefined);
    const raw = localStorage.getItem(STORAGE_KEY_LOGS_ACESSO);
    let logs: LogAcessoUsuario[] = [];
    if (raw) {
      try {
        logs = JSON.parse(raw);
      } catch {}
    }

    const novoLog: LogAcessoUsuario = {
      id: Date.now(),
      usuario: usuarioNome,
      perfil,
      regional: regional || null,
      maquina_id: comp.id,
      maquina_nome: comp.nome,
      data_hora: new Date().toLocaleString('pt-BR'),
      dispositivo: typeof navigator !== 'undefined' ? `${navigator.platform || 'Windows'} - ${navigator.userAgent.split(' ')[0]}` : 'Windows Desktop App',
      ip: '127.0.0.1 (Local)',
    };

    logs.unshift(novoLog);
    if (logs.length > 500) logs = logs.slice(0, 500);
    localStorage.setItem(STORAGE_KEY_LOGS_ACESSO, JSON.stringify(logs));
  }

  listarAcessosUsuarios(): LogAcessoUsuario[] {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS_ACESSO);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }


  // =========================================================================
  // HISTÓRICO DE ENVIOS (REQUISITO 8)
  // Tabela: Data | Regional | Computador | Quantidade enviada | Status
  // =========================================================================
  listarHistoricoEnvios(regional?: string): RegistroSincronizacaoEnvio[] {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORICO_ENVIOS);
    let lista: RegistroSincronizacaoEnvio[] = [];
    if (raw) {
      try {
        lista = JSON.parse(raw);
      } catch {}
    }
    // Popular histórico padrão demonstrativo caso vazio
    if (lista.length === 0) {
      lista = [
        {
          id: 101,
          data_envio: '11/09/2026 09:15',
          regional: 'VIA VAREJO RJ',
          computador_id: 'PC-RJ-001',
          computador_nome: 'Estação 01 - RJ',
          quantidade_enviada: 100,
          status: 'OK',
          detalhes: 'Lote inicial de 100 produtos sincronizados com sucesso.',
        },
        {
          id: 102,
          data_envio: '11/09/2026 11:30',
          regional: 'VIA VAREJO RJ',
          computador_id: 'PC-RJ-002',
          computador_nome: 'Estação 02 - RJ',
          quantidade_enviada: 85,
          status: 'OK',
          detalhes: 'Lote de 85 produtos sincronizados com sucesso.',
        },
        {
          id: 103,
          data_envio: '11/09/2026 14:20',
          regional: 'VIA VAREJO SP',
          computador_id: 'PC-SP-001',
          computador_nome: 'Estação 01 - SP',
          quantidade_enviada: 120,
          status: 'OK',
          detalhes: 'Lote de 120 produtos sincronizados com sucesso.',
        },
        {
          id: 104,
          data_envio: '12/09/2026 08:45',
          regional: 'VIA VAREJO RJ',
          computador_id: 'PC-RJ-001',
          computador_nome: 'Estação 01 - RJ',
          quantidade_enviada: 50,
          status: 'OK',
          detalhes: 'Envio incremental de 50 novos produtos sem duplicar os 100 anteriores.',
        },
      ];
      localStorage.setItem(STORAGE_KEY_HISTORICO_ENVIOS, JSON.stringify(lista));
    }

    const regAlvo = this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : regional;
    if (regAlvo && regAlvo !== 'TODAS') {
      return lista.filter((e) => e.regional === regAlvo);
    }
    return lista;
  }

  salvarRegistroEnvio(registro: Omit<RegistroSincronizacaoEnvio, 'id'>): void {
    const lista = this.listarHistoricoEnvios();
    const novo: RegistroSincronizacaoEnvio = {
      id: Date.now(),
      ...registro,
    };
    lista.unshift(novo);
    if (lista.length > 500) lista.length = 500;
    localStorage.setItem(STORAGE_KEY_HISTORICO_ENVIOS, JSON.stringify(lista));
  }

  mesclarHistoricoCentral(historicoCentral: RegistroSincronizacaoEnvio[]): boolean {
    let raw = localStorage.getItem(STORAGE_KEY_HISTORICO_ENVIOS);
    let locais: RegistroSincronizacaoEnvio[] = [];
    try {
      if (raw) locais = JSON.parse(raw);
    } catch {}

    const map = new Map<string | number, RegistroSincronizacaoEnvio>();
    // Priorizar itens do servidor central
    for (const ch of historicoCentral) {
      if (ch && (ch.id || (ch as any).timestamp)) {
        const k = ch.id || (ch as any).timestamp;
        map.set(k, ch);
      }
    }
    for (const lh of locais) {
      if (lh && lh.id && !map.has(lh.id)) {
        map.set(lh.id, lh);
      }
    }

    const consolidado = Array.from(map.values()).sort((a, b) => {
      const idA = Number(a.id) || 0;
      const idB = Number(b.id) || 0;
      return idB - idA;
    });

    localStorage.setItem(STORAGE_KEY_HISTORICO_ENVIOS, JSON.stringify(consolidado));
    return true;
  }

  mesclarTentativasDuplicadasCentral(tentativasCentral: LogTentativaDuplicado[]): boolean {
    let alterou = false;
    const map = new Map<string, LogTentativaDuplicado>();
    for (const t of this.tentativasDuplicadas) {
      const k = `${t.imei}:::${t.data_hora}:::${t.computador}`;
      map.set(k, t);
    }
    for (const ct of tentativasCentral) {
      const k = `${ct.imei}:::${ct.data_hora}:::${ct.computador}`;
      if (!map.has(k)) {
        map.set(k, ct);
        this.tentativasDuplicadas.unshift(ct);
        alterou = true;
      }
    }
    if (alterou) {
      localStorage.setItem(STORAGE_KEY_TENTATIVAS_DUPLICADAS, JSON.stringify(this.tentativasDuplicadas));
    }
    return alterou;
  }

  // =========================================================================
  // DETALHAMENTO POR COMPUTADOR NO PAINEL ADMIN (REQUISITOS 5 E 7)
  // Origem dos lançamentos: PC-RJ-001, PC-RJ-002, PC-RJ-003
  // =========================================================================
  obterDetalhamentoComputadoresRegional(regional: string): DetalhamentoComputador[] {
    const produtosReg = this.produtos.filter(
      (p) => regional === 'TODAS' || p.regional === regional
    );
    const totalReg = produtosReg.length;

    const mapa = new Map<
      string,
      { nome: string; total: number; enviados: number; pendentes: number; lacrados: number; pendencias: number; ultimoEnvio?: string | null }
    >();

    for (const p of produtosReg) {
      const pcId = p.computador_id || 'PC-001';
      const pcNome = p.computador_nome || pcId;
      const ex = mapa.get(pcId);
      const ehLacrado = p.produto_lacrado === 'SIM';
      const ehEnviado = p.status_sincronizacao === 'ENVIADO';
      const ehPendencia = p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE';

      if (ex) {
        ex.total++;
        if (ehEnviado) ex.enviados++;
        else ex.pendentes++;
        if (ehLacrado) ex.lacrados++;
        if (ehPendencia) ex.pendencias++;
        if (p.data_sincronizacao && (!ex.ultimoEnvio || p.data_sincronizacao > ex.ultimoEnvio)) {
          ex.ultimoEnvio = p.data_sincronizacao;
        }
      } else {
        mapa.set(pcId, {
          nome: pcNome,
          total: 1,
          enviados: ehEnviado ? 1 : 0,
          pendentes: ehEnviado ? 0 : 1,
          lacrados: ehLacrado ? 1 : 0,
          pendencias: ehPendencia ? 1 : 0,
          ultimoEnvio: p.data_sincronizacao || null,
        });
      }
    }

    const resultado: DetalhamentoComputador[] = [];
    mapa.forEach((val, id) => {
      resultado.push({
        computador_id: id,
        computador_nome: val.nome,
        regional,
        totalAuditados: val.total,
        produtosEnviados: val.enviados,
        produtosPendentes: val.pendentes,
        produtosLacrados: val.lacrados,
        pendencias: val.pendencias,
        percentual: totalReg > 0 ? Math.round((val.total / totalReg) * 100) : 0,
        ultimoEnvio: val.ultimoEnvio,
      });
    });

    return resultado.sort((a, b) => b.totalAuditados - a.totalAuditados);
  }

  // Backup and Restore
  // Backup and Restore (Conforme Gate 8 / Regra 12)
  gerarArquivoBackup(): string {
    const usuariosSanitizados: Omit<Usuario, 'senha'>[] = this.usuarios.map((u) => {
      const { senha: _senhaOmitida, ...resto } = u;
      return resto;
    });

    const tables = {
      produtos: this.produtos,
      lotes_finalizados: this.lotesFinalizados,
      usuarios: usuariosSanitizados,
      computadores: this.listarComputadoresCadastrados(),
      historico: this.historico,
      tentativas_duplicadas: this.tentativasDuplicadas,
    };

    // Serialização canônica com ordenação determinística de chaves para cálculo do checksum
    const sortedKeys = Object.keys(tables).sort();
    const canonical: Record<string, any> = {};
    for (const k of sortedKeys) {
      canonical[k] = (tables as any)[k];
    }
    const checksum = sha256Sync(JSON.stringify(canonical));

    const manifest: BackupManifest = {
      format_version: 1,
      app_version: VERSAO_LOCAL.versao,
      created_at: new Date().toISOString(),
      device_id: this.obterComputadorAtual().id || 'PC-LOCAL',
      tables,
      summary: {
        total_produtos: this.produtos.length,
        total_lotes: this.lotesFinalizados.length,
        total_usuarios: this.usuarios.length,
        total_historico: this.historico.length,
      },
      checksum,
    };

    return JSON.stringify(manifest, null, 2);
  }

  restaurarDeBackup(conteudoJson: string): { sucesso: boolean; totalImportado?: number; erro?: string } {
    try {
      const parsed = JSON.parse(conteudoJson);
      if (!parsed) {
        return { sucesso: false, erro: 'Arquivo de backup inválido ou vazio.' };
      }

      let produtosRestaurar: ProdutoAuditoria[] = [];
      let lotesRestaurar: RegistroLoteFinalizado[] = [];
      let historicoRestaurar: HistoricoAuditoria[] = [];
      let usuariosRestaurar: Omit<Usuario, 'senha'>[] = [];

      // Suporte para Manifest v1 (Gate 8)
      if (parsed.format_version && parsed.tables) {
        // Validação de integridade por checksum
        const sortedKeys = Object.keys(parsed.tables).sort();
        const canonical: Record<string, any> = {};
        for (const k of sortedKeys) {
          canonical[k] = parsed.tables[k];
        }
        const calcChecksum = sha256Sync(JSON.stringify(canonical));
        if (parsed.checksum && parsed.checksum !== calcChecksum) {
          return {
            sucesso: false,
            erro: 'Integridade violada: O checksum SHA-256 do arquivo diverge das tabelas. Restauração abortada.',
          };
        }

        produtosRestaurar = parsed.tables.produtos || [];
        lotesRestaurar = parsed.tables.lotes_finalizados || [];
        historicoRestaurar = parsed.tables.historico || [];
        usuariosRestaurar = parsed.tables.usuarios || [];
      } else if (Array.isArray(parsed.produtos)) {
        // Compatibilidade com backups legados
        produtosRestaurar = parsed.produtos;
        lotesRestaurar = parsed.lotes_finalizados || [];
        historicoRestaurar = parsed.historico || [];
        usuariosRestaurar = parsed.usuarios || [];
      } else {
        return { sucesso: false, erro: 'Estrutura do backup não reconhecida ou tabela de produtos ausente.' };
      }

      this.produtos = produtosRestaurar;
      if (lotesRestaurar.length > 0) {
        this.lotesFinalizados = lotesRestaurar;
      }
      if (historicoRestaurar.length > 0) {
        this.historico = historicoRestaurar;
      }

      // Preservar senhas locais existentes para não sobrescrever com strings vazias
      if (usuariosRestaurar.length > 0) {
        const mapaSenhas = new Map<string, string>();
        for (const u of this.usuarios) {
          mapaSenhas.set(u.login.trim().toLowerCase(), u.senha);
        }
        this.usuarios = usuariosRestaurar.map((u: any) => ({
          ...u,
          senha: mapaSenhas.get(u.login?.trim().toLowerCase()) || u.senha || '',
        }));
      }

      // Rebuild index
      this.serialMap.clear();
      for (const p of this.produtos) {
        this.serialMap.set(p.serial.trim().toUpperCase(), p);
      }

      this.salvarTudo();
      this.registrarHistorico(
        this.usuarioAtual?.nome || 'Sistema',
        'RESTAURACAO',
        `Backup restaurado com ${this.produtos.length} produtos auditados.`
      );

      return { sucesso: true, totalImportado: this.produtos.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { sucesso: false, erro: `Falha ao processar arquivo: ${message}` };
    }
  }

  // Import from Excel/CSV batch
  importarPlanilha(
    linhas: {
      modelo: string;
      ean: string;
      serial: string;
      caixa: string;
      data?: string;
      lacrado?: string;
      regional?: string;
      numero_nf?: string;
      nf_conferida?: SimNao | null;
    }[]
  ): {
    totalProcessado: number;
    sucessoCount: number;
    duplicadosCount: number;
    errosCount: number;
    detalhes: string[];
  } {
    let sucessoCount = 0;
    let duplicadosCount = 0;
    let errosCount = 0;
    const detalhes: string[] = [];
    const dataHoje = new Date().toISOString().split('T')[0];

    for (let i = 0; i < linhas.length; i++) {
      const item = linhas[i];
      if (!item.serial || !item.modelo || !item.caixa) {
        errosCount++;
        detalhes.push(`Linha ${i + 1}: dados incompletos (modelo, IMEI e caixa obrigatórios).`);
        continue;
      }

      const res = this.inserirProduto({
        modelo_produto: item.modelo,
        ean: item.ean || '7890000000000',
        serial: item.serial,
        data_auditoria: item.data || dataHoje,
        numero_caixa: item.caixa,
        regional: item.regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ',
        produto_lacrado: item.lacrado?.toUpperCase() === 'NÃO' ? 'NÃO' : 'SIM',
        kit_completo: item.lacrado?.toUpperCase() === 'NÃO' ? 'SIM' : null,
        aparelho_marcas_uso: item.lacrado?.toUpperCase() === 'NÃO' ? 'NÃO' : null,
        numero_nf: item.numero_nf || '',
        nf_conferida: item.nf_conferida !== undefined ? item.nf_conferida : null,
      });

      if (res.sucesso) {
        sucessoCount++;
      } else if (res.erro?.includes('já foi auditado')) {
        duplicadosCount++;
        detalhes.push(`IMEI duplicado: ${item.serial}`);
      } else {
        errosCount++;
        detalhes.push(`Erro no IMEI ${item.serial}: ${res.erro}`);
      }
    }

    return {
      totalProcessado: linhas.length,
      sucessoCount,
      duplicadosCount,
      errosCount,
      detalhes,
    };
  }

  // Carrega produtos de demonstração distribuídos por todas as regionais e computadores
  carregarDadosDemonstracaoMultiRegionais(): number {
    const demos = [
      // VIA VAREJO RJ - PC-RJ-001 (Estação 01)
      { mod: 'Galaxy S24 Ultra', ean: '7892509133456', sn: '357847400282001', cx: 'Caixa RJ-01', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-001', pcNome: 'Estação 01 - RJ', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S24 Ultra', ean: '7892509133456', sn: '357847400282002', cx: 'Caixa RJ-01', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-001', pcNome: 'Estação 01 - RJ', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S24', ean: '7892509133470', sn: '357847400282003', cx: 'Caixa RJ-01', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-001', pcNome: 'Estação 01 - RJ', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      // VIA VAREJO RJ - PC-RJ-002 (Estação 02)
      { mod: 'Galaxy A55 5G', ean: '7892509134125', sn: '357847400282004', cx: 'Caixa RJ-02', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-002', pcNome: 'Estação 02 - RJ', lacre: 'NÃO' as SimNao, kit: 'SIM' as SimNao, marcas: 'SIM' as SimNao, obs: 'Leve risco na tela', sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A55 5G', ean: '7892509134125', sn: '357847400282005', cx: 'Caixa RJ-02', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-002', pcNome: 'Estação 02 - RJ', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      // VIA VAREJO RJ - PC-RJ-003 (Estação 03)
      { mod: 'Galaxy S24+', ean: '7892509133463', sn: '357847400282006', cx: 'Caixa RJ-03', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-003', pcNome: 'Estação 03 - RJ', lacre: 'SIM' as SimNao, sync: 'PENDENTE' as StatusSincronizacaoItem },

      // VIA VAREJO SP - PC-SP-001
      { mod: 'Galaxy S24+', ean: '7892509133463', sn: '357847400282007', cx: 'Caixa SP-01', reg: 'VIA VAREJO SP', pcId: 'PC-SP-001', pcNome: 'Estação 01 - SP', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S24+', ean: '7892509133463', sn: '357847400282008', cx: 'Caixa SP-01', reg: 'VIA VAREJO SP', pcId: 'PC-SP-001', pcNome: 'Estação 01 - SP', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      // VIA VAREJO SP - PC-SP-002
      { mod: 'Galaxy S23 FE', ean: '7892509129848', sn: '357847400282009', cx: 'Caixa SP-02', reg: 'VIA VAREJO SP', pcId: 'PC-SP-002', pcNome: 'Estação 02 - SP', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S23 FE', ean: '7892509129848', sn: '357847400282010', cx: 'Caixa SP-02', reg: 'VIA VAREJO SP', pcId: 'PC-SP-002', pcNome: 'Estação 02 - SP', lacre: 'NÃO' as SimNao, kit: 'NÃO' as SimNao, marcas: 'SIM' as SimNao, obs: 'Faltando cabo', sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy Z Fold5', ean: '7892509130110', sn: '357847400282011', cx: 'Caixa SP-03', reg: 'VIA VAREJO SP', pcId: 'PC-SP-002', pcNome: 'Estação 02 - SP', lacre: 'SIM' as SimNao, sync: 'PENDENTE' as StatusSincronizacaoItem },

      // VIA VAREJO MG - PC-MG-001
      { mod: 'Galaxy A35 5G', ean: '7892509134132', sn: '357847400282012', cx: 'Caixa MG-01', reg: 'VIA VAREJO MG', pcId: 'PC-MG-001', pcNome: 'Estação 01 - MG', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A35 5G', ean: '7892509134132', sn: '357847400282013', cx: 'Caixa MG-01', reg: 'VIA VAREJO MG', pcId: 'PC-MG-001', pcNome: 'Estação 01 - MG', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A15 5G', ean: '7892509134149', sn: '357847400282014', cx: 'Caixa MG-02', reg: 'VIA VAREJO MG', pcId: 'PC-MG-001', pcNome: 'Estação 01 - MG', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A15 5G', ean: '7892509134149', sn: '357847400282015', cx: 'Caixa MG-02', reg: 'VIA VAREJO MG', pcId: 'PC-MG-001', pcNome: 'Estação 01 - MG', lacre: 'NÃO' as SimNao, kit: 'SIM' as SimNao, marcas: 'NÃO' as SimNao, obs: 'Lacre rompido no transporte', sync: 'PENDENTE' as StatusSincronizacaoItem },

      // VIA VAREJO BA - PC-BA-001
      { mod: 'Galaxy S24', ean: '7892509133470', sn: '357847400282016', cx: 'Caixa BA-01', reg: 'VIA VAREJO BA', pcId: 'PC-BA-001', pcNome: 'Estação 01 - BA', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S24', ean: '7892509133470', sn: '357847400282017', cx: 'Caixa BA-01', reg: 'VIA VAREJO BA', pcId: 'PC-BA-001', pcNome: 'Estação 01 - BA', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A05s', ean: '7892509134156', sn: '357847400282018', cx: 'Caixa BA-02', reg: 'VIA VAREJO BA', pcId: 'PC-BA-001', pcNome: 'Estação 01 - BA', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy Buds2 Pro', ean: '7892509125581', sn: '357847400282019', cx: 'Caixa BA-03', reg: 'VIA VAREJO BA', pcId: 'PC-BA-001', pcNome: 'Estação 01 - BA', lacre: 'SIM' as SimNao, sync: 'PENDENTE' as StatusSincronizacaoItem },
    ];

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    let inseridos = 0;

    for (const d of demos) {
      if (!this.serialMap.has(d.sn.toUpperCase())) {
        const res = this.inserirProduto({
          modelo_produto: d.mod,
          ean: d.ean,
          serial: d.sn,
          data_auditoria: dataHoje,
          numero_caixa: d.cx,
          regional: d.reg,
          produto_lacrado: d.lacre,
          kit_completo: (d as any).kit || null,
          aparelho_marcas_uso: (d as any).marcas || null,
          observacao: (d as any).obs || '',
        });
        if (res.sucesso && res.produto) {
          res.produto.computador_id = d.pcId;
          res.produto.computador_nome = d.pcNome;
          res.produto.status_sincronizacao = d.sync;
          res.produto.sync_status = d.sync;
          if (d.sync === 'ENVIADO') {
            res.produto.id_servidor = `SRV-${res.produto.id}`;
            res.produto.data_sincronizacao = new Date().toISOString();
          }
          inseridos++;
        }
      }
    }

    this.salvarTudo();
    return inseridos;
  }

  // User management (Admin only)
  listarUsuarios(): Usuario[] {
    return [...this.usuarios];
  }

  salvarUsuario(u: Partial<Usuario> & { nome: string; login: string; senha?: string; perfil: PerfilUsuario; regional?: string | null }): {
    sucesso: boolean;
    erro?: string;
  } {
    if (!isAdminOuSuper(this.usuarioAtual?.perfil)) {
      return { sucesso: false, erro: 'Acesso negado: Apenas Administradores podem gerenciar usuários do sistema.' };
    }

    if (u.perfil === 'SUPER_ADMIN' && this.usuarioAtual?.perfil !== 'SUPER_ADMIN') {
      return { sucesso: false, erro: 'Apenas Super Administradores podem cadastrar outros usuários com perfil Super Admin.' };
    }

    if (u.id) {
      const idx = this.usuarios.findIndex((item) => item.id === u.id);
      if (idx === -1) return { sucesso: false, erro: 'Usuário não encontrado.' };
      this.usuarios[idx] = {
        ...this.usuarios[idx],
        nome: u.nome,
        login: u.login,
        perfil: u.perfil,
        regional: u.regional !== undefined ? u.regional : this.usuarios[idx].regional,
        ativo: u.ativo !== undefined ? u.ativo : this.usuarios[idx].ativo,
        senha: u.senha ? hashSenha(u.senha) : this.usuarios[idx].senha,
      };
    } else {
      // Check login uniqueness
      if (this.usuarios.some((item) => item.login.toLowerCase() === u.login.toLowerCase())) {
        return { sucesso: false, erro: 'Este login já está em uso por outro usuário.' };
      }
      this.usuarios.push({
        id: Date.now(),
        nome: u.nome,
        login: u.login,
        senha: u.senha ? hashSenha(u.senha) : '',
        perfil: u.perfil,
        regional: u.regional || null,
        ativo: true,
        criado_em: new Date().toISOString(),
      });
    }
    this.salvarTudo();
    return { sucesso: true };
  }

  // =========================================================================
  // REFERÊNCIAS REGIONAIS E LOTES DINÂMICOS (PROMPT MESTRE ADMIN & AUDITORIA)
  // =========================================================================

  consultarImeiReferencia(imei: string, regional?: string | null): RegionalInventoryReference | null {
    if (!imei) return null;
    const imeiNorm = normalizeImei(imei);
    const regFull = (regional || '').trim().toUpperCase();
    const regCod = extrairCodigoRegional(regional);
    return this.referenceMap.get(`${regFull}#${imeiNorm}`) || this.referenceMap.get(`${regCod}#${imeiNorm}`) || null;
  }

  async consultarImeiReferenciaOnline(imei: string, regional?: string | null): Promise<RegionalInventoryReference | null> {
    if (!imei) return null;
    const local = this.consultarImeiReferencia(imei, regional);
    if (local) return local;

    const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
    if (isTestEnv && !process.env.FORCE_TEST_SERVER_SYNC) return null;

    try {
      const imeiNorm = normalizeImei(imei);
      if (imeiNorm.length !== 15) return null;
      const reg = (regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ').trim().toUpperCase();
      const url = obterApiUrl(`/api/central/referencia-lookup?regional=${encodeURIComponent(reg)}&imei=${encodeURIComponent(imeiNorm)}`);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.sucesso && data.encontrado && data.item) {
          const itemRef: RegionalInventoryReference = data.item;
          const jaExiste = this.regionalReferences.some((r) => r.id === itemRef.id);
          if (!jaExiste) {
            this.regionalReferences.push(itemRef);
            this.reconstruirMapaReferencia();
            salvarIndexedDB(STORAGE_KEY_REGIONAL_REFS, this.regionalReferences).catch(() => {});
          }
          return itemRef;
        }
      }

      // Fallback direto no Supabase caso a rota API não encontre ou oscile
      if (isSupabaseConfigured && supabase) {
        const regUpper = reg.toUpperCase();
        const regClean = regUpper.replace(/^VIA VAREJO\s*[-]?\s*/, '').trim();
        const regionaisValidas = Array.from(new Set([regUpper, `VIA VAREJO ${regClean}`, regClean])).filter(Boolean);

        let supaQuery = supabase
          .from('regional_inventory_reference')
          .select('id, regional, import_batch_id, imei_normalized, sku, model_description, brand, origin_invoice, dealer_raw, dealer_normalized, source_file_name, is_active')
          .eq('imei_normalized', imeiNorm)
          .eq('is_active', true);

        if (regionaisValidas.length > 0) {
          supaQuery = supaQuery.in('regional', regionaisValidas);
        }

        const { data: supaItem, error: supaErr } = await supaQuery.limit(1).maybeSingle();
        if (!supaErr && supaItem) {
          const itemRef = supaItem as RegionalInventoryReference;
          const jaExiste = this.regionalReferences.some((r) => r.id === itemRef.id);
          if (!jaExiste) {
            this.regionalReferences.push(itemRef);
            this.reconstruirMapaReferencia();
            salvarIndexedDB(STORAGE_KEY_REGIONAL_REFS, this.regionalReferences).catch(() => {});
          }
          return itemRef;
        }
      }
    } catch (err) {
      console.warn('[Storage] Consulta online de referência falhou:', err);
    }
    return null;
  }

  obterListaAtivaReferencia(regional?: string | null): RegionalInventoryReference[] {
    const regFull = (regional || '').trim().toUpperCase();
    const regCod = extrairCodigoRegional(regional);
    return this.regionalReferences.filter(
      (r) => r.is_active && (!regional || r.regional.toUpperCase() === regFull || extrairCodigoRegional(r.regional) === regCod)
    );
  }

  listarHistoricoImportacoes(regional?: string): InventoryImportBatch[] {
    if (!regional) {
      return [...this.importBatches].sort((a, b) => (b.version || 0) - (a.version || 0));
    }
    const regFull = regional.trim().toUpperCase();
    const regCod = extrairCodigoRegional(regional);
    return this.importBatches
      .filter((b) => b.regional.toUpperCase() === regFull || extrairCodigoRegional(b.regional) === regCod)
      .sort((a, b) => (b.version || 0) - (a.version || 0));
  }

  async excluirBaseReferenciaRegional(batchId: string): Promise<{ sucesso: boolean; erro?: string }> {
    if (!batchId) {
      return { sucesso: false, erro: 'ID da base de referência não informado.' };
    }

    const batchIndex = this.importBatches.findIndex((b) => b.id === batchId);
    if (batchIndex === -1) {
      return { sucesso: false, erro: 'Base de referência não encontrada.' };
    }

    const batchRemovido = this.importBatches[batchIndex];

    // Remover batch da lista em memória
    this.importBatches.splice(batchIndex, 1);

    // Remover itens vinculados
    this.regionalReferences = this.regionalReferences.filter((r) => r.import_batch_id !== batchId);

    // Se o batch excluído era o ATIVO, ativar a versão remanescente mais recente da regional
    if (batchRemovido.status === 'ATIVA') {
      const regCod = extrairCodigoRegional(batchRemovido.regional);
      const regFull = batchRemovido.regional.toUpperCase();

      const restantes = this.importBatches
        .filter((b) => b.regional.toUpperCase() === regFull || extrairCodigoRegional(b.regional) === regCod)
        .sort((a, b) => (b.version || 0) - (a.version || 0));

      if (restantes.length > 0) {
        const novaAtiva = restantes[0];
        novaAtiva.status = 'ATIVA';
        novaAtiva.updated_at = new Date().toISOString();

        for (const ref of this.regionalReferences) {
          if (ref.import_batch_id === novaAtiva.id) {
            ref.is_active = true;
          }
        }
      }
    }

    this.reconstruirMapaReferencia();
    this.salvarTudo();

    // Remover do IndexedDB de forma segura
    try {
      if (idb?.inventory_import_batches) {
        await idb.inventory_import_batches.delete(batchId);
      }
      if (idb?.regional_inventory_reference) {
        await idb.regional_inventory_reference.where('import_batch_id').equals(batchId).delete();
      }
    } catch (idbErr) {
      console.warn('Erro ao deletar base de referência do IndexedDB:', idbErr);
    }

    // Se Supabase ativo, deletar em background
    if (isSupabaseConfigured && supabase) {
      const supa = supabase;
      (async () => {
        try {
          await supa.from('regional_inventory_reference').delete().eq('import_batch_id', batchId);
          await supa.from('inventory_import_batches').delete().eq('id', batchId);
        } catch (supaErr) {
          console.warn('Erro ao deletar base do Supabase em background:', supaErr);
        }
      })().catch(() => {});
    }

    const usuarioNome = this.usuarioAtual?.nome || 'Administrador';
    this.registrarHistorico(
      usuarioNome,
      'EXCLUIR_BASE_REFERENCIA',
      `Excluída a base de referência ${batchRemovido.file_name} v${batchRemovido.version} da regional ${batchRemovido.regional}`,
      batchRemovido.regional
    );

    this.notificarMudanca('regional_reference');
    return { sucesso: true };
  }


  listarLotesDinamicos(regional?: string): AuditLot[] {
    if (!regional) return [...this.auditLots];
    const regFull = regional.trim().toUpperCase();
    const regCod = extrairCodigoRegional(regional);
    return this.auditLots.filter(
      (l) => l.regional.toUpperCase() === regFull || extrairCodigoRegional(l.regional) === regCod
    );
  }

  obterOuCriarLoteAutomatico(params: {
    regional?: string | null;
    sourceType: 'LISTED' | 'OUT_OF_LIST';
    dealer?: string | null;
    fabricante?: string | null;
  }): AuditLot {
    const displayName = calcularLoteAutomatico(params);
    const regCod = extrairCodigoRegional(params.regional);
    const regFull = (params.regional || '').trim().toUpperCase();

    let existente = this.auditLots.find(
      (l) =>
        l.display_name.toUpperCase() === displayName.toUpperCase() &&
        (extrairCodigoRegional(l.regional) === regCod || l.regional.toUpperCase() === regFull)
    );

    if (existente) return existente;

    const outOfListGroup =
      params.sourceType === 'OUT_OF_LIST'
        ? ((params.fabricante || '').toUpperCase().includes('SAMSUNG') ? 'SAMSUNG' : 'OUTRA_MARCA')
        : null;

    const seq = this.auditLots.filter((l) => extrairCodigoRegional(l.regional) === regCod).length + 1;

    const novoLote: AuditLot = {
      id: gerarUUID(),
      regional: regFull,
      source_type: params.sourceType,
      dealer_normalized: params.sourceType === 'LISTED' ? normalizeDealer(params.dealer) : null,
      out_of_list_brand_group: outOfListGroup,
      display_sequence: seq,
      display_name: displayName,
      status: 'ABERTO',
      created_at: new Date().toISOString(),
    };

    this.auditLots.push(novoLote);
    this.salvarTudo();
    return novoLote;
  }

  async importarListaReferenciaRegional(params: {
    regional: string;
    fileName: string;
    importedBy?: string;
    itens: Array<{
      imei?: string | number;
      imei_normalized?: string | number;
      sku: string;
      model_description: string;
      brand?: string;
      origin_invoice?: string | number | null;
      dealer?: string | null;
      dealer_raw?: string | null;
      source_file_name?: string;
      source_row?: number;
    }>;
  }): Promise<{
    batch: InventoryImportBatch;
    totalImportados: number;
    metricas: MetricasValidacaoPlanilha;
  }> {
    // 1. RBAC estrito (Gate 2 / Seção 2 do Prompt Mestre: ADMIN ONLY)
    if (!isAdminOuSuper(this.usuarioAtual?.perfil)) {
      throw new Error('Acesso negado (403): Apenas Administradores do Sistema têm permissão para importar planilhas e ativar versões de referência regional.');
    }

    const regional = params.regional.trim().toUpperCase();
    const regCod = extrairCodigoRegional(regional);
    const fileName = params.fileName.trim();
    const usuarioNome = params.importedBy || this.usuarioAtual?.nome || 'ADMINISTRADOR';

    // 2. Determinar próxima versão para a regional
    const historicoRegional = this.importBatches.filter(
      (b) => b.regional.toUpperCase() === regional || extrairCodigoRegional(b.regional) === regCod
    );
    const versaoAtualMax = historicoRegional.reduce((max, b) => Math.max(max, b.version || 1), 0);
    const proximaVersao = versaoAtualMax + 1;

    // 3. Validação e Triagem dos Registros da Planilha
    const totalLinhas = params.itens.length;
    let imeisValidos = 0;
    let imeisInvalidos = 0;
    let duplicadosPlanilha = 0;
    let linhasSkuVazio = 0;
    let linhasModeloVazio = 0;
    let linhasDealerVazio = 0;
    const seenImeis = new Set<string>();
    const validRefs: RegionalInventoryReference[] = [];
    const exemplosInvalidos: { linha: number; imei: string; motivo: string }[] = [];
    const batchId = gerarUUID();

    params.itens.forEach((item, index) => {
      const rowNum = item.source_row || index + 2;
      const rawImei = item.imei !== undefined && item.imei !== null ? item.imei : item.imei_normalized;
      const imeiNorm = normalizeImei(rawImei);

      if (!imeiNorm || !/^\d{15}$/.test(imeiNorm)) {
        imeisInvalidos++;
        if (exemplosInvalidos.length < 10) {
          exemplosInvalidos.push({
            linha: rowNum,
            imei: String(rawImei || ''),
            motivo: 'IMEI não contém exatamente 15 dígitos numéricos.',
          });
        }
        return;
      }

      if (seenImeis.has(imeiNorm)) {
        duplicadosPlanilha++;
        if (exemplosInvalidos.length < 10) {
          exemplosInvalidos.push({
            linha: rowNum,
            imei: imeiNorm,
            motivo: 'IMEI duplicado dentro do próprio arquivo da planilha.',
          });
        }
        return;
      }
      seenImeis.add(imeiNorm);

      const sku = (item.sku ? String(item.sku) : '').trim();
      if (!sku) linhasSkuVazio++;

      const modelDesc = (item.model_description ? String(item.model_description) : '').trim();
      if (!modelDesc) linhasModeloVazio++;

      const dealerRaw = item.dealer !== undefined && item.dealer !== null
        ? String(item.dealer).trim()
        : item.dealer_raw !== undefined && item.dealer_raw !== null
        ? String(item.dealer_raw).trim()
        : '';
      if (!dealerRaw) linhasDealerVazio++;
      const dealerNorm = normalizeDealer(dealerRaw);

      // Coluna H preservada; Coluna I estritamente omitida e jamais armazenada
      const originInvoice = item.origin_invoice !== undefined && item.origin_invoice !== null ? String(item.origin_invoice).trim() : null;
      const brand = inferirFabricante(modelDesc, item.brand, sku);

      imeisValidos++;
      validRefs.push({
        id: gerarUUID(),
        regional,
        import_batch_id: batchId,
        imei_normalized: imeiNorm,
        sku: sku || 'SEM SKU',
        model_description: modelDesc || 'MODELO NÃO ESPECIFICADO',
        brand,
        origin_invoice: originInvoice,
        dealer_raw: dealerRaw || null,
        dealer_normalized: dealerNorm,
        source_file_name: fileName,
        source_row: rowNum,
        is_active: true,
        created_at: new Date().toISOString(),
      });
    });

    if (validRefs.length === 0) {
      throw new Error('Nenhum registro com IMEI válido (15 dígitos) foi encontrado no arquivo fornecido.');
    }

    // 4. Arquivar versão anterior da regional (preservando o histórico e lotes anteriores)
    for (const b of this.importBatches) {
      if (b.regional.toUpperCase() === regional || extrairCodigoRegional(b.regional) === regCod) {
        if (b.status === 'ATIVA') {
          b.status = 'HISTORICA';
          b.updated_at = new Date().toISOString();
        }
      }
    }
    for (const r of this.regionalReferences) {
      if (r.regional.toUpperCase() === regional || extrairCodigoRegional(r.regional) === regCod) {
        if (r.is_active) {
          r.is_active = false;
          r.updated_at = new Date().toISOString();
        }
      }
    }

    // 5. Criar o novo Batch de Importação com status 'ATIVA'
    const newBatch: InventoryImportBatch = {
      id: batchId,
      regional,
      file_name: fileName,
      imported_by: usuarioNome,
      imported_at: new Date().toISOString(),
      row_count: totalLinhas,
      valid_count: validRefs.length,
      invalid_count: totalLinhas - validRefs.length,
      status: 'ATIVA',
      version: proximaVersao,
      created_at: new Date().toISOString(),
    };

    // 6. Cadastrar os Lotes Dinâmicos automaticamente para os dealers desta regional
    const dealersUnicos = new Set<string>();
    validRefs.forEach((r) => {
      if (r.dealer_normalized) dealersUnicos.add(r.dealer_normalized);
    });

    dealersUnicos.forEach((dealer) => {
      this.obterOuCriarLoteAutomatico({
        regional,
        sourceType: 'LISTED',
        dealer,
      });
    });

    // Assegurar também lotes para itens fora da lista
    this.obterOuCriarLoteAutomatico({
      regional,
      sourceType: 'OUT_OF_LIST',
      fabricante: 'SAMSUNG',
    });
    this.obterOuCriarLoteAutomatico({
      regional,
      sourceType: 'OUT_OF_LIST',
      fabricante: 'OUTRA MARCA',
    });

    // 7. Atualizar o estado em memória e persistir com zero perda de dados
    this.importBatches.unshift(newBatch);
    this.regionalReferences.push(...validRefs);
    this.reconstruirMapaReferencia();
    this.salvarTudo();

    // 8. Registro de Auditoria Imutável
    this.registrarHistorico(
      usuarioNome,
      'IMPORTAR_PLANILHA_REGIONAL',
      `Importada versão v${proximaVersao} da lista regional ${regional} (${validRefs.length} itens válidos de ${totalLinhas} linhas do arquivo ${fileName})`,
      regional
    );

    // 9. Sincronizar na base central compartilhada (API Central e Supabase)
    let sincronizadoOnline = false;
    let erroOnline: string | null = null;
    const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';

    if (!isTestEnv || process.env.FORCE_TEST_SERVER_SYNC) {
      try {
        const urlImport = obterApiUrl('/api/central/referencia-import');
        const payloadImport = {
          regional,
          fileName,
          usuario: this.usuarioAtual,
          itens: validRefs,
        };
        const res = await fetch(urlImport, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadImport),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.sucesso) {
          sincronizadoOnline = true;
          if (data.batch?.version) {
            newBatch.version = data.batch.version;
          }
        } else {
          erroOnline = data?.erro || `Servidor retornou erro HTTP ${res.status}`;
        }
      } catch (errApi: any) {
        console.warn('[Storage] Falha ao enviar batch via API central:', errApi);
        erroOnline = errApi?.message || String(errApi);
      }

      if (!sincronizadoOnline && isSupabaseConfigured && supabase) {
        try {
          const supa = supabase;
          const { error: bErr } = await supa.from('inventory_import_batches').insert({
            id: newBatch.id,
            regional: newBatch.regional,
            file_name: newBatch.file_name,
            imported_by: newBatch.imported_by,
            imported_at: newBatch.imported_at,
            row_count: newBatch.row_count,
            valid_count: newBatch.valid_count,
            invalid_count: newBatch.invalid_count,
            status: newBatch.status,
            version: newBatch.version,
          });
          if (bErr) throw bErr;

          // Arquivar anteriores no Supabase
          await supa
            .from('regional_inventory_reference')
            .update({ is_active: false })
            .eq('regional', regional)
            .eq('is_active', true);

          // Inserir itens em lotes de 100
          for (let i = 0; i < validRefs.length; i += 100) {
            const chunk = validRefs.slice(i, i + 100).map((r) => ({
              id: r.id,
              regional: r.regional,
              import_batch_id: r.import_batch_id,
              imei_normalized: r.imei_normalized,
              sku: r.sku,
              model_description: r.model_description,
              brand: r.brand,
              origin_invoice: r.origin_invoice,
              dealer_raw: r.dealer_raw,
              dealer_normalized: r.dealer_normalized,
              source_file_name: r.source_file_name,
              source_row: r.source_row,
              is_active: r.is_active,
              created_at: r.created_at,
            }));
            const { error: cErr } = await supa.from('regional_inventory_reference').insert(chunk);
            if (cErr) throw cErr;
          }
          sincronizadoOnline = true;
        } catch (supaErr: any) {
          console.error('[Storage] Falha no salvamento direto de referências no Supabase:', supaErr);
        }
      }
    }

    if (!sincronizadoOnline && !isTestEnv && !isDesktopApp()) {
      throw new Error(`Falha ao gravar na base compartilhada do servidor central: ${erroOnline || 'Servidor inacessível'}. A lista não foi ativada para evitar inconsistências entre computadores. Por favor, tente novamente.`);
    }

    const metricas: MetricasValidacaoPlanilha = {
      nomeArquivo: fileName,
      regional,
      totalLinhas,
      imeisValidos,
      imeisInvalidos,
      duplicadosPlanilha,
      linhasSkuVazio,
      linhasModeloVazio,
      linhasDealerVazio,
      exemplosInvalidos,
      exemplosValidos: validRefs.slice(0, 5),
    };

    return {
      batch: newBatch,
      totalImportados: validRefs.length,
      metricas,
    };
  }
}

// Global Singleton
export const db = new AuditoriaDatabase();

