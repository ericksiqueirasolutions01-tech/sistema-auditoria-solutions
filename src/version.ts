export interface InfoVersaoSistema {
  versao: string;
  versaoCodigo: number;
  dataPublicacao: string;
  obrigatoria: boolean;
  titulo: string;
  descricao: string;
  novidades: string[];
  downloadUrl: string;
}

// Versão compilada neste pacote do aplicativo
export const VERSAO_LOCAL: InfoVersaoSistema = {
  versao: '1.1.0',
  versaoCodigo: 110,
  dataPublicacao: '2026-09-15T10:40:00.000Z',
  obrigatoria: true,
  titulo: 'Sistema de Auditoria Solutions Samsung',
  descricao:
    'Versão oficial com identificação obrigatória do colaborador, fechamento de lote com 3 fotos e bloqueio operacional de lotes finalizados.',
  novidades: [
    'Identificação obrigatória de nome completo do colaborador após login',
    'Remoção dos botões Importar, Backup Seguro e Excel Caixa na tela operacional',
    'Novo botão oficial de Fechamento de Lote com 3 fotos obrigatórias',
    'Bloqueio total de inserção, edição e exclusão em lotes finalizados',
    'Ocultação de lotes finalizados para operadores',
    'Aba de consulta e reabertura de lotes finalizados no Painel Administrativo',
    'Sistema de atualização obrigatória com bloqueio de acesso',
  ],
  downloadUrl:
    'https://sistema-auditoria-solutions.vercel.app/downloads/Sistema-Auditoria-Solutions-Setup.exe',
};
