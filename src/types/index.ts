export type SimNao = 'SIM' | 'NÃO';

export interface ProdutoAuditoria {
  id: number;
  uuid: string;
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
  data_alteracao: string | null;
  sync_status: 'PENDENTE' | 'SINCRONIZADO';
  sync_data: string | null;
}

export type PerfilUsuario = 'ADMINISTRADOR' | 'OPERADOR';

export interface Usuario {
  id: number;
  nome: string;
  login: string;
  senha: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  criado_em: string;
}

export interface HistoricoAuditoria {
  id: number;
  usuario: string;
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
  ultimaAuditoria: string | null;
  produtosPorCaixa: { caixa: string; total: number }[];
  produtosPorModelo: { modelo: string; total: number }[];
}

export interface FiltroConsulta {
  termoBusca?: string;
  modelo?: string;
  ean?: string;
  serial?: string;
  caixa?: string;
  data?: string;
  produtoLacrado?: 'TODOS' | SimNao;
  marcasUso?: 'TODOS' | SimNao;
}

