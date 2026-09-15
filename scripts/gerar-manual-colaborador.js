import { jsPDF } from 'jspdf';
import autoTablePlugin from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';

// Aplica o plugin autotable no jsPDF
autoTablePlugin.applyPlugin(jsPDF);

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

const pageWidth = 210;
const pageHeight = 297;
const marginX = 14;
const contentWidth = pageWidth - marginX * 2; // 182mm

// Cores Oficiais da Paleta
const C_NAVY = [0, 34, 68];       // #002244 Samsung Corporate Navy
const C_BLUE = [3, 78, 162];      // #034EA2 Samsung Blue
const C_GREEN = [0, 168, 89];     // #00A859 Solutions Green
const C_AMBER = [217, 119, 6];    // #D97706 Alerta / Fechamento
const C_RED = [220, 38, 38];      // #DC2626 Alerta / Bloqueio
const C_DARK = [30, 41, 59];      // #1E293B Texto Principal
const C_MUTED = [100, 116, 139];  // #64748B Texto Secundário
const C_BG_CARD = [248, 250, 252];// #F8FAFC Fundo de Card
const C_BORDER = [226, 232, 240]; // #E2E8F0 Borda
const C_WHITE = [255, 255, 255];

let y = 15;

// Carrega imagens de logo se existirem
let logoSol = null;
let logoSam = null;
try {
  if (fs.existsSync('src/assets/logo-solutions.png')) {
    logoSol = fs.readFileSync('src/assets/logo-solutions.png');
  }
  if (fs.existsSync('src/assets/logo-samsung.png')) {
    logoSam = fs.readFileSync('src/assets/logo-samsung.png');
  }
} catch (e) {
  console.warn('Logos não puderam ser carregados:', e);
}

// Função auxiliar para desenhar cabeçalho padronizado em cada página
function drawHeader(isFirstPage = false) {
  if (isFirstPage) {
    // Topo estilizado da Capa
    doc.setFillColor(C_NAVY[0], C_NAVY[1], C_NAVY[2]);
    doc.rect(0, 0, pageWidth, 8, 'F');
    doc.setFillColor(C_GREEN[0], C_GREEN[1], C_GREEN[2]);
    doc.rect(0, 8, pageWidth, 2.5, 'F');

    // Logos no topo
    if (logoSol) {
      doc.addImage(logoSol, 'PNG', marginX, 15, 42, 13);
    }
    if (logoSam) {
      doc.addImage(logoSam, 'PNG', pageWidth - marginX - 44, 15, 44, 13);
    }
  } else {
    // Cabeçalho simplificado para páginas seguintes
    doc.setFillColor(C_NAVY[0], C_NAVY[1], C_NAVY[2]);
    doc.rect(0, 0, pageWidth, 5, 'F');
    doc.setFillColor(C_GREEN[0], C_GREEN[1], C_GREEN[2]);
    doc.rect(0, 5, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C_NAVY[0], C_NAVY[1], C_NAVY[2]);
    doc.text('MANUAL OPERACIONAL DO COLABORADOR — SISTEMA AUDITORIA SOLUTIONS (v1.2.0)', marginX, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2]);
    doc.text('Operação 100% Offline & Sincronização em Nuvem', pageWidth - marginX, 12, { align: 'right' });

    doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, 14, pageWidth - marginX, 14);
  }
}

// Função para verificar quebra de página
function checkPageBreak(spaceNeeded) {
  if (y + spaceNeeded > pageHeight - 20) {
    doc.addPage();
    drawHeader(false);
    y = 20;
  }
}

// Função para título de seção estilizado com badge numérico
function drawSectionTitle(numberStr, titleStr) {
  checkPageBreak(18);
  
  // Badge numérico
  doc.setFillColor(C_BLUE[0], C_BLUE[1], C_BLUE[2]);
  doc.roundedRect(marginX, y, 9, 9, 2, 2, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(numberStr, marginX + 4.5, y + 6.2, { align: 'center' });

  // Texto do Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(C_NAVY[0], C_NAVY[1], C_NAVY[2]);
  doc.text(titleStr, marginX + 12, y + 6.5);

  // Linha decorativa
  doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
  doc.setLineWidth(0.4);
  doc.line(marginX + 12, y + 9.5, pageWidth - marginX, y + 9.5);

  y += 15;
}

// Função para caixa de destaque / alerta
function drawAlertBox(type, title, lines) {
  const boxPadding = 4;
  const lineHeight = 4.2;
  const height = 8 + lines.length * lineHeight;
  
  checkPageBreak(height + 4);

  let bgColor = C_BG_CARD;
  let barColor = C_BLUE;
  let titleColor = C_BLUE;

  if (type === 'IMPORTANT' || type === 'MANDATORY') {
    bgColor = [254, 242, 242]; // Red tint
    barColor = C_RED;
    titleColor = C_RED;
  } else if (type === 'WARNING' || type === 'AMBER') {
    bgColor = [255, 251, 235]; // Amber tint
    barColor = C_AMBER;
    titleColor = C_AMBER;
  } else if (type === 'SUCCESS' || type === 'GREEN') {
    bgColor = [240, 253, 244]; // Green tint
    barColor = C_GREEN;
    titleColor = C_GREEN;
  }

  // Fundo
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.roundedRect(marginX, y, contentWidth, height, 2, 2, 'F');

  // Borda lateral esquerda sólida
  doc.setFillColor(barColor[0], barColor[1], barColor[2]);
  doc.rect(marginX, y, 2.5, height, 'F');

  // Título da Caixa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
  doc.text(title, marginX + 5, y + 5.5);

  // Linhas do Conteúdo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2]);

  let currentLineY = y + 9.5;
  lines.forEach((line) => {
    doc.text(line, marginX + 5, currentLineY);
    currentLineY += lineHeight;
  });

  y += height + 4;
}

// Função para parágrafo comum
function drawParagraph(text, isBold = false) {
  doc.setFont('helvetica', isBold ? 'bold' : 'normal');
  doc.setFontSize(9);
  doc.setTextColor(C_DARK[0], C_DARK[1], C_DARK[2]);
  
  const splitText = doc.splitTextToSize(text, contentWidth);
  const neededHeight = splitText.length * 4.3;
  checkPageBreak(neededHeight + 2);

  doc.text(splitText, marginX, y);
  y += neededHeight + 3;
}

// =============================================================================
// CONSTRUÇÃO DO DOCUMENTO
// =============================================================================

// 1. CAPA / CABEÇALHO DA PRIMEIRA PÁGINA
drawHeader(true);
y = 35;

// Caixa de Título Principal
doc.setFillColor(C_NAVY[0], C_NAVY[1], C_NAVY[2]);
doc.roundedRect(marginX, y, contentWidth, 26, 2, 2, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(15);
doc.setTextColor(255, 255, 255);
doc.text('MANUAL OPERACIONAL DO COLABORADOR', marginX + contentWidth / 2, y + 9, { align: 'center' });

doc.setFont('helvetica', 'normal');
doc.setFontSize(10.5);
doc.setTextColor(180, 210, 255);
doc.text('Sistema de Auditoria Solutions Samsung — Guia Oficial Passo a Passo (v1.2.0)', marginX + contentWidth / 2, y + 16, { align: 'center' });

doc.setFontSize(8);
doc.setTextColor(160, 230, 190);
doc.text('✓ 100% Offline  |  ✓ NF Obrigatória  |  ✓ 3 Fotos no Fechamento  |  ✓ Bloqueio de Lote  |  ✓ Sincronização em Nuvem', marginX + contentWidth / 2, y + 22, { align: 'center' });

y += 32;

// Card de Metadados / Resumo Executivo
doc.autoTable({
  startY: y,
  margin: { left: marginX, right: marginX },
  theme: 'plain',
  styles: { fontSize: 8.5, cellPadding: 2.5, textColor: C_DARK },
  columnStyles: {
    0: { fontStyle: 'bold', textColor: C_BLUE, width: 42 },
    1: { width: 49 },
    2: { fontStyle: 'bold', textColor: C_BLUE, width: 42 },
    3: { width: 49 },
  },
  body: [
    [
      'Sistema:', 'Auditoria Solutions Samsung',
      'Versão Oficial:', 'v1.2.0 (Compilação Set/2026)',
    ],
    [
      'Perfil Destinado:', 'Operador / Colaborador de Campo',
      'Modo de Operação:', '100% Offline (com Sync Online)',
    ],
    [
      'Dispositivos:', 'Desktop Windows / Coletor / Celular',
      'Responsável Técnico:', 'Coordenação de TI & Operações',
    ],
  ],
});
y = doc.lastAutoTable.finalY + 6;

// =============================================================================
// SEÇÃO 1: VISÃO GERAL DA OPERAÇÃO
// =============================================================================
drawSectionTitle('1', 'Visão Geral do Sistema & Operação Offline');

drawParagraph(
  'O Sistema de Auditoria Solutions Samsung é a ferramenta oficial desenvolvida para conferência, controle de qualidade, validação de lacres e rastreabilidade total de aparelhos eletrônicos nas operações de recebimento, triagem e expedição.'
);

drawAlertBox(
  'SUCCESS',
  'PRINCÍPIO FUNDAMENTAL: OPERAÇÃO 100% INDEPENDENTE DE INTERNET (OFFLINE)',
  [
    '• O colaborador NÃO precisa de internet na bancada para trabalhar, bipar, conferir e fechar lotes.',
    '• O sistema utiliza um banco de dados local autônomo (SQLite de alta performance embutido).',
    '• Quedas de sinal ou oscilações de Wi-Fi NÃO interrompem a operação e NÃO causam perda de dados.',
    '• A sincronização com a central online pode ser feita no final do turno ou quando houver conexão.',
  ]
);

// =============================================================================
// SEÇÃO 2: DOWNLOAD E INSTALAÇÃO NO COMPUTADOR
// =============================================================================
drawSectionTitle('2', 'Download e Instalação do Aplicativo Desktop');

drawParagraph(
  'Para postos de trabalho fixos em computadores com Windows, o sistema possui um instalador oficial autônomo (.EXE) que não necessita de configurações complexas:'
);

doc.autoTable({
  startY: y,
  margin: { left: marginX, right: marginX },
  head: [['Etapa', 'Ação do Colaborador', 'Comportamento do Sistema']],
  body: [
    [
      '1. Obter Instalador',
      'Clicar no botão "📥 Baixar Instalador Windows (.EXE)" na tela de login web ou acessar o link da TI.',
      'O download do arquivo "Sistema-Auditoria-Solutions-Setup.exe" (15 MB) é iniciado.',
    ],
    [
      '2. Executar o Setup',
      'Dar dois cliques no arquivo baixado e clicar em "Instalar Agora".',
      'O instalador descompacta o aplicativo em %LOCALAPPDATA% e cria o atalho oficial na Área de Trabalho.',
    ],
    [
      '3. Abrir o Sistema',
      'Clicar no ícone "Sistema de Auditoria Solutions" na Área de Trabalho.',
      'O aplicativo inicia o servidor local ultraleve e abre a janela do sistema pronta para uso imediato.',
    ],
    [
      '4. Atualizações',
      'Se surgir uma nova versão, clicar no aviso "🔄 CLIQUE AQUI PARA ATUALIZAR".',
      'O sistema baixa os novos módulos em segundo plano, instala silenciosamente e reinicia atualizado.',
    ],
  ],
  styles: { fontSize: 8, cellPadding: 2.5, textColor: C_DARK },
  headStyles: { fillColor: C_NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
  alternateRowStyles: { fillColor: [248, 250, 252] },
});
y = doc.lastAutoTable.finalY + 6;

// =============================================================================
// SEÇÃO 3: LOGIN E IDENTIFICAÇÃO OBRIGATÓRIA
// =============================================================================
drawSectionTitle('3', 'Login e Identificação Obrigatória do Colaborador');

drawParagraph(
  'A identificação rigorosa do operador é requisito essencial de conformidade para auditoria externa e rastreabilidade total das movimentações:'
);

drawAlertBox(
  'MANDATORY',
  'NOVA REGRA OBRIGATÓRIA: IDENTIFICAÇÃO DE NOME COMPLETO APÓS LOGIN',
  [
    '1. Na tela inicial, selecione o CLIENTE / REGIONAL (Exemplo: "Via Varejo SP", "Magalu", etc.).',
    '2. Digite seu Usuário e Senha cadastrados e clique em "ENTRAR".',
    '3. Em seguida, surgirá uma tela obrigatória exigindo: "DIGITE SEU NOME COMPLETO: [ _______________ ]".',
    '4. REGRA: É proibido colocar apenas o primeiro nome ou apelido. Digite Nome e Sobrenome completos.',
    '5. O sistema NÃO permite avançar sem preencher este campo.',
    '6. RASTREABILIDADE: Seu nome será gravado em cada IMEI bipado, em cada caixa e no fechamento do lote.',
  ]
);

drawParagraph(
  'Após confirmar seu nome, você verá no cabeçalho superior do sistema um crachá permanente contendo seu Nome Completo, Perfil (Operador) e a Filial/Regional selecionada.'
);

// =============================================================================
// SEÇÃO 4: PREPARAÇÃO DA BANCADA (LOTE, CAIXA E MODOS DE TELA)
// =============================================================================
drawSectionTitle('4', 'Seleção do Lote, Caixa e Modos de Visualização');

drawParagraph(
  'Antes de iniciar a bipagem física, o colaborador deve organizar a estrutura da bancada de trabalho:'
);

doc.autoTable({
  startY: y,
  margin: { left: marginX, right: marginX },
  head: [['Elemento', 'Como Preencher / Selecionar', 'Instrução Operacional']],
  body: [
    [
      'Número do Lote',
      'Ex.: 01, 02, 03...',
      'Informe o número do lote ativo. Lotes já finalizados ficam bloqueados e ocultos para operadores.',
    ],
    [
      'Número da Caixa',
      'Ex.: 01, 02, 03...',
      'Inicie sempre na Caixa 01. Ao atingir a capacidade, utilize a função de troca automática de caixa.',
    ],
    [
      'Modo Celular / Coletor',
      'Botão "📱 Modo Celular"',
      'Interface simplificada com foco vertical, botões grandes de toque rápido e tela de bipagem limpa.',
    ],
    [
      'Modo Planilha / Desktop',
      'Botão "📋 Modo Planilha"',
      'Interface em grade completa, ideal para monitores maiores com visualização de todos os produtos.',
    ],
  ],
  styles: { fontSize: 8, cellPadding: 2.5, textColor: C_DARK },
  headStyles: { fillColor: C_BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
  alternateRowStyles: { fillColor: [248, 250, 252] },
});
y = doc.lastAutoTable.finalY + 6;

// =============================================================================
// SEÇÃO 5: BIPAGEM RÁPIDA, PRODUTO LACRADO E NF CONFERIDA
// =============================================================================
drawSectionTitle('5', 'Bipagem de Produtos, Lacre e Conferência de NF');

drawParagraph(
  'A tela de lançamento conta com os seletores de conformidade posicionados lado a lado para agilidade máxima:'
);

drawAlertBox(
  'GREEN',
  'CAMPOS DE CONFORMIDADE OPERACIONAL (LADO A LADO)',
  [
    '• PRODUTO LACRADO: [ 🟢 SIM (LACRADO) ] ou [ NÃO (ABERTO) ]',
    '    -> Marque "SIM" se a embalagem original estiver com todos os selos Samsung intactos.',
    '    -> Marque "NÃO" se o lacre estiver rompido, aberto ou avariado.',
    '• NF FOI CONFERIDA: [ 🟢 SIM (CONFERIDA) ] ou [ NÃO ]',
    '    -> Marque "SIM" se a Nota Fiscal / DANFE deste produto foi conferida fisicamente.',
    '    -> O valor padrão inicia como "SIM" e salva automaticamente com o produto bipado.',
    '    -> O cursor retorna automaticamente ao campo de IMEI após cada bipagem.',
  ]
);

drawParagraph(
  'Métodos de Bipagem Aceitos: (1) Leitor de Código de Barras Físico USB/Bluetooth (mais recomendado); (2) Câmera integrada do dispositivo; (3) Digitação manual do serial/IMEI seguida de Enter.'
);

doc.autoTable({
  startY: y,
  margin: { left: marginX, right: marginX },
  head: [['Validação Automática', 'Comportamento do Sistema em Caso de Erro / Sucesso']],
  body: [
    [
      'Identificação de Modelo',
      'O sistema identifica automaticamente a descrição do aparelho e memória através do EAN/PartNumber.',
    ],
    [
      'Bloqueio de Duplicidade',
      'Se você bipar o mesmo IMEI duas vezes no mesmo lote, o sistema emite um alerta sonoro e bloqueia.',
    ],
    [
      'Contadores em Tempo Real',
      'O total de produtos na caixa e no lote é incrementado instantaneamente no topo da tela.',
    ],
  ],
  styles: { fontSize: 8, cellPadding: 2.2, textColor: C_DARK },
  headStyles: { fillColor: C_NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
});
y = doc.lastAutoTable.finalY + 6;

// =============================================================================
// SEÇÃO 6: GESTÃO E FINALIZAÇÃO DE CAIXAS
// =============================================================================
drawSectionTitle('6', 'Gestão, Troca e Encerramento de Caixas');

drawParagraph(
  'Quando a caixa física atingir a capacidade máxima estipulada pela operação (por exemplo, 10, 20 ou 30 unidades), execute a troca organizada da caixa:'
);

drawAlertBox(
  'AMBER',
  'PASSO A PASSO PARA TROCA DE CAIXA NA BANCADA',
  [
    '1. Confira visualmente se o número de aparelhos na caixa física confere com o total exibido na tela.',
    '2. Clique no botão "📦 TROCAR CAIXA" ou "✅ FINALIZAR CAIXA".',
    '3. O sistema fecha a numeração atual e avança automaticamente para a próxima caixa (ex: Caixa 02).',
    '4. O número do Lote permanece o mesmo, mantendo a continuidade do processo.',
    '5. Aplique o lacre físico na caixa pronta e anote o número do lacre para a etapa final de fotos.',
  ]
);

// =============================================================================
// SEÇÃO 7: SINCRONIZAÇÃO COM O ONLINE
// =============================================================================
drawSectionTitle('7', 'Sincronização: Enviar para o Online');

drawParagraph(
  'A sincronização transfere as informações salvas no banco de dados local para os servidores em nuvem da matriz:'
);

doc.autoTable({
  startY: y,
  margin: { left: marginX, right: marginX },
  head: [['Quando Sincronizar?', 'Como Fazer?', 'O Que Acontece?']],
  body: [
    [
      'Ao finalizar um lote de caixas ou sempre que houver conexão com internet disponível.',
      'Basta clicar no botão "☁️ ENVIAR PARA O ONLINE" na barra de ferramentas superior.',
      'O sistema envia os produtos. O status muda de "Pendente" para "🟢 Sincronizado" na cor verde.',
    ],
  ],
  styles: { fontSize: 8, cellPadding: 2.5, textColor: C_DARK },
  headStyles: { fillColor: C_BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
});
y = doc.lastAutoTable.finalY + 6;

// =============================================================================
// SEÇÃO 8: FECHAMENTO DE LOTE COM 3 FOTOS OBRIGATÓRIAS
// =============================================================================
drawSectionTitle('8', 'Fechamento Oficial do Lote com 3 Fotos Obrigatórias');

drawParagraph(
  'O encerramento do lote é o ato formal de entrega da auditoria. Para garantir conformidade com a Samsung, o fechamento exige evidências fotográficas inegociáveis:'
);

drawAlertBox(
  'MANDATORY',
  'REGRA INFLEXÍVEL: VALIDAÇÃO DE 100% DA NOTA FISCAL ANTES DO FECHAMENTO',
  [
    '• O sistema verifica automaticamente todos os produtos lançados no lote.',
    '• Se houver QUALQUER PRODUTO sem a conferência de NF registrada, o sistema BLOQUEIA o fechamento.',
    '• O colaborador deve regularizar os itens pendentes antes de prosseguir para as fotos.',
  ]
);

drawParagraph('Ao clicar no botão "🔒 FECHAMENTO DE LOTE", anexe obrigatoriamente as 3 fotografias:');

doc.autoTable({
  startY: y,
  margin: { left: marginX, right: marginX },
  head: [['Evidência Fotográfica', 'Descrição Obrigatória da Foto', 'Critério de Validação']],
  body: [
    [
      '📸 1ª Foto',
      'Foto da Caixa Fechada',
      'Visão geral da caixa física totalmente montada, fechada e com fita adesiva aplicada.',
    ],
    [
      '📋 2ª Foto',
      'Foto do Espelho da Caixa',
      'Enquadramento nítido da etiqueta/documento com a relação de modelos e quantidades da caixa.',
    ],
    [
      '🛡️ 3ª Foto',
      'Foto do Lacre de Segurança',
      'Foto em close com foco perfeito permitindo ler claramente a numeração do lacre físico.',
    ],
  ],
  styles: { fontSize: 8, cellPadding: 2.5, textColor: C_DARK },
  headStyles: { fillColor: C_NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
  alternateRowStyles: { fillColor: [248, 250, 252] },
});
y = doc.lastAutoTable.finalY + 6;

drawParagraph(
  'Após anexar as 3 fotos e revisar o resumo geral (Total de Caixas, Total de Aparelhos e 100% NF Conferida), clique no botão verde "CONFIRMAR E FINALIZAR LOTE".'
);

// =============================================================================
// SEÇÃO 9: BLOQUEIO DO LOTE FINALIZADO
// =============================================================================
drawSectionTitle('9', 'Bloqueio do Lote e Proteção contra Alterações');

drawAlertBox(
  'WARNING',
  'ESTADO DO LOTE APÓS FINALIZAÇÃO: "STATUS: LOTE FINALIZADO / BLOQUEADO"',
  [
    '1. O lote não poderá mais ser utilizado por nenhum colaborador na bancada.',
    '2. Novos lançamentos ficam terminantemente proibidos e bloqueados.',
    '3. O colaborador NÃO pode editar, alterar nem excluir nenhum produto do lote finalizado.',
    '4. O lote é automaticamente ocultado da lista de seleção operacional para operadores.',
    '5. REABERTURA EXCLUSIVA ADMIN: Se houver necessidade de retificação, solicite ao Administrador,',
    '   que avaliará e registrará a justificativa formal na Trilha de Auditoria Permanente.',
  ]
);

// =============================================================================
// SEÇÃO 10: FAQ E DÚVIDAS FREQUENTES
// =============================================================================
drawSectionTitle('10', 'Perguntas Frequentes & Resolução de Problemas (FAQ)');

doc.autoTable({
  startY: y,
  margin: { left: marginX, right: marginX },
  head: [['Dúvida Operacional', 'Procedimento Correto']],
  body: [
    [
      'A internet caiu durante a bipagem. Preciso parar?',
      'NÃO! O sistema foi construído para funcionar 100% offline. Continue bipando normalmente.',
    ],
    [
      'O sistema exibiu "Nova Atualização Obrigatória":',
      'Clique em "CLIQUE AQUI PARA ATUALIZAR" e aguarde 15 segundos. O app reinicia sozinho.',
    ],
    [
      'Apareceu o erro "IMEI já bipado neste lote":',
      'Confira se o aparelho já não foi bipado por engano ou se a etiqueta já foi conferida.',
    ],
    [
      'Esqueci de bipar um aparelho e fechei o lote:',
      'Comunique seu Coordenador/Admin. Somente ele possui a chave de reabertura com justificativa.',
    ],
    [
      'A câmera não foca o código de barras no celular:',
      'Aproxime uma fonte de luz, posicione o código no retângulo ou digite o número no teclado.',
    ],
  ],
  styles: { fontSize: 8, cellPadding: 2.3, textColor: C_DARK },
  headStyles: { fillColor: C_BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
  alternateRowStyles: { fillColor: [248, 250, 252] },
});
y = doc.lastAutoTable.finalY + 10;

// Rodapé de Conclusão / Assinatura
checkPageBreak(25);
doc.setFillColor(C_NAVY[0], C_NAVY[1], C_NAVY[2]);
doc.roundedRect(marginX, y, contentWidth, 18, 2, 2, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(9.5);
doc.setTextColor(255, 255, 255);
doc.text('GRUPO SOLUTIONS — EXCELÊNCIA EM AUDITORIA E TECNOLOGIA', marginX + contentWidth / 2, y + 6.5, { align: 'center' });

doc.setFont('helvetica', 'normal');
doc.setFontSize(8);
doc.setTextColor(180, 210, 255);
doc.text('Manual Operacional Oficial v1.2.0 • Suporte de TI: suporte@gruposolutions.com.br', marginX + contentWidth / 2, y + 12.5, { align: 'center' });

// =============================================================================
// NUMERAÇÃO DE PÁGINAS NO RODAPÉ
// =============================================================================
const totalPages = doc.internal.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  
  doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2]);
  doc.text('Sistema de Auditoria Solutions Samsung • Guia Oficial do Colaborador (v1.2.0)', marginX, pageHeight - 8);
  doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
}

// Salva o PDF nos destinos
const outputPaths = [
  'public/downloads/Manual_Colaborador_Auditoria_Solutions.pdf',
  'dist/downloads/Manual_Colaborador_Auditoria_Solutions.pdf',
  'Manual_Colaborador_Auditoria_Solutions.pdf',
];

const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

outputPaths.forEach((p) => {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, pdfBuffer);
  console.log(`PDF gerado com sucesso em: ${p}`);
});

