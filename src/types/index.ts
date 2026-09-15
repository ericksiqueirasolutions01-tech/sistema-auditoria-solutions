export type SimNao = 'SIM' | 'NÃO';

export type StatusSincronizacaoItem = 'PENDENTE' | 'ENVIADO' | 'ERRO_DUPLICADO';

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

export interface ComputadorInfo {
  id: string; // Ex: 'PC-RJ-001'
  nome: string; // Ex: 'Estação de Bipagem 01'
  regional: string; // Ex: 'VIA VAREJO RJ'
  data_primeiro_uso: string; // Data ISO
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
  fabricante: string; // 'SAMSUNG' fixo
  modelo_produto: string;
  ean: string;
  serial: string; // Mantido para compatibilidade de sincronização e banco legado
  imei?: string; // Código IMEI oficial (15 dígitos numéricos)
  data_auditoria: string;
  numero_caixa: string;
  numero_lote?: string; // Número do Lote (Ex: '01', 'LOTE 01')
  numero_nf?: string; // Número da Nota Fiscal (Ex: 'NF 001', '12345')
  nf_conferida?: SimNao; // 'SIM' ou 'NÃO' (Conferência de NF)
  produto_lacrado: SimNao;
  kit_completo: SimNao | null;
  aparelho_marcas_uso: SimNao | null;
  observacao: string;
  data_cadastro: string;
  usuario_cadastro: string;
  computador_id: string; // Ex: 'PC-RJ-001'
  computador_nome: string; // Ex: 'Estação 01'
  data_alteracao: string | null;
  status_sincronizacao: StatusSincronizacaoItem; // 'PENDENTE' | 'ENVIADO' | 'ERRO_DUPLICADO'
  data_sincronizacao: string | null;
  erro_sincronizacao?: string | null;
  duplicado_servidor_info?: DetalheImeiDuplicado | null;
  // Compatibilidade retroativa com campos anteriores:
  sync_status?: 'PENDENTE' | 'SINCRONIZADO' | 'ENVIADO' | 'ERRO_DUPLICADO';
  sync_data?: string | null;
}

export type PerfilUsuario = 'ADMINISTRADOR' | 'OPERADOR';

export interface Usuario {
  id: number;
  nome: string;
  login: string;
  senha: string;
  perfil: PerfilUsuario;
  regional?: string | null; // Para operadores: 'VIA VAREJO RJ', etc. Para admin: null ou 'TODAS'
  ativo: boolean;
  criado_em: string;
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

export type StatusConexao = 'ONLINE' | 'OFFLINE';

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


