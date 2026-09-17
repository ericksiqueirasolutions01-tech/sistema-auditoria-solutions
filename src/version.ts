export interface InfoVersaoSistema {
  versao: string;
  versaoCodigo: number;
  dataPublicacao: string;
  obrigatoria: boolean;
  titulo: string;
  descricao: string;
  novidades: string[];
  downloadUrl: string;
  sha256?: string;
  size_bytes?: number;
}

// Versão compilada neste pacote do aplicativo
export const VERSAO_LOCAL: InfoVersaoSistema = {
  versao: '1.2.0',
  versaoCodigo: 120,
  dataPublicacao: '2026-09-15T13:20:00.000Z',
  obrigatoria: true,
  titulo: 'Sistema de Auditoria Solutions Samsung',
  descricao:
    'Versão oficial v1.2.0 com campo obrigatório de conferência de NF, pesquisa rápida de lote, relatório Excel estruturado em abas e módulo completo de auditoria administrativa.',
  novidades: [
    'Campo obrigatório "NF FOI CONFERIDA" (🟢 SIM / NÃO) ao lado de PRODUTO LACRADO',
    'Validação obrigatória de conferência de NF em todos os itens antes do fechamento do lote',
    'Campo de busca e botão dedicado "🔎 PESQUISAR LOTE" no painel administrativo',
    'Tabela completa de produtos do lote com status de Lacre, NF Conferida e ações',
    'Relatório Excel aprimorado: Aba 1 (Resumo do Lote) e Aba 2 (Produtos do Lote)',
    'Módulo de edição e exclusão de itens de lotes finalizados pelo Administrador com motivo',
    'Trilha de auditoria permanente registrando responsável, data/hora e justificativa',
    'Botão de re-finalização de lote exclusivo para o Administrador',
    'Bloqueio permanente de lotes finalizados para operadores',
  ],
  downloadUrl:
    'https://sistema-auditoria-solutions.vercel.app/downloads/Sistema-Auditoria-Solutions-Setup.exe',
};

