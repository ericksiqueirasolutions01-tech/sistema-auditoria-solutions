import React, { useState, useRef, useEffect } from 'react';
import { db, SAMSUNG_MODELOS_PRESET } from '../db/storage';
import { ProdutoAuditoria, SimNao } from '../types';
import { sounds } from '../utils/audio';
import { SamsungLogo } from '../components/SamsungLogo';
import { SolutionsLogo } from '../components/SolutionsLogo';
import { LOGO_SAMSUNG_BASE64, LOGO_SOLUTIONS_BASE64 } from '../assets/logosDataUri';
import {
  FileSpreadsheet,
  Plus,
  Printer,
  Download,
  FileText,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  ShieldAlert,
  Trash2,
  X,
  Check,
  Edit2,
  CornerDownLeft,
  ShieldCheck,
  HardDrive,
  Files,
  Building2,
  MapPin,
  Laptop,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const BipagemRapida: React.FC = () => {
  const usuarioAtual = db.getUsuarioAtual();
  const regionalAtiva = usuarioAtual?.regional || (usuarioAtual?.perfil === 'ADMINISTRADOR' ? 'TODAS AS REGIONAIS (ADMIN)' : 'VIA VAREJO RJ');
  const computadorAtual = db.obterComputadorAtual(usuarioAtual?.regional || undefined);
  const caixasExistentes = db.listarCaixas();

  // Format today's date DD/MM/AAAA
  const getDataAtualFormatada = (): string => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  // State for active row inputs (Excel current active line)
  // All columns requested by user are directly editable: Modelo, EAN, Serial, Data, Caixa, Lacre, Kit, Marcas, Obs
  const [caixaAtiva, setCaixaAtiva] = useState(
    caixasExistentes.length > 0 ? caixasExistentes[0] : 'Caixa 01'
  );
  const [filtroCaixa, setFiltroCaixa] = useState<string>(
    caixasExistentes.length > 0 ? caixasExistentes[0] : 'Caixa 01'
  );

  const [modeloAtivo, setModeloAtivo] = useState(SAMSUNG_MODELOS_PRESET[2].modelo); // Galaxy S24
  const [eanAtivo, setEanAtivo] = useState(SAMSUNG_MODELOS_PRESET[2].ean);
  const [serialInput, setSerialInput] = useState('');
  const [dataAtiva, setDataAtiva] = useState(getDataAtualFormatada());
  const [lacreAtivo, setLacreAtivo] = useState<SimNao>('SIM');
  const [kitAtivo, setKitAtivo] = useState<SimNao | ''>('');
  const [marcasAtivo, setMarcasAtivo] = useState<SimNao | ''>('');
  const [obsAtivo, setObsAtivo] = useState('');

  // Editing state for previously recorded rows (full inline editing of any cell)
  const [linhaEditandoId, setLinhaEditandoId] = useState<number | null>(null);
  const [editModelo, setEditModelo] = useState('');
  const [editEan, setEditEan] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editData, setEditData] = useState('');
  const [editCaixa, setEditCaixa] = useState('');
  const [editLacre, setEditLacre] = useState<SimNao>('SIM');
  const [editKit, setEditKit] = useState<SimNao | ''>('');
  const [editMarcas, setEditMarcas] = useState<SimNao | ''>('');
  const [editObs, setEditObs] = useState('');

  // UI Modals
  const [mostrarEspelhoModal, setMostrarEspelhoModal] = useState(false);
  const [incluirSeriaisEspelho, setIncluirSeriaisEspelho] = useState(false);
  const [mostrarImportModal, setMostrarImportModal] = useState(false);
  const [mostrarNovaCaixaModal, setMostrarNovaCaixaModal] = useState(false);
  const [novaCaixaNome, setNovaCaixaNome] = useState('');

  // Feedback notifications
  const [erroDuplicado, setErroDuplicado] = useState<string | null>(null);
  const [alertaValidacao, setAlertaValidacao] = useState<string | null>(null);
  const [sucessoNotif, setSucessoNotif] = useState<string | null>(null);

  // Data
  const [produtos, setProdutos] = useState<ProdutoAuditoria[]>(() =>
    db.listarProdutos(filtroCaixa === 'TODAS' ? undefined : { caixa: filtroCaixa })
  );
  const [contadores, setContadores] = useState(() =>
    db.obterContadoresCaixa(caixaAtiva)
  );

  const serialInputRef = useRef<HTMLInputElement>(null);
  const tableBottomRef = useRef<HTMLDivElement>(null);
  const kitSelectRef = useRef<HTMLSelectElement>(null);
  const marcasSelectRef = useRef<HTMLSelectElement>(null);

  // Auto-focus on the Serial input cell
  useEffect(() => {
    serialInputRef.current?.focus();
  }, [caixaAtiva, produtos.length, lacreAtivo]);

  const recarregarDados = (filtro: string) => {
    setProdutos(db.listarProdutos(filtro === 'TODAS' ? undefined : { caixa: filtro }));
    setContadores(db.obterContadoresCaixa(caixaAtiva));
  };

  // Refresh when box or filter changes
  useEffect(() => {
    recarregarDados(filtroCaixa);
  }, [filtroCaixa, caixaAtiva]);

  // Listener reativo em tempo real para sincronização e novos dados: atualiza imediatamente sem F5
  useEffect(() => {
    return db.onMudanca(() => {
      recarregarDados(filtroCaixa);
    });
  }, [filtroCaixa, caixaAtiva]);

  // When user changes the model input, try to auto-fill EAN if it matches a Samsung preset, but keep it editable!
  const handleModeloChange = (novoModelo: string) => {
    setModeloAtivo(novoModelo);
    const encontrado = SAMSUNG_MODELOS_PRESET.find(
      (m) => m.modelo.toLowerCase() === novoModelo.toLowerCase().trim()
    );
    if (encontrado) {
      setEanAtivo(encontrado.ean);
    }
  };

  // Main Bipagem Process (Excel Row Enter)
  const processarBipagemLinha = () => {
    const serialLimpo = serialInput.trim().toUpperCase();
    const eanLimpo = eanAtivo.trim();
    const modeloLimpo = modeloAtivo.trim();
    const caixaLimpa = caixaAtiva.trim();
    const dataLimpa = dataAtiva.trim() || getDataAtualFormatada();

    setErroDuplicado(null);
    setAlertaValidacao(null);
    setSucessoNotif(null);

    // Validação Modelo
    if (!modeloLimpo) {
      setAlertaValidacao('Preencha o modelo do produto.');
      sounds.playError();
      return;
    }

    // Validação EAN
    if (!eanLimpo) {
      setAlertaValidacao('Preencha o código EAN do produto.');
      sounds.playError();
      return;
    }

    // Validação Serial
    if (!serialLimpo) {
      setAlertaValidacao('Posicione o cursor na coluna SERIAL e bipe o produto.');
      sounds.playError();
      serialInputRef.current?.focus();
      return;
    }

    // Validação Caixa
    if (!caixaLimpa) {
      setAlertaValidacao('Informe a Caixa (ex: Caixa 01).');
      sounds.playError();
      return;
    }

    // 1. VALIDAR DUPLICIDADE EM TEMPO REAL
    const check = db.validarDuplicidade(serialLimpo);
    if (check.duplicado && check.produto) {
      sounds.playError();
      setErroDuplicado(
        `SERIAL DUPLICADO: O serial ${serialLimpo} já foi auditado na ${check.produto.numero_caixa} em ${check.produto.data_auditoria}.`
      );
      serialInputRef.current?.select();
      return;
    }

    // 2. REGRA DO PRODUTO LACRADO (SIM / NÃO)
    if (lacreAtivo === 'NÃO') {
      if (!kitAtivo) {
        sounds.playError();
        setAlertaValidacao('Para produto NÃO lacrado, é OBRIGATÓRIO informar Kit Completo (SIM/NÃO).');
        kitSelectRef.current?.focus();
        return;
      }
      if (!marcasAtivo) {
        sounds.playError();
        setAlertaValidacao('Para produto NÃO lacrado, é OBRIGATÓRIO informar Marcas de Uso (SIM/NÃO).');
        marcasSelectRef.current?.focus();
        return;
      }
    }

    // 3. GRAVAÇÃO INSTANTÂNEA NO BANCO DE DADOS LOCAL (COM DUAL PERSISTENCE EM INDEXEDDB)
    const res = db.inserirProduto({
      modelo_produto: modeloLimpo,
      ean: eanLimpo,
      serial: serialLimpo,
      data_auditoria: dataLimpa,
      numero_caixa: caixaLimpa,
      produto_lacrado: lacreAtivo,
      kit_completo: lacreAtivo === 'SIM' ? null : (kitAtivo as SimNao),
      aparelho_marcas_uso: lacreAtivo === 'SIM' ? null : (marcasAtivo as SimNao),
      observacao: obsAtivo.trim(),
    });

    if (res.sucesso && res.produto) {
      sounds.playSuccess();
      setSucessoNotif(`Serial ${serialLimpo} registrado na ${caixaLimpa}!`);
      setTimeout(() => setSucessoNotif(null), 2000);

      // Limpar células para a próxima linha contínua
      setSerialInput('');
      setObsAtivo('');
      if (lacreAtivo === 'NÃO') {
        setKitAtivo('');
        setMarcasAtivo('');
        setLacreAtivo('SIM');
      }

      if (filtroCaixa !== 'TODAS' && filtroCaixa !== caixaLimpa) {
        setFiltroCaixa(caixaLimpa);
      } else {
        recarregarDados(filtroCaixa);
      }

      setTimeout(() => {
        tableBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        serialInputRef.current?.focus();
      }, 50);
    } else {
      sounds.playError();
      setAlertaValidacao(res.erro || 'Erro ao registrar linha de auditoria.');
      serialInputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarBipagemLinha();
    }
  };

  // Full Inline Row Editing (Excel mode) - Allows editing Modelo, EAN, Serial, Caixa, Lacre, Kit, Marcas, Obs
  const iniciarEdicaoLinha = (item: ProdutoAuditoria) => {
    setLinhaEditandoId(item.id);
    setEditModelo(item.modelo_produto);
    setEditEan(item.ean);
    setEditSerial(item.serial);
    setEditData(item.data_auditoria);
    setEditCaixa(item.numero_caixa);
    setEditLacre(item.produto_lacrado);
    setEditKit(item.kit_completo || '');
    setEditMarcas(item.aparelho_marcas_uso || '');
    setEditObs(item.observacao || '');
  };

  const salvarEdicaoLinha = (id: number) => {
    if (!editModelo.trim()) {
      alert('O modelo do produto é obrigatório.');
      return;
    }
    if (!editEan.trim()) {
      alert('O código EAN é obrigatório.');
      return;
    }
    if (!editSerial.trim()) {
      alert('O número de série é obrigatório.');
      return;
    }
    if (!editCaixa.trim()) {
      alert('A caixa é obrigatória.');
      return;
    }

    if (editLacre === 'NÃO') {
      if (!editKit) {
        alert('Para produto NÃO lacrado, selecione Kit Completo (SIM/NÃO).');
        return;
      }
      if (!editMarcas) {
        alert('Para produto NÃO lacrado, selecione Marcas de Uso (SIM/NÃO).');
        return;
      }
    }

    const res = db.atualizarProduto(id, {
      modelo_produto: editModelo.trim(),
      ean: editEan.trim(),
      serial: editSerial.trim().toUpperCase(),
      data_auditoria: editData.trim(),
      numero_caixa: editCaixa.trim(),
      produto_lacrado: editLacre,
      kit_completo: editLacre === 'SIM' ? null : (editKit as SimNao),
      aparelho_marcas_uso: editLacre === 'SIM' ? null : (editMarcas as SimNao),
      observacao: editObs.trim(),
    });

    if (!res.sucesso) {
      alert(res.erro || 'Erro ao atualizar registro.');
      return;
    }

    setLinhaEditandoId(null);
    recarregarDados(filtroCaixa);
    serialInputRef.current?.focus();
  };

  const cancelarEdicaoLinha = () => {
    setLinhaEditandoId(null);
    serialInputRef.current?.focus();
  };

  // Excluir linha
  const handleExcluirLinha = (id: number, serial: string) => {
    if (window.confirm(`Deseja remover o serial ${serial}?`)) {
      db.excluirProduto(id);
      recarregarDados(filtroCaixa);
      serialInputRef.current?.focus();
    }
  };

  // Nova Auditoria / Próxima Caixa
  const handleNovaAuditoria = () => {
    const match = caixaAtiva.match(/(\d+)/);
    let sugestaoProxima = 'Caixa 01';
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      sugestaoProxima = `Caixa ${num < 10 ? '0' + num : num}`;
    } else {
      sugestaoProxima = `${caixaAtiva} Lote 2`;
    }
    setNovaCaixaNome(sugestaoProxima);
    setMostrarNovaCaixaModal(true);
  };

  const confirmarCriacaoNovaCaixa = () => {
    const nome = novaCaixaNome.trim();
    if (nome) {
      setCaixaAtiva(nome);
      setFiltroCaixa(nome);
      setMostrarNovaCaixaModal(false);
      recarregarDados(nome);
      setSucessoNotif(`Iniciada ${nome}. Pronto para bipagem!`);
      setTimeout(() => setSucessoNotif(null), 2500);
      setTimeout(() => serialInputRef.current?.focus(), 100);
    }
  };

  // =========================================================================
  // 1. ESPELHO DA CAIXA (MODELO, EAN, QUANTIDADE E LOGOS SOLUTIONS & SAMSUNG)
  // Conforme solicitado pelo usuário:
  // "O ESPELHO PRECISA VIM O MODELO, NÃO PRECISA VIM SE ESTA LACRADO OU NÃO,
  // POIS ISSO VAI ESTA NO RELATORIO. ESPELHO MODELO, EAN E QUANTIDADE DESSE
  // MODELO REPRESENTANDO ESSE EAN. NOP ESPELHO PRECISA VIM TAMBÉM LOGO SOLUTIONS E SAMSUNG"
  // =========================================================================
  const obterDadosEspelhoCaixa = (caixaNome: string) => {
    const itens = db.listarProdutos({ caixa: caixaNome });

    // Agrupamento estrito por Modelo e EAN conforme exigência:
    // "espelho deve informar o modelo, o EAN e a quantidade. exemplo mesmo modelo e mesmo ean o espelho só informa a quantidade ex 10,
    // mudou o ean e o modelo ai vem embaixo o modelo e o ean e quantidade"
    const agrupamento = new Map<
      string,
      { item: number; modelo: string; ean: string; total: number; seriais: string[] }
    >();

    for (const p of itens) {
      const modelo = p.modelo_produto?.trim() || 'SAMSUNG';
      const ean = p.ean?.trim() || 'SEM EAN';
      const chave = `${modelo}___${ean}`;
      const ex = agrupamento.get(chave);
      if (ex) {
        ex.total++;
        ex.seriais.push(p.serial);
      } else {
        agrupamento.set(chave, {
          item: agrupamento.size + 1,
          modelo,
          ean,
          total: 1,
          seriais: [p.serial],
        });
      }
    }

    const resumoModelos = Array.from(agrupamento.values()).map((r, idx) => ({
      ...r,
      item: idx + 1,
    }));

    return {
      caixaNome,
      itens,
      totalGeral: itens.length,
      resumoModelos,
    };
  };

  // Exportar PDF Oficial do Espelho da Caixa
  const exportarEspelhoPDF = () => {
    const caixaNomeAlvo = filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa;
    const { itens, totalGeral, resumoModelos } = obterDadosEspelhoCaixa(caixaNomeAlvo);
    const usuarioAtual = db.getUsuarioAtual();

    const doc = new jsPDF();

    // 1. Logos Oficiais Solutions e Samsung
    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 10, 36, 11.8);
    } catch {
      // Fallback
    }

    try {
      doc.addImage(LOGO_SAMSUNG_BASE64, 'PNG', 160, 9, 36, 15.4);
    } catch {
      // Fallback
    }

    // 2. Título Oficial do Espelho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - CONTROLE, CONFERÊNCIA E QUALIDADE', 14, 28);

    doc.setFontSize(11);
    doc.setTextColor(12, 77, 162); // Azul Samsung
    doc.text('ESPELHO DE AUDITORIA SAMSUNG', 14, 34);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 40);
    doc.text(`Auditor Responsável: ${usuarioAtual?.nome || 'Operador'}`, 14, 45);

    // 3. Quadro de Informações da Caixa
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 49, 182, 28, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`CAIXA: ${caixaNomeAlvo.toUpperCase()}`, 18, 57);
    doc.text(`FABRICANTE: SAMSUNG`, 18, 64);
    doc.text(`REGIONAL: ${regionalAtiva}`, 18, 71);

    doc.text(`QUANTIDADE TOTAL NA CAIXA: ${totalGeral} ${totalGeral === 1 ? 'produto' : 'produtos'}`, 105, 57);
    doc.text(`MODELOS/EANS DISTINTOS: ${resumoModelos.length}`, 105, 64);

    // 4. TABELA PRINCIPAL DO ESPELHO: MODELO, EAN E QUANTIDADE AGRUPADA
    // Exatamente como solicitado:
    // "espelho deve informar o modelo, o EAN e a quantidade. exemplo mesmo modelo e mesmo ean o espelho só informa a quantidade ex 10,
    // mudou o ean e o modelo ai vem embaixo o modelo e o ean e quantidade"
    const tableData = resumoModelos.map((r) => [
      r.item.toString().padStart(2, '0'),
      r.modelo,
      r.ean,
      `${r.total} ${r.total === 1 ? 'unidade' : 'unidades'}`,
    ]);

    autoTable(doc, {
      startY: 81,
      head: [['Item', 'Modelo Produto', 'Código EAN', 'Quantidade']],
      body: tableData.length > 0 ? tableData : [['-', 'Nenhum produto registrado nesta caixa', '-', '-']],
      foot: [
        ['', 'TOTAL GERAL DE PRODUTOS NA CAIXA', '', `${totalGeral} ${totalGeral === 1 ? 'unidade' : 'unidades'}`],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [12, 77, 162],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      styles: {
        fontSize: 9,
        cellPadding: 3.5,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 16 },
        1: { fontStyle: 'bold' },
        2: { font: 'courier' },
        3: { halign: 'center', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    let currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    // 5. Relação de Seriais (Opcional se selecionado)
    if (incluirSeriaisEspelho && itens.length > 0) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('RELAÇÃO DE NÚMEROS DE SÉRIE BIPADOS NESTA CAIXA:', 14, currentY);

      const serialsData = itens.map((p, idx) => [
        (idx + 1).toString().padStart(2, '0'),
        p.modelo_produto,
        p.ean,
        p.serial,
      ]);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Nº', 'Modelo Produto', 'EAN', 'Número de Série (Serial)']],
        body: serialsData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          3: { font: 'courier', fontStyle: 'bold' },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });

      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    }

    // 6. Bloco de Assinaturas
    if (currentY > 250) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.line(18, currentY + 15, 90, currentY + 15);
    doc.text('Assinatura do Auditor Responsável', 18, currentY + 20);

    doc.line(110, currentY + 15, 182, currentY + 15);
    doc.text('Supervisão de Qualidade Grupo Solutions', 110, currentY + 20);

    doc.save(`Espelho_Auditoria_${caixaNomeAlvo.replace(/\s+/g, '_')}_Samsung.pdf`);
  };

  // =========================================================================
  // 2. RELATÓRIOS (EXCEL E PDF - DA CAIXA OU GERAL DE TODAS AS CAIXAS)
  // Conforme solicitado pelo usuário:
  // "NÃO PRECISA VIM SE ESTA LACRADO OU NÃO, POIS ISSO VAI ESTA NO RELATORIO"
  // "NO RELATORIO QUANDO EU FOR BAIXAR PODE VIM RELATORIO DE TODAS AS CAIXA, RELATORIO GERAL."
  // =========================================================================

  // Exportar Relatório em Planilha Excel (.xlsx)
  const exportarRelatorioExcel = (geralTodasCaixas: boolean) => {
    const lista = geralTodasCaixas
      ? db.listarProdutos() // Todas as caixas
      : db.listarProdutos({ caixa: filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa });

    const dados = lista.map((p, index) => ({
      'Nº': index + 1,
      Regional: p.regional || regionalAtiva,
      'Computador ID': p.computador_id || 'PC-01',
      'Nome Estação': p.computador_nome || 'Estação 01',
      Fabricante: p.fabricante,
      'Modelo Produto': p.modelo_produto,
      EAN: p.ean,
      Serial: p.serial,
      'Data Auditoria': p.data_auditoria,
      Caixa: p.numero_caixa,
      'Produto Lacrado': p.produto_lacrado,
      'Kit Completo': p.kit_completo || '-',
      'Marcas de Uso': p.aparelho_marcas_uso || '-',
      Observação: p.observacao || '-',
      Auditor: p.usuario_cadastro,
      'Status Sincronização': p.status_sincronizacao === 'ENVIADO' ? 'ENVIADO' : 'PENDENTE',
      'Data Sincronização': p.data_sincronizacao || '-',
      'ID Servidor': p.id_servidor || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    const sheetName = geralTodasCaixas
      ? 'Auditoria_Geral_Samsung'
      : (filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa).substring(0, 31);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(
      wb,
      geralTodasCaixas
        ? `Relatorio_Geral_Todas_Caixas_Samsung_${regionalAtiva.replace(/\s+/g, '_')}_${getDataAtualFormatada().replace(/\//g, '-')}.xlsx`
        : `Relatorio_Auditoria_${sheetName.replace(/\s+/g, '_')}.xlsx`
    );
  };

  // Exportar Relatório em PDF com informações completas de Lacre e Marcas
  const exportarRelatorioPDF = (geralTodasCaixas: boolean) => {
    const lista = geralTodasCaixas
      ? db.listarProdutos()
      : db.listarProdutos({ caixa: filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa });

    const doc = new jsPDF('landscape'); // Paisagem para caber todas as colunas de auditoria
    const usuarioAtual = db.getUsuarioAtual();
    const titulo = geralTodasCaixas
      ? `RELATÓRIO GERAL DE AUDITORIA - TODAS AS CAIXAS SAMSUNG (${regionalAtiva})`
      : `RELATÓRIO DE AUDITORIA E CONFERÊNCIA - ${filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa} (${regionalAtiva})`;

    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 8, 36, 11.8);
      doc.addImage(LOGO_SAMSUNG_BASE64, 'PNG', 246, 8, 36, 15.4);
    } catch {
      // Fallback
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - DEPARTAMENTO DE AUDITORIA E QUALIDADE', 14, 25);

    doc.setFontSize(10);
    doc.setTextColor(12, 77, 162);
    doc.text(titulo, 14, 30);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Emissão: ${new Date().toLocaleString('pt-BR')} | Regional: ${regionalAtiva} | Auditor: ${usuarioAtual?.nome || 'Operador'} | Total: ${lista.length} aparelhos`,
      14,
      35
    );

    const tableData = lista.map((p, idx) => [
      (idx + 1).toString(),
      p.regional || regionalAtiva,
      p.numero_caixa,
      p.modelo_produto,
      p.ean,
      p.serial,
      p.produto_lacrado,
      p.kit_completo || '-',
      p.aparelho_marcas_uso || '-',
      p.observacao || '-',
      p.data_auditoria,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nº', 'Regional', 'Caixa', 'Modelo', 'EAN', 'Serial', 'Lacrado', 'Kit Completo', 'Marcas de Uso', 'Observação', 'Data']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
      },
    });

    doc.save(
      geralTodasCaixas
        ? `Relatorio_Geral_Todas_Caixas_${regionalAtiva.replace(/\s+/g, '_')}_${getDataAtualFormatada().replace(/\//g, '-')}.pdf`
        : `Relatorio_${(filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa).replace(/\s+/g, '_')}.pdf`
    );
  };

  // Botão de Backup / Proteção de Dados (Cópia com 1 clique)
  const baixarCopiaSeguranca = () => {
    const backupJson = db.gerarArquivoBackup();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_Seguranca_Auditoria_Solutions_${getDataAtualFormatada().replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSucessoNotif('Cópia de segurança salva com sucesso! Seus dados estão 100% protegidos.');
    setTimeout(() => setSucessoNotif(null), 3000);
  };

  const handleImprimirEspelho = () => {
    setMostrarEspelhoModal(true);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const espelhoCaixaAtual = obterDadosEspelhoCaixa(filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa);

  return (
    <div className="space-y-4">
      {/* Datalists compartilhados */}
      <datalist id="lista-modelos-samsung">
        {SAMSUNG_MODELOS_PRESET.map((m) => (
          <option key={m.modelo} value={m.modelo}>
            {m.ean}
          </option>
        ))}
      </datalist>

      <datalist id="lista-caixas-existentes">
        {caixasExistentes.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* ========================================================================= */}
      {/* 1. BARRA DE FERRAMENTAS SUPERIOR (ESTILO EXCEL OPERACIONAL) */}
      {/* ========================================================================= */}
      <div className={`space-y-4 ${mostrarEspelhoModal ? 'no-print' : ''}`}>
        <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-slate-300 shadow-sm space-y-4">
        {/* Linha 1: Controles de Caixa e Botões Principais */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          
          {/* Controles de Lote e Caixa */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Regional Ativa Badge */}
            <div className="flex items-center gap-2 bg-blue-950 text-white px-3 py-1.5 rounded-xl shadow-xs border border-blue-800">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200">
                  Regional:
                </span>
                <span className="text-xs font-black text-amber-300 whitespace-nowrap">
                  {regionalAtiva}
                </span>
              </div>
            </div>

            {/* Computador / Estação Ativa Badge */}
            <div className="flex items-center gap-2 bg-indigo-950 text-white px-3 py-1.5 rounded-xl shadow-xs border border-indigo-800">
              <Laptop className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                  Estação:
                </span>
                <span className="text-xs font-black text-white whitespace-nowrap font-mono">
                  {computadorAtual.id} <span className="text-indigo-300 font-sans font-normal text-[10px]">({computadorAtual.nome})</span>
                </span>
              </div>
            </div>

            {/* Visualizar Caixa */}
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-xs">
              <Boxes className="w-4 h-4 text-blue-400 shrink-0" />
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap">
                Visualizar:
              </label>
              <select
                value={filtroCaixa}
                onChange={(e) => {
                  setFiltroCaixa(e.target.value);
                  if (e.target.value !== 'TODAS') {
                    setCaixaAtiva(e.target.value);
                  }
                }}
                className="bg-transparent font-black text-sm text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="TODAS" className="text-slate-900 font-bold">
                  ★ TODAS AS CAIXAS ({db.listarProdutos().length} produtos)
                </option>
                {caixasExistentes.map((c) => (
                  <option key={c} value={c} className="text-slate-900 font-bold">
                    {c} ({db.obterContadoresCaixa(c).totalAuditados} produtos)
                  </option>
                ))}
                {!caixasExistentes.includes(filtroCaixa) && filtroCaixa !== 'TODAS' && (
                  <option value={filtroCaixa} className="text-slate-900 font-bold">
                    {filtroCaixa}
                  </option>
                )}
              </select>
            </div>

            {/* Bipando na Caixa */}
            <div className="flex items-center gap-2 bg-blue-50 border-2 border-blue-300 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-black text-blue-900 uppercase whitespace-nowrap">Bipando na:</span>
              <input
                list="lista-caixas-existentes"
                type="text"
                value={caixaAtiva}
                onChange={(e) => setCaixaAtiva(e.target.value)}
                placeholder="Ex: Caixa 01"
                className="w-28 bg-white font-black text-xs text-blue-800 border border-blue-400 rounded px-2 py-0.5 focus:outline-none uppercase"
                title="Caixa editável. Cada caixa suporta quantos produtos você decidir!"
              />
              <span className="text-[10px] text-blue-600 font-bold hidden sm:inline">(Sem limite)</span>
            </div>

            {/* Alternador Rápido de Lacre Padrão */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 px-2.5 py-1.5 rounded-xl text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Lacre:</span>
              <button
                type="button"
                onClick={() => {
                  setLacreAtivo('SIM');
                  serialInputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] uppercase transition-all ${
                  lacreAtivo === 'SIM'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                SIM (Lacrado)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLacreAtivo('NÃO');
                  serialInputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] uppercase transition-all ${
                  lacreAtivo === 'NÃO'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                NÃO (Aberto)
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BOTÕES DE AÇÃO: ESPELHO, RELATÓRIO GERAL E SEGURANÇA */}
          {/* ========================================================================= */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            {/* 1. Nova Auditoria */}
            <button
              onClick={handleNovaAuditoria}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
              title="Iniciar nova caixa ou lote"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Caixa
            </button>

            {/* 2. Gerar Espelho da Caixa (COM LOGO SAMSUNG & SOLUTIONS, MODELO, EAN E QTD) */}
            <button
              onClick={() => {
                setIncluirSeriaisEspelho(false);
                setMostrarEspelhoModal(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Espelho da Caixa (Modelo, EAN, Quantidade e Logos)"
            >
              <FileText className="w-3.5 h-3.5" />
              Gerar Espelho
            </button>

            {/* 3. Relatório da Caixa (Excel) */}
            <button
              onClick={() => exportarRelatorioExcel(false)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Baixar relatório completo da caixa atual em Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel Caixa
            </button>

            {/* 4. Relatório Geral de Todas as Caixas (EXCEL GERAL) */}
            <button
              onClick={() => exportarRelatorioExcel(true)}
              className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Baixar Relatório Geral consolidado com TODAS as caixas em Excel"
            >
              <Files className="w-3.5 h-3.5" />
              Relatório Geral (Excel)
            </button>

            {/* 5. Relatório Geral de Todas as Caixas (PDF GERAL) */}
            <button
              onClick={() => exportarRelatorioPDF(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Baixar Relatório Geral consolidado com TODAS as caixas em PDF"
            >
              <Download className="w-3.5 h-3.5" />
              Relatório Geral (PDF)
            </button>

            {/* 6. Cópia de Segurança / Backup Anti-Perda */}
            <button
              onClick={baixarCopiaSeguranca}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Salvar cópia de segurança completa para seu computador (Risco Zero de Perda)"
            >
              <HardDrive className="w-3.5 h-3.5" />
              Backup Seguro
            </button>

            {/* 7. Importar Excel */}
            <button
              onClick={() => setMostrarImportModal(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 border border-slate-300 transition-colors cursor-pointer"
              title="Importar lista de seriais via Excel"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              Importar
            </button>
          </div>
        </div>

        {/* Linha 2: Indicadores em Tempo Real e Status de Proteção */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              {filtroCaixa === 'TODAS' ? 'Total Todas Caixas' : `Total ${caixaAtiva}`}
            </span>
            <span className="text-xl font-black text-slate-900">
              {filtroCaixa === 'TODAS' ? db.listarProdutos().length : contadores.totalAuditados}
            </span>
            <span className="text-[9px] text-slate-400 block">sem limite de capacidade</span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Caixa Ativa</span>
            <span className="text-xl font-black text-blue-700 uppercase truncate px-1 block">{caixaAtiva}</span>
            <span className="text-[9px] text-blue-500 font-bold block">100% editável</span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Lacrados (SIM)</span>
            <span className="text-xl font-black text-emerald-700">
              {filtroCaixa === 'TODAS'
                ? db.listarProdutos().filter((p) => p.produto_lacrado === 'SIM').length
                : contadores.produtosLacrados}
            </span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Não Lacrados (NÃO)</span>
            <span className="text-xl font-black text-amber-700">
              {filtroCaixa === 'TODAS'
                ? db.listarProdutos().filter((p) => p.produto_lacrado === 'NÃO').length
                : contadores.produtosNaoLacrados}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Proteção de Dados
            </span>
            <span className="text-xs font-black text-emerald-800 mt-1 block">
              IndexedDB Ativo
            </span>
            <span className="text-[9px] text-emerald-600 font-bold block">Gravado em 2 bancos</span>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {erroDuplicado && (
        <div className="bg-rose-100 border-2 border-rose-500 text-rose-900 rounded-xl p-3.5 flex items-center gap-3 shadow-md animate-bounce">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-xs font-black">{erroDuplicado}</span>
        </div>
      )}

      {alertaValidacao && (
        <div className="bg-amber-100 border border-amber-500 text-amber-900 rounded-xl p-3 flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-xs font-bold">{alertaValidacao}</span>
        </div>
      )}

      {sucessoNotif && (
        <div className="bg-emerald-100 border border-emerald-500 text-emerald-900 rounded-xl p-2.5 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{sucessoNotif}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TABELA OPERACIONAL EM FORMATO PLANILHA EXCEL */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-md overflow-hidden">
        <div className="bg-emerald-800 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold select-none">
          <div className="flex items-center gap-2">
            <span className="bg-white text-emerald-800 font-mono font-black px-1.5 py-0.5 rounded text-[10px] uppercase">
              XLS
            </span>
            <span className="uppercase tracking-wider">
              Planilha Operacional de Auditoria • {filtroCaixa === 'TODAS' ? 'Todas as Caixas' : filtroCaixa}
            </span>
          </div>
          <div className="flex items-center gap-4 text-emerald-100 text-[11px]">
            <span>{produtos.length} aparelhos listados</span>
            <span className="hidden sm:inline">• EAN, Serial e Caixa 100% editáveis</span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-200 text-slate-800 uppercase font-black text-[11px] tracking-wider sticky top-0 z-20 border-b-2 border-slate-300 select-none shadow-2xs">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center bg-slate-300 border-r border-slate-300">#</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[95px] bg-slate-100">Estação 💻</th>
                <th className="py-2.5 px-3 border-r border-slate-300 w-24">Fabricante</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[170px]">Modelo Produto ✏️</th>
                <th className="py-2.5 px-3 border-r border-slate-300 font-mono min-w-[140px]">EAN ✏️</th>
                <th className="py-2.5 px-4 border-r border-slate-300 min-w-[190px] bg-blue-100 text-blue-950">
                  Serial (Bipar / Editar) ⚡
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-28">Data Auditoria</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center min-w-[120px] bg-indigo-50 text-indigo-950">
                  Caixa ✏️
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-32">Produto Lacrado</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-28">Kit Completo</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-28">Marcas de Uso</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[160px]">Observação</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center min-w-[95px]">Status Sync</th>
                <th className="py-2.5 px-2 text-center w-16">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {produtos.map((item, index) => {
                const isEditing = linhaEditandoId === item.id;

                if (isEditing) {
                  return (
                    <tr key={item.id} className="bg-amber-50 border-2 border-amber-400">
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-500 bg-amber-100 border-r border-amber-200">
                        {index + 1}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-[10px] font-bold text-slate-700 bg-amber-100/50 border-r border-amber-200 whitespace-nowrap">
                        💻 {item.computador_id || 'PC-01'}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-700 border-r border-amber-200">
                        SAMSUNG
                      </td>

                      {/* Modelo Produto */}
                      <td className="py-2 px-2 border-r border-amber-200">
                        <input
                          list="lista-modelos-samsung"
                          type="text"
                          value={editModelo}
                          onChange={(e) => setEditModelo(e.target.value)}
                          className="w-full text-xs font-bold text-slate-900 bg-white border border-amber-400 rounded px-2 py-1"
                        />
                      </td>

                      {/* EAN */}
                      <td className="py-2 px-2 border-r border-amber-200">
                        <input
                          type="text"
                          value={editEan}
                          onChange={(e) => setEditEan(e.target.value)}
                          className="w-full font-mono text-xs font-bold text-slate-900 bg-white border border-amber-400 rounded px-2 py-1"
                        />
                      </td>

                      {/* Serial */}
                      <td className="py-2 px-2 border-r border-amber-200 bg-amber-100/50">
                        <input
                          type="text"
                          value={editSerial}
                          onChange={(e) => setEditSerial(e.target.value.toUpperCase())}
                          className="w-full font-mono text-xs font-black text-slate-950 bg-white border-2 border-amber-500 rounded px-2 py-1 uppercase tracking-wider"
                        />
                      </td>

                      {/* Data */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        <input
                          type="text"
                          value={editData}
                          onChange={(e) => setEditData(e.target.value)}
                          className="w-full text-center text-xs font-semibold text-slate-800 bg-white border border-amber-400 rounded px-1.5 py-1"
                        />
                      </td>

                      {/* Caixa */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        <input
                          list="lista-caixas-existentes"
                          type="text"
                          value={editCaixa}
                          onChange={(e) => setEditCaixa(e.target.value)}
                          className="w-full text-center text-xs font-black text-blue-900 bg-white border-2 border-blue-400 rounded px-1.5 py-1 uppercase"
                        />
                      </td>

                      {/* Produto Lacrado */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        <select
                          value={editLacre}
                          onChange={(e) => setEditLacre(e.target.value as SimNao)}
                          className="text-[11px] font-black px-2 py-1 rounded border bg-white cursor-pointer"
                        >
                          <option value="SIM">SIM</option>
                          <option value="NÃO">NÃO</option>
                        </select>
                      </td>

                      {/* Kit Completo */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        {editLacre === 'SIM' ? (
                          <span className="text-slate-400 font-bold">-</span>
                        ) : (
                          <select
                            value={editKit}
                            onChange={(e) => setEditKit(e.target.value as SimNao)}
                            className="text-[11px] font-bold bg-white border border-amber-400 rounded p-1"
                          >
                            <option value="">Selecione</option>
                            <option value="SIM">SIM</option>
                            <option value="NÃO">NÃO</option>
                          </select>
                        )}
                      </td>

                      {/* Marcas de Uso */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        {editLacre === 'SIM' ? (
                          <span className="text-slate-400 font-bold">-</span>
                        ) : (
                          <select
                            value={editMarcas}
                            onChange={(e) => setEditMarcas(e.target.value as SimNao)}
                            className="text-[11px] font-bold bg-white border border-amber-400 rounded p-1"
                          >
                            <option value="">Selecione</option>
                            <option value="NÃO">NÃO</option>
                            <option value="SIM">SIM</option>
                          </select>
                        )}
                      </td>

                      {/* Observação */}
                      <td className="py-2 px-2 border-r border-amber-200">
                        <input
                          type="text"
                          value={editObs}
                          onChange={(e) => setEditObs(e.target.value)}
                          className="w-full text-xs text-slate-800 bg-white border border-amber-300 rounded px-2 py-1"
                        />
                      </td>

                      {/* Status Sync */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.status_sincronizacao || 'PENDENTE'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => salvarEdicaoLinha(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded cursor-pointer"
                            title="Salvar alteração (Enter)"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelarEdicaoLinha}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1 rounded cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={item.id}
                    onDoubleClick={() => iniciarEdicaoLinha(item)}
                    className={`hover:bg-blue-50/60 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                    }`}
                    title="Dê um duplo clique para editar esta linha"
                  >
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-400 bg-slate-100/70 border-r border-slate-200">
                      {index + 1}
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px] font-bold text-slate-700 bg-slate-100/70 border-r border-slate-200 whitespace-nowrap">
                      💻 {item.computador_id || 'PC-01'}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                      {item.fabricante}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-200 truncate max-w-[180px]">
                      {item.modelo_produto}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600 font-medium border-r border-slate-200">
                      {item.ean}
                    </td>
                    <td className="py-2 px-4 font-mono font-black text-slate-900 tracking-wider border-r border-slate-200 bg-blue-50/30">
                      {item.serial}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-200">
                      {item.data_auditoria}
                    </td>
                    <td className="py-2 px-3 text-center font-black text-blue-700 border-r border-slate-200 bg-blue-50/20">
                      {item.numero_caixa}
                    </td>
                    <td className="py-2 px-3 text-center border-r border-slate-200">
                      <span
                        className={`font-black px-2.5 py-0.5 rounded text-[10px] ${
                          item.produto_lacrado === 'SIM'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.produto_lacrado}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-bold border-r border-slate-200">
                      {item.produto_lacrado === 'SIM' ? (
                        <span className="text-slate-300">-</span>
                      ) : (
                        <span className={item.kit_completo === 'SIM' ? 'text-emerald-700 font-black' : 'text-rose-600 font-black'}>
                          {item.kit_completo || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-bold border-r border-slate-200">
                      {item.produto_lacrado === 'SIM' ? (
                        <span className="text-slate-300">-</span>
                      ) : item.aparelho_marcas_uso === 'SIM' ? (
                        <span className="text-rose-600 font-black">SIM</span>
                      ) : (
                        <span className="text-emerald-700 font-bold">{item.aparelho_marcas_uso || '-'}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-600 italic border-r border-slate-200 truncate max-w-[160px]">
                      {item.observacao || '-'}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-200 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full ${
                          item.status_sincronizacao === 'ENVIADO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.status_sincronizacao === 'ENVIADO'
                              ? 'bg-emerald-600'
                              : 'bg-amber-600 animate-pulse'
                          }`}
                        />
                        {item.status_sincronizacao === 'ENVIADO' ? 'Enviado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => iniciarEdicaoLinha(item)}
                          title="Editar esta linha (ou duplo clique)"
                          className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleExcluirLinha(item.id, item.serial)}
                          title="Remover linha"
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* LINHA ATIVA DE ENTRADA / BIPAGEM CONTÍNUA */}
              <tr className="bg-emerald-50/80 border-t-2 border-b-2 border-emerald-600 ring-2 ring-emerald-500/50 sticky bottom-0 z-10 shadow-lg">
                <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-100 border-r border-emerald-300">
                  {produtos.length + 1} ▶
                </td>
                <td className="py-2 px-2 text-center font-mono text-[10px] font-bold text-emerald-950 bg-emerald-100/70 border-r border-emerald-300 whitespace-nowrap">
                  💻 {computadorAtual.id}
                </td>
                <td className="py-2 px-3 font-black text-slate-800 border-r border-emerald-300">
                  SAMSUNG
                </td>

                {/* MODELO PRODUTO */}
                <td className="py-2 px-2 border-r border-emerald-300">
                  <input
                    list="lista-modelos-samsung"
                    type="text"
                    value={modeloAtivo}
                    onChange={(e) => handleModeloChange(e.target.value)}
                    placeholder="Ex: Galaxy S24"
                    className="w-full text-xs font-black text-slate-900 bg-white border border-slate-300 rounded px-2 py-1.5 focus:border-emerald-600 focus:outline-none"
                    title="Digite ou selecione o modelo"
                  />
                </td>

                {/* EAN */}
                <td className="py-2 px-2 border-r border-emerald-300">
                  <input
                    type="text"
                    value={eanAtivo}
                    onChange={(e) => setEanAtivo(e.target.value)}
                    placeholder="EAN 789..."
                    className="w-full font-mono text-xs font-black text-slate-900 bg-white border-2 border-emerald-500 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    title="Código EAN editável"
                  />
                </td>

                {/* SERIAL */}
                <td className="py-2 px-2 border-r border-emerald-300 bg-white">
                  <input
                    ref={serialInputRef}
                    type="text"
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="Bipe o serial aqui..."
                    className="w-full font-mono font-black text-sm text-slate-950 bg-blue-50/50 border-2 border-blue-600 rounded px-2.5 py-1.5 focus:outline-none tracking-wider placeholder:text-slate-400 uppercase"
                    autoFocus
                    title="Posicione o cursor aqui e bipe com o leitor"
                  />
                </td>

                {/* DATA AUDITORIA */}
                <td className="py-2 px-2 text-center border-r border-emerald-300">
                  <input
                    type="text"
                    value={dataAtiva}
                    onChange={(e) => setDataAtiva(e.target.value)}
                    className="w-full text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:outline-none"
                    title="Data da auditoria"
                  />
                </td>

                {/* CAIXA */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 bg-blue-50/50">
                  <input
                    list="lista-caixas-existentes"
                    type="text"
                    value={caixaAtiva}
                    onChange={(e) => setCaixaAtiva(e.target.value)}
                    placeholder="Ex: Caixa 01"
                    className="w-full text-center text-xs font-black text-blue-900 bg-white border-2 border-blue-500 rounded px-2 py-1.5 focus:outline-none uppercase"
                    title="Caixa editável. Sem limite de produtos!"
                  />
                </td>

                {/* PRODUTO LACRADO */}
                <td className="py-2 px-2 text-center border-r border-emerald-300">
                  <select
                    value={lacreAtivo}
                    onChange={(e) => {
                      const val = e.target.value as SimNao;
                      setLacreAtivo(val);
                      if (val === 'SIM') {
                        setKitAtivo('');
                        setMarcasAtivo('');
                        serialInputRef.current?.focus();
                      } else {
                        setTimeout(() => kitSelectRef.current?.focus(), 50);
                      }
                    }}
                    className={`w-full text-[11px] font-black px-2 py-1.5 rounded-md border focus:outline-none cursor-pointer ${
                      lacreAtivo === 'SIM'
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-amber-600 text-white border-amber-700'
                    }`}
                  >
                    <option value="SIM">SIM</option>
                    <option value="NÃO">NÃO</option>
                  </select>
                </td>

                {/* KIT COMPLETO */}
                <td className="py-2 px-2 text-center border-r border-emerald-300">
                  {lacreAtivo === 'SIM' ? (
                    <span className="text-slate-400 font-bold">-</span>
                  ) : (
                    <select
                      ref={kitSelectRef}
                      value={kitAtivo}
                      onChange={(e) => {
                        setKitAtivo(e.target.value as SimNao);
                        marcasSelectRef.current?.focus();
                      }}
                      className="w-full text-[11px] font-bold bg-white border border-amber-500 rounded p-1 text-slate-900 cursor-pointer"
                    >
                      <option value="">Selecione</option>
                      <option value="SIM">SIM</option>
                      <option value="NÃO">NÃO</option>
                    </select>
                  )}
                </td>

                {/* MARCAS DE USO */}
                <td className="py-2 px-2 text-center border-r border-emerald-300">
                  {lacreAtivo === 'SIM' ? (
                    <span className="text-slate-400 font-bold">-</span>
                  ) : (
                    <select
                      ref={marcasSelectRef}
                      value={marcasAtivo}
                      onChange={(e) => setMarcasAtivo(e.target.value as SimNao)}
                      className="w-full text-[11px] font-bold bg-white border border-amber-500 rounded p-1 text-slate-900 cursor-pointer"
                    >
                      <option value="">Selecione</option>
                      <option value="NÃO">NÃO</option>
                      <option value="SIM">SIM</option>
                    </select>
                  )}
                </td>

                {/* OBSERVAÇÃO */}
                <td className="py-2 px-2 border-r border-emerald-300">
                  <input
                    type="text"
                    value={obsAtivo}
                    onChange={(e) => setObsAtivo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        processarBipagemLinha();
                      }
                    }}
                    placeholder="Obs livre..."
                    className="w-full text-xs text-slate-900 bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none"
                  />
                </td>

                {/* STATUS SYNC PADRÃO (PENDENTE) */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                    Pendente
                  </span>
                </td>

                {/* BOTÃO ENTER */}
                <td className="py-2 px-2 text-center">
                  <button
                    type="button"
                    onClick={processarBipagemLinha}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[11px] uppercase px-2 py-1.5 rounded shadow-xs flex items-center justify-center mx-auto gap-1 cursor-pointer"
                    title="Adicionar linha (Enter)"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div ref={tableBottomRef} />
        </div>

        {/* Rodapé de Status */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-bold text-slate-600 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Pronto para bipagem contínua
            </span>
            <span>Caixa Ativa: <strong className="text-blue-800">{caixaAtiva}</strong></span>
            <span>Regional: <strong className="text-purple-800">{regionalAtiva}</strong></span>
            <span>Quantidade: <strong className="text-slate-900">{produtos.length} aparelhos</strong> (sem limite)</span>
          </div>
          <div className="text-slate-500 font-normal">
            💡 EAN, Serial e Caixa podem ser alterados diretamente em cada linha ou com duplo clique.
          </div>
        </div>
      </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL: GERADOR DE ESPELHO DA CAIXA (COM LOGOS SOLUTIONS E SAMSUNG) */}
      {/* Mostra Modelo, EAN e Quantidade desse modelo representando esse EAN */}
      {/* SEM colunas de lacre, kit ou marcas (que pertencem aos relatórios) */}
      {/* ========================================================================= */}
      {mostrarEspelhoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs no-print-backdrop">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 print-container">
            
            {/* Cabeçalho do Espelho com LOGO SOLUTIONS E LOGO SAMSUNG */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-5">
                <SolutionsLogo height={38} />
                <div className="h-8 w-px bg-slate-200" />
                <SamsungLogo height={24} />
              </div>
              <button
                onClick={() => setMostrarEspelhoModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg no-print cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Título Oficial */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                ESPELHO DE AUDITORIA
              </h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Grupo Solutions • Setor de Rastreabilidade e Qualidade Samsung
              </p>
            </div>

            {/* Quadro de Detalhes da Caixa: Caixa, Regional, Fabricante SAMSUNG e Total */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Caixa:</span>
                  <span className="font-black text-blue-700 text-base uppercase">{espelhoCaixaAtual.caixaNome}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Regional:</span>
                  <span className="font-black text-purple-700 text-base uppercase">{regionalAtiva}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Fabricante:</span>
                  <span className="font-black text-slate-900 text-base">SAMSUNG</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Qtd Total:</span>
                  <span className="font-black text-emerald-700 text-base">
                    {espelhoCaixaAtual.totalGeral}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Modelos:</span>
                  <span className="font-black text-slate-800 text-base">
                    {espelhoCaixaAtual.resumoModelos.length}
                  </span>
                </div>
              </div>
            </div>

            {/* TABELA PRINCIPAL DO ESPELHO: MODELO, EAN E QUANTIDADE */}
            {/* Conforme solicitação: se mesmo modelo e mesmo EAN -> exibe 1 linha com a quantidade (ex: 10). */}
            {/* Mudou o EAN ou modelo -> vem na linha de baixo com seu modelo, EAN e quantidade. */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase text-slate-800 tracking-wide">
                  Conteúdo da Caixa (Modelo, EAN e Quantidade):
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {espelhoCaixaAtual.resumoModelos.length} item(ns) agrupado(s)
                </span>
              </div>

              <div className="border-2 border-slate-300 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#0C4DA2] text-white uppercase text-[11px] font-black tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-center w-16 border-r border-blue-600">Item</th>
                      <th className="py-3 px-5 border-r border-blue-600">Modelo Produto</th>
                      <th className="py-3 px-5 font-mono border-r border-blue-600">Código EAN</th>
                      <th className="py-3 px-5 text-center w-36">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {espelhoCaixaAtual.resumoModelos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400 font-medium">
                          Nenhum produto registrado nesta caixa até o momento.
                        </td>
                      </tr>
                    ) : (
                      espelhoCaixaAtual.resumoModelos.map((item) => (
                        <tr key={`${item.modelo}___${item.ean}`} className="hover:bg-blue-50/50 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400 border-r border-slate-200">
                            {item.item.toString().padStart(2, '0')}
                          </td>
                          <td className="py-3 px-5 font-bold text-slate-900 text-sm border-r border-slate-200">
                            {item.modelo}
                          </td>
                          <td className="py-3 px-5 font-mono text-slate-700 text-xs border-r border-slate-200 font-bold">
                            {item.ean}
                          </td>
                          <td className="py-3 px-5 text-center border-slate-200">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800">
                              {item.total} {item.total === 1 ? 'unidade' : 'unidades'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={3} className="py-3 px-5 text-right uppercase text-xs tracking-wider">
                        Total Geral de Produtos na Caixa:
                      </td>
                      <td className="py-3 px-5 text-center text-sm text-emerald-700 font-black">
                        {espelhoCaixaAtual.totalGeral} {espelhoCaixaAtual.totalGeral === 1 ? 'produto' : 'produtos'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Opção de Controle de Seriais (Impressão e PDF) */}
            <div className="bg-slate-100 p-3 rounded-2xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-700 whitespace-nowrap">
                  Tipo de Espelho:
                </span>
                <div className="inline-flex bg-white rounded-xl p-1 border border-slate-300 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setIncluirSeriaisEspelho(false)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                      !incluirSeriaisEspelho
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    📄 Espelho Padrão (Sem Serial)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncluirSeriaisEspelho(true)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                      incluirSeriaisEspelho
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    📋 Espelho com Serial
                  </button>
                </div>
              </div>
              <span className="text-xs text-slate-600 font-bold">
                {incluirSeriaisEspelho
                  ? '🟢 Modo com Seriais Ativo: Os números de série sairão na impressão'
                  : '⚪ Modo Padrão Ativo: Apenas Modelo, EAN e Quantidade (sem seriais)'}
              </span>
            </div>

            {/* Relação de Seriais (Exibida caso o usuário ative a opção ou queira conferir) */}
            {incluirSeriaisEspelho && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-700 tracking-wide">
                    Relação Detalhada de Seriais da {espelhoCaixaAtual.caixaNome}:
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {espelhoCaixaAtual.itens.length} seriais
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800 text-white uppercase text-[10px] font-black tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2 px-3 text-center w-12 border-r border-slate-700">Nº</th>
                        <th className="py-2 px-4 border-r border-slate-700">Modelo Produto</th>
                        <th className="py-2 px-4 font-mono border-r border-slate-700">EAN</th>
                        <th className="py-2 px-4 font-mono">Número de Série (Serial)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {espelhoCaixaAtual.itens.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 font-sans">
                            Nenhum serial nesta caixa.
                          </td>
                        </tr>
                      ) : (
                        espelhoCaixaAtual.itens.map((p, index) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 text-center text-slate-400 font-sans border-r border-slate-100">
                              {(index + 1).toString().padStart(2, '0')}
                            </td>
                            <td className="py-1.5 px-4 font-sans font-bold text-slate-700 border-r border-slate-100">
                              {p.modelo_produto}
                            </td>
                            <td className="py-1.5 px-4 text-slate-500 border-r border-slate-100">
                              {p.ean}
                            </td>
                            <td className="py-1.5 px-4 font-black text-slate-900 tracking-wider">
                              {p.serial}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Assinaturas no Espelho */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
              <div>
                <div className="border-t border-slate-300 w-3/4 mx-auto mb-1"></div>
                <span>Auditor Responsável</span>
              </div>
              <div>
                <div className="border-t border-slate-300 w-3/4 mx-auto mb-1"></div>
                <span>Supervisão Grupo Solutions</span>
              </div>
            </div>

            {/* Ações do Modal do Espelho */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100 no-print">
              <button
                onClick={() => setMostrarEspelhoModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={handleImprimirEspelho}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase text-white shadow-xs flex items-center gap-1.5 cursor-pointer ${
                  incluirSeriaisEspelho ? 'bg-purple-700 hover:bg-purple-800' : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                <Printer className="w-4 h-4" />
                {incluirSeriaisEspelho ? 'Imprimir Espelho com Serial' : 'Imprimir Espelho (Padrão)'}
              </button>
              <button
                onClick={exportarEspelhoPDF}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {incluirSeriaisEspelho ? 'Baixar PDF com Serial' : 'Baixar PDF do Espelho (Padrão)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: NOVA AUDITORIA / NOVA CAIXA */}
      {/* ========================================================================= */}
      {mostrarNovaCaixaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-600" />
                Iniciar Nova Caixa
              </h3>
              <button
                onClick={() => setMostrarNovaCaixaModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Defina a identificação da caixa. Cada caixa pode conter quantos produtos você decidir, sem limite.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Identificação da Caixa:</label>
              <input
                type="text"
                value={novaCaixaNome}
                onChange={(e) => setNovaCaixaNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmarCriacaoNovaCaixa();
                  }
                }}
                placeholder="Ex: Caixa 02"
                className="w-full text-sm font-black text-slate-900 border-2 border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-600"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                onClick={() => setMostrarNovaCaixaModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCriacaoNovaCaixa}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl shadow-xs cursor-pointer"
              >
                Iniciar Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: IMPORTAÇÃO EXCEL EM LOTE */}
      {/* ========================================================================= */}
      {mostrarImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 uppercase flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                Importar Planilha de Auditoria
              </h3>
              <button
                onClick={() => setMostrarImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Selecione um arquivo Excel (.xlsx, .xls ou .csv) contendo as colunas: <strong>Modelo</strong>,{' '}
              <strong>EAN</strong>, <strong>Serial</strong>, <strong>Caixa</strong> e <strong>Data</strong>.
            </p>

            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-2xl p-8 text-center bg-slate-50 transition-colors">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <label className="inline-block bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl cursor-pointer shadow-xs transition-transform active:scale-95">
                Selecionar Planilha Excel
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      try {
                        const bstr = evt.target?.result;
                        const wb = XLSX.read(bstr, { type: 'binary' });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const raw = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws);
                        const normalizado = raw.map((r) => ({
                          modelo: String(r['Modelo'] || r['modelo'] || modeloAtivo),
                          ean: String(r['EAN'] || r['ean'] || eanAtivo),
                          serial: String(r['Serial'] || r['serial'] || ''),
                          caixa: String(r['Caixa'] || r['caixa'] || caixaAtiva),
                          data: String(r['Data'] || r['data'] || getDataAtualFormatada()),
                          lacrado: String(r['Lacrado'] || r['lacrado'] || 'SIM'),
                        }));
                        const res = db.importarPlanilha(normalizado);
                        alert(
                          `Importação concluída!\nProcessados: ${res.totalProcessado}\nGravados: ${res.sucessoCount}\nDuplicados: ${res.duplicadosCount}`
                        );
                        recarregarDados(filtroCaixa);
                        setMostrarImportModal(false);
                      } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : String(err);
                        alert('Erro ao importar planilha: ' + message);
                      }
                    };
                    reader.readAsBinaryString(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BipagemRapida;
