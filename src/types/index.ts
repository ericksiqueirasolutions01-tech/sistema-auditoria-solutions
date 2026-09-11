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
  pendencias: number;
}

export interface MetricasDashboard {
  totalAuditados: number;
  totalCaixas: number;
  produtosLacrados: number;
  produtosNaoLacrados: number;
  comMarcasUso: number;
  pendencias: number;
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
  pendencias: number;
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
}

