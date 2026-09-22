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
  versao: '1.3.0',
  versaoCodigo: 130,
  dataPublicacao: '2026-09-22T19:00:00.000Z',
  obrigatoria: true,
  titulo: 'Sistema de Auditoria Solutions Samsung',
  descricao:
    'Versão oficial v1.3.0 com lacre de segurança por caixa na bipagem e espelho, relatório do administrador com lacre de cada caixa, exclusão e gestão de bases de referência, conferência de produtos pendentes antes do fechamento e justificativa obrigatória com Caixa 0.',
  novidades: [
    'Campo e controle de Lacre de Segurança por Caixa na bipagem contínua e cabeçalho operacional',
    'Exibição do Lacre de Segurança nos Espelhos de Caixa (Modelos 1 e 2) e PDFs oficiais',
    'Relatório do Administrador (Excel e PDF) com coluna dedicada ao Número do Lacre de cada caixa',
    'Exclusão de bases de referência regionais pelo Administrador com reativação automática de versão anterior',
    'Validação prévia de produtos pendentes ao fechar lote comparando listagem oficial com itens bipados',
    'Campo obrigatório de justificativa/motivo para fechamento de lote com pendências',
    'Produtos pendentes listados nos relatórios com numeração de Caixa = 0 e motivo registrado',
  ],
  downloadUrl:
    'https://sistema-auditoria-solutions.vercel.app/downloads/Sistema-Auditoria-Solutions-Setup.exe',
};

