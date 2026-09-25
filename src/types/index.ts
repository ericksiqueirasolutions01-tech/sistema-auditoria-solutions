export type SimNao = 'SIM' | 'NÃO';

export type StatusSincronizacaoItem = 'PENDENTE' | 'ENVIADO' | 'ERRO_DUPLICADO' | 'PENDENTE_ENVIO';

export type StatusEstacao =
  | 'ESTACAO_ATIVADA'
  | 'SINCRONIZANDO'
  | 'PENDENCIAS_ENVIO'
  | 'ESTACAO_NAO_ATIVADA';

export interface DeviceActivation {
  device_id: string;
  nome_maquina: string;
  usuario_responsavel: string;
  regional_vinculada: string;
  data_ativacao: string;
  ultima_sincronizacao: string;
  versao_sistema: string;
  versao_base_referencia: number | string;
  device_activated: boolean;
}

export interface InfoStatusEstacao {
  status: StatusEstacao;
  rotulo: string;
  descricao: string;
  cor: 'verde' | 'azul' | 'amarelo' | 'vermelho';
  pendentes: number;
  ultimaSincronizacao: string | null;
  ultimoEnvio: string | null;
  ultimaComunicacao: string | null;
  ativada: boolean;
  detalhesAtivacao: DeviceActivation | null;
}

export interface DetalheImeiDuplicado {
  imei: string;
  serial: string;
  modelo_produto?: string;
  numero_caixa?: string;
  data_cadastro_existente?: string;
  usuario_existente?: string;
  computador_existente?: string;
  regional_existente?: string;
  status: 'DUPLICADO NO SERVIDOR';
  id_local?: number;
}

export interface LogTentativaDuplicado {
  id: number;
  usuario: string;
  data_hora: string;
  imei: string;
  computador: string;
  resultado: string; // Ex: 'BLOQUEADO: IMEI JÁ CADASTRADO NO SERVIDOR'
  regional?: string;
  data_cadastro_existente?: string;
  usuario_existente?: string;
}

export interface ResultadoSincronizacao {
  sucesso: boolean;
  totalSincronizados: number;
  duplicadosEvitados: number;
  itensDuplicados: DetalheImeiDuplicado[];
  timestamp: string;
  mensagem: string;
}

export interface ResultadoExclusaoDuplicadosServidor {
  sucesso: boolean;
  mensagem: string;
  removidos: number;
  duplicadosIdentificados?: any[];
  totalRestante?: number;
  timestamp?: string;
  erro?: string;
}

export type DeviceStatus = 'ATIVO' | 'PENDENTE' | 'REVOGADO';

export interface ComputadorInfo {
  id: string; // Ex: 'PC-RJ-001'
  device_id?: string; // UUID v4 emitido pelo servidor/sistema
  nome: string; // Ex: 'Estação de Bipagem 01'
  regional: string; // Ex: 'VIA VAREJO RJ'
  data_primeiro_uso: string; // Data ISO
  status?: DeviceStatus; // 'ATIVO' | 'PENDENTE' | 'REVOGADO'
  app_version?: string;
  last_seen_at?: string;
  revoked_at?: string | null;
}

export interface RegistroSincronizacaoEnvio {
  id: number;
  data_envio: string;
  regional: string;
  computador_id: string;
  computador_nome: string;
  quantidade_enviada: number;
  status: 'OK' | 'ERRO';
  detalhes?: string;
  produtos_ids?: number[];
}

export interface DetalhamentoComputador {
  computador_id: string;
  computador_nome: string;
  regional: string;
  totalAuditados: number;
  produtosEnviados: number;
  produtosPendentes: number;
  produtosLacrados: number;
  pendencias: number;
  percentual: number;
  ultimoEnvio?: string | null;
}

export interface ProdutoAuditoria {
  id: number; // ID Local
  id_local?: number; // Equivalente explícito a id
  id_servidor: string | null; // ID atribuído no servidor após sincronização
  uuid: string;
  regional: string; // Ex: 'VIA VAREJO RJ', 'VIA VAREJO SP', 'VIA VAREJO MG', 'VIA VAREJO BA'
  fabricante: string; // Marca real do produto (ex: SAMSUNG, MOTOROLA, OPPO, JOVI, etc.)
  modelo_produto: string;
  ean: string;
  serial: string; // Mantido para compatibilidade de sincronização e banco legado
  imei?: string; // Código IMEI oficial (15 dígitos numéricos)
  data_auditoria: string;
  numero_caixa: string;
  numero_lote?: string; // Número do Lote (Ex: '01', 'LOTE 01')
  numero_nf?: string; // Número da Nota Fiscal (Ex: 'NF 001', '12345')
  nf_conferida?: SimNao | null; // 'SIM' ou 'NÃO' ou null (Conferência de NF)
  produto_lacrado: SimNao;
  lacre_seguranca?: string | null; // Número do Lacre de Segurança da Caixa
  kit_completo: SimNao | null;
  aparelho_marcas_uso: SimNao | null;
  observacao: string;
  status_conformidade?: 'CONFORME' | 'NAO_CONFORME';
  divergencia_nf?: boolean;
  data_cadastro: string;
  usuario_cadastro: string;
  computador_id: string; // Ex: 'PC-RJ-001'
  computador_nome: string; // Ex: 'Estação 01'
  data_alteracao: string | null;
  status_sincronizacao: StatusSincronizacaoItem; // 'PENDENTE' | 'ENVIADO' | 'ERRO_DUPLICADO'
  data_sincronizacao: string | null;
  erro_sincronizacao?: string | null;
  duplicado_servidor_info?: DetalheImeiDuplicado | null;
  revisao?: number;
  // Snapshot de Referência da Regional (Novo Fluxo de Inventário e Lotes):
  reference_id?: string | null;
  import_batch_id?: string | null;
  source_type?: 'LISTED' | 'OUT_OF_LIST';
  dealer?: string | null;
  origin_invoice?: string | null;
  nf_origem?: string | null;
  nf_origem_samsung?: string | null;
  sku?: string | null;
  brand?: string | null;
  misuse?: boolean | null;
  classificacao_produto?: string | null;
  product_classification?: string | null;
  box_classification?: string | null;
  box_sealed_status?: 'SEALED' | 'OPEN' | null;
  box_id?: string | null;
  box_name?: string | null;
  // Compatibilidade retroativa com campos anteriores:
  sync_status?: 'PENDENTE' | 'SINCRONIZADO' | 'ENVIADO' | 'ERRO_DUPLICADO' | 'PENDENTE_ENVIO';
  sync_data?: string | null;
}

export type BoxSealedStatus = 'LACRADO' | 'ABERTO';

export interface ConfiguracaoCaixa {
  caixa: string;
  regional: string;
  totalProdutos: number;
  vazia: boolean;
  classificacao: string | null;
  condicaoLacre: BoxSealedStatus | null;
  produto_lacrado?: SimNao | null;
  lacre_seguranca?: string | null;
}

export type PerfilUsuario = 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'SUPERVISOR_REGIONAL' | 'OPERADOR';

export interface SessaoUsuario {
  token: string;
  user_id: number;
  login: string;
  nome: string;
  perfil: PerfilUsuario;
  regional: string | null;
  device_id: string;
  exp: number;
  iat: number;
}

export interface Usuario {
  id: number;
  nome: string;
  login: string;
  senha: string;
  perfil: PerfilUsuario;
  regional?: string | null; // Para operadores e supervisores: 'VIA VAREJO RJ', etc. Para admin: null ou 'TODAS'
  ativo: boolean;
  criado_em: string;
  nome_colaborador?: string; // Nome completo do colaborador identificado no turno
}

export interface HistoricoAuditoria {
  id: number;
  usuario: string;
  regional?: string;
  acao: string;
  detalhes: string;
  data_hora: string;
  computador_id?: string;
}

export interface ContadoresCaixa {
  caixa: string;
  totalAuditados: number;
  produtosLacrados: number;
  produtosNaoLacrados: number;
  comMarcasUso: number;
  avariasFaltantes?: number;
  pendencias: number; // Exclusivamente pendentes de envio online
}

export interface MetricasDashboard {
  totalAuditados: number;
  totalCaixas: number;
  produtosLacrados: number;
  produtosNaoLacrados: number;
  comMarcasUso: number;
  avariasFaltantes?: number;
  pendencias: number; // Exclusivamente pendentes de envio online
  ultimaAuditoria: string | null;
  produtosPorCaixa: { caixa: string; total: number }[];
  produtosPorModelo: { modelo: string; total: number }[];
  produtosPorData?: { data: string; total: number }[];
}

export interface EstatisticasRegional {
  regional: string;
  totalProdutos: number;
  totalCaixas: number;
  produtosLacrados: number;
  produtosNaoLacrados: number;
  avariasFaltantes?: number;
  pendencias: number; // Exclusivamente pendentes de envio online
  totalModelos: number;
  taxaQualidade: number; // percentual de lacrados
  ultimaAuditoria: string | null;
}

export type StatusConexao = 'ONLINE' | 'SINCRONIZADO' | 'OFFLINE';

export interface LogAcessoUsuario {
  id: number;
  usuario: string;
  perfil: string;
  regional?: string | null;
  maquina_id: string;
  maquina_nome: string;
  data_hora: string;
  dispositivo: string;
  ip?: string;
}

export interface ConfiguracaoInicialInfo {
  realizada: boolean;
  data_hora: string | null;
  usuario: string | null;
  parametros_baixados: boolean;
  total_modelos_catalogo: number;
}

export interface StatusSincronizacao {
  pendentes: number;
  sincronizados: number;
  enviados?: number;
  total: number;
  ultimaSincronizacao: string | null;
  // Campos detalhados para o Painel de Status do Sistema:
  statusConexao: StatusConexao;
  registrosPendentes: number;
  ultimoEnvio: string | null;
  quantidadeEnviada: number;
  quantidadeBloqueada: number;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  totalPaginas: number;
  itensPorPagina: number;
}

export interface FiltroConsulta {
  termoBusca?: string;
  regional?: string;
  computador_id?: string;
  status_sincronizacao?: 'TODOS' | StatusSincronizacaoItem;
  modelo?: string;
  ean?: string;
  serial?: string;
  caixa?: string;
  numero_lote?: string;
  data?: string;
  produtoLacrado?: 'TODOS' | SimNao;
  marcasUso?: 'TODOS' | SimNao;
  kitCompleto?: 'TODOS' | SimNao;
}

export interface FotoGrupoAuditoria {
  id: string;
  regional: string;
  caixa: string;
  grupoNumero: number;
  grupoRotulo: string;
  rangeInicio: number;
  rangeFim: number;
  totalNoGrupo: number;
  seriais: string[];
  fotoDataUri: string;
  dataCriacao: string;
  computador_id: string;
  usuario: string;
  status_sincronizacao: 'PENDENTE' | 'ENVIADO';
  data_sincronizacao?: string | null;
}

export interface GrupoFotosInfo {
  grupoNumero: number;
  grupoRotulo: string;
  rangeInicio: number;
  rangeFim: number;
  totalNoGrupo: number;
  seriais: string[];
  foto?: FotoGrupoAuditoria;
  temFoto: boolean;
}

// Estados do Ciclo de Vida de Evidências Fotográficas (Gate 7)
export type FotoLifecycleStatus = 'LOCAL_ONLY' | 'PENDING_UPLOAD' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

// FOTOS DOS PRODUTOS DA CAIXA (INICIAL: FOTO 1 E FOTO 2 + ADICIONAIS)
export const ROTULOS_2_FOTOS_CAIXA = [
  { id: 1, rotulo: 'Foto dos produtos 1', descricao: 'Primeira foto dos produtos da caixa' },
  { id: 2, rotulo: 'Foto dos produtos 2', descricao: 'Segunda foto dos produtos da caixa' },
] as const;

export const ROTULOS_10_FOTOS_CAIXA = ROTULOS_2_FOTOS_CAIXA;

export interface FotoCaixa10Item {
  indice: number; // 1, 2, 3, etc.
  rotulo: string;
  descricao: string;
  fotoDataUri: string;
}

export interface Registro10FotosCaixa {
  id: string;
  regional: string;
  caixa: string;
  dataCriacao: string;
  computador_id: string;
  usuario: string;
  fotos: FotoCaixa10Item[];
  motivoSemFotos?: string | null;
  status_sincronizacao: 'PENDENTE' | 'ENVIADO';
  data_sincronizacao?: string | null;
}

export interface CaixaLoteInfo {
  caixa: string;
  totalProdutos: number;
  lacrados: number;
  naoLacrados: number;
  statusEnvio: 'Aguardando envio Online' | 'Enviado Online';
}

export interface RelatorioLoteInfo {
  lote: string;
  cliente: string; // Regional (ex: 'VIA VAREJO SP')
  totalCaixas: number;
  totalProdutos: number;
  dataCriacao: string;
  dataEnvio: string;
  colaboradorResponsavel: string;
  status: 'Aguardando envio Online' | 'Enviado Online' | 'Sem produtos';
  caixas: CaixaLoteInfo[];
  produtos: ProdutoAuditoria[];
}

export interface FotosFechamentoLote {
  caixaFechada: string; // 1ª Foto: Foto da caixa fechada (Data URI base64)
  espelhoCaixa: string; // 2ª Foto: Foto mostrando o espelho da caixa (Data URI base64)
  lacreSeguranca: string; // 3ª Foto: Foto mostrando o lacre de segurança (Data URI base64)
}

export type StatusLote = 'EM_ABERTO' | 'FINALIZADO';

export interface HistoricoAlteracaoLote {
  id: string;
  dataHora: string;
  usuario: string; // Quem realizou a ação
  perfil: PerfilUsuario;
  acao: 'FECHAMENTO' | 'REABERTURA' | 'ALTERACAO_DADO' | 'EXCLUSAO_ITEM';
  detalhes: string;
}

export interface ItemPendenteLote {
  imei: string;
  sku?: string;
  modelo?: string;
  fabricante?: string;
  origin_invoice?: string | null;
  motivo?: string;
}

export interface RegistroLoteFinalizado {
  id: string;
  numero_lote: string;
  regional: string; // Cliente (ex: 'VIA VAREJO SP')
  nf_origem_samsung?: string | null;
  status: StatusLote;
  colaborador_fechamento: string; // Nome completo do colaborador responsável
  data_fechamento: string; // Data ISO ou formatada
  computador_id: string;
  total_caixas: number;
  total_produtos: number;
  fotos: FotosFechamentoLote;
  observacao?: string;
  checksum_lote?: string;
  reaberto_por?: string | null;
  data_reabertura?: string | null;
  motivo_reabertura?: string | null;
  motivo_pendencias?: string | null;
  produtos_pendentes?: ItemPendenteLote[];
  historico_alteracoes: HistoricoAlteracaoLote[];
}

export interface FiltroLoteFinalizado {
  numero_lote?: string;
  regional?: string;
  data?: string;
  colaborador?: string;
  status?: 'TODOS' | StatusLote;
}

// --- GATE 8: MANIFESTO E TIPOS DE BACKUP E RESTORE ---
export interface BackupManifest {
  format_version: number;
  app_version: string;
  created_at: string;
  device_id: string;
  tables: {
    produtos: ProdutoAuditoria[];
    lotes_finalizados: RegistroLoteFinalizado[];
    usuarios: Omit<Usuario, 'senha'>[]; // Regra 12.1: Nunca incluir senha plaintext
    computadores?: ComputadorInfo[];
    historico?: HistoricoAuditoria[];
    tentativas_duplicadas?: LogTentativaDuplicado[];
  };
  files?: Record<string, { size_bytes: number; sha256: string; mime_type: string }>;
  summary: {
    total_produtos: number;
    total_lotes: number;
    total_usuarios: number;
    total_historico: number;
  };
  checksum: string; // Hash SHA-256 do payload canônico de tables
}

export interface DryRunResultado {
  valido: boolean;
  erro?: string;
  manifest?: BackupManifest;
  detalhes: {
    totalProdutos: number;
    totalLotes: number;
    totalUsuarios: number;
    totalFotos?: number;
    totalHistorico: number;
    dataCriacao: string;
    appVersion: string;
    deviceId: string;
    checksumValido: boolean;
  };
}

export interface ResultadoRestauracao {
  sucesso: boolean;
  erro?: string;
  totalImportado?: number;
  snapshotId?: string;
  contagensRestauradas?: {
    produtos: number;
    lotes: number;
    usuarios: number;
    historico: number;
  };
}

// --- IMPORTAÇÃO DE PLANILHAS POR REGIONAL & REFERÊNCIA DE INVENTÁRIO ---
export type StatusLoteImportacao = 'ATIVA' | 'HISTORICA' | 'CANCELADA';

export interface InventoryImportBatch {
  id: string; // UUID
  regional_id?: string; // UUID no Supabase
  regional: string; // Ex: 'VIA VAREJO BA' ou 'BA'
  file_name: string;
  imported_by: string;
  imported_at: string; // Data ISO
  row_count: number;
  valid_count: number;
  invalid_count: number;
  status: StatusLoteImportacao;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface RegionalInventoryReference {
  id: string; // UUID
  regional_id?: string;
  regional: string; // Ex: 'VIA VAREJO BA' ou 'BA'
  import_batch_id: string; // UUID do batch de importação
  imei_normalized: string; // String com exatamente 15 dígitos
  sku: string;
  model_description: string;
  brand: string; // Ex: 'SAMSUNG' ou marca detectada
  origin_invoice?: string | null; // Coluna H: NFOrigem Samsung (preservar valor original)
  nf_origem_samsung?: string | null; // NFOrigem Samsung oficial
  dealer_raw?: string | null; // Coluna J original
  dealer_normalized?: string | null; // Coluna J normalizada
  source_file_name: string;
  source_row: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AuditLot {
  id: string; // UUID
  regional_id?: string;
  regional: string;
  nf_origem_samsung?: string | null;
  source_type: 'LISTED' | 'OUT_OF_LIST';
  dealer_normalized?: string | null;
  out_of_list_brand_group?: 'SAMSUNG' | 'OUTRA_MARCA' | null;
  display_sequence: number;
  display_name: string; // Ex: 'BA - LISTA - SAMSUNG', 'BA - LISTA - SIRI COMERCIO E SERVICOS LTDA'
  status: 'ABERTO' | 'FINALIZADO';
  created_at: string;
  updated_at?: string;
}

export interface MetricasValidacaoPlanilha {
  nomeArquivo: string;
  regional: string;
  totalLinhas: number;
  imeisValidos: number;
  imeisInvalidos: number;
  duplicadosPlanilha: number;
  linhasSkuVazio: number;
  linhasModeloVazio: number;
  linhasDealerVazio: number;
  exemplosInvalidos?: { linha: number; imei: string; motivo: string }[];
  exemplosValidos?: RegionalInventoryReference[];
}
