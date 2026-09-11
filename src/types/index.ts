export type SimNao = 'SIM' | 'NÃO';

export type StatusSincronizacaoItem = 'PENDENTE' | 'ENVIADO';

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
  serial: string;
  data_auditoria: string;
  numero_caixa: string;
  produto_lacrado: SimNao;
  kit_completo: SimNao | null;
  aparelho_marcas_uso: SimNao | null;
  observacao: string;
  data_cadastro: string;
  usuario_cadastro: string;
  computador_id: string; // Ex: 'PC-RJ-001'
  computador_nome: string; // Ex: 'Estação 01'
  data_alteracao: string | null;
  status_sincronizacao: StatusSincronizacaoItem; // 'PENDENTE' | 'ENVIADO'
  data_sincronizacao: string | null;
  // Compatibilidade retroativa com campos anteriores:
  sync_status?: 'PENDENTE' | 'SINCRONIZADO' | 'ENVIADO';
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

export interface StatusSincronizacao {
  pendentes: number;
  sincronizados: number;
  enviados?: number;
  total: number;
  ultimaSincronizacao: string | null;
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

// 10 FOTOS OBRIGATÓRIAS AO FINALIZAR / TROCAR DE CAIXA (REQUISITOS 4 E 5)
export const ROTULOS_10_FOTOS_CAIXA = [
  { id: 1, rotulo: 'Frente da caixa', descricao: 'Vista frontal nítida da caixa' },
  { id: 2, rotulo: 'Traseira da caixa', descricao: 'Vista traseira da caixa' },
  { id: 3, rotulo: 'Lateral direita', descricao: 'Vista da lateral direita da caixa' },
  { id: 4, rotulo: 'Lateral esquerda', descricao: 'Vista da lateral esquerda da caixa' },
  { id: 5, rotulo: 'Parte superior', descricao: 'Vista superior com fechamento da tampa' },
  { id: 6, rotulo: 'Parte inferior', descricao: 'Vista do fundo da caixa' },
  { id: 7, rotulo: 'Produtos organizados dentro da caixa', descricao: 'Visão dos aparelhos acomodados no interior' },
  { id: 8, rotulo: 'Lacre / fechamento', descricao: 'Fita adesiva, lacre ou selo de segurança intacto' },
  { id: 9, rotulo: 'Etiqueta de identificação', descricao: 'Etiqueta com código de barras, modelo e lote' },
  { id: 10, rotulo: 'Visão geral da caixa pronta', descricao: 'Foto panorâmica da caixa pronta para despacho' },
] as const;

export interface FotoCaixa10Item {
  indice: number; // 1 a 10
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
  status_sincronizacao: 'PENDENTE' | 'ENVIADO';
  data_sincronizacao?: string | null;
}


