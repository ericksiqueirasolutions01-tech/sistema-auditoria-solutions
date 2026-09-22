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
  versao: '1.3.2',
  versaoCodigo: 132,
  dataPublicacao: '2026-09-22T19:35:00.000Z',
  obrigatoria: true,
  titulo: 'Sistema de Auditoria Solutions Samsung',
  descricao:
    'Versão oficial v1.3.2 com padronização de badge para itens na lista Samsung e alerta imediato de atualização do sistema.',
  novidades: [
    'Badge de itens da lista padronizado para "PRODUTO NA LISTA SAMSUNG" quando não houver dealer cadastrado',
    'Detecção imediata de atualização na abertura do aplicativo Windows com aviso "Nova versão disponível, por favor atualizar agora" e botão direto de atualização',
    'Edição de Fabricante e Modelo para produtos fora da lista tanto na bipagem ativa (Desktop e Mobile) quanto na edição inline',
    'Datalist inteligente de fabricantes com recálculo automático da classificação de caixa e lote',
    'Lacre de Segurança por Caixa e Relatórios do Administrador com Lacre e Produtos Pendentes (Caixa 0)',
  ],
  downloadUrl:
    'https://sistema-auditoria-solutions.vercel.app/downloads/Sistema-Auditoria-Solutions-Setup.exe',
  sha256: '4739c9e9c1d80cbdae520877dd9e28a8b77c3a94b614ff9e7389aedea9baddc1',
  size_bytes: 22579200,
};

