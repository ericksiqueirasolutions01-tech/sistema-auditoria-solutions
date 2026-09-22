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
  versao: '1.3.1',
  versaoCodigo: 131,
  dataPublicacao: '2026-09-22T19:20:00.000Z',
  obrigatoria: true,
  titulo: 'Sistema de Auditoria Solutions Samsung',
  descricao:
    'Versão oficial v1.3.1 com edição livre de fabricante e modelo para produtos fora da lista, cálculo dinâmico de classificação por marca e formulário administrativo atualizado.',
  novidades: [
    'Edição de Fabricante e Modelo para produtos fora da lista tanto na bipagem ativa (Desktop e Mobile) quanto na edição inline de linhas registradas',
    'Datalist inteligente de fabricantes (Samsung, Motorola, Apple, Xiaomi, Oppo, Jovi, Outra Marca) com classificação automática dinâmica',
    'Recálculo em tempo real de classificação de caixa e produto ao alterar fabricante/modelo de itens fora da lista',
    'Suporte à edição de Fabricante pelo Administrador no modal de edição de produtos',
    'Lacre de Segurança por Caixa e Relatórios do Administrador com Lacre e Produtos Pendentes (Caixa 0)',
  ],
  downloadUrl:
    'https://sistema-auditoria-solutions.vercel.app/downloads/Sistema-Auditoria-Solutions-Setup.exe',
};

