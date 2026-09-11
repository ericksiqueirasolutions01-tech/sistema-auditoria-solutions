import React, { useState, useRef, useEffect } from 'react';
import { db, SAMSUNG_MODELOS_PRESET } from '../db/storage';
import { ProdutoAuditoria, SimNao } from '../types';
import { sounds } from '../utils/audio';
import { SamsungLogo } from '../components/SamsungLogo';
import { SolutionsLogo } from '../components/SolutionsLogo';
import {
  Table,
  Plus,
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  ShieldAlert,
  Trash2,
  X,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const BipagemRapida: React.FC = () => {
  const caixasDisponiveis = db.listarCaixas();
  const [caixaAtiva, setCaixaAtiva] = useState(
    caixasDisponiveis.length > 0 ? caixasDisponiveis[0] : 'CAIXA 01'
  );

  // Model & Preset for the active batch
  const [modeloAtivo, setModeloAtivo] = useState(SAMSUNG_MODELOS_PRESET[0].modelo);
  const [eanAtivo, setEanAtivo] = useState(SAMSUNG_MODELOS_PRESET[0].ean);
  const [lacrePadrao, setLacrePadrao] = useState<SimNao>('SIM');

  // Active input row state (Excel current cell)
  const [serialInput, setSerialInput] = useState('');
  const [kitInput, setKitInput] = useState<SimNao | ''>('');
  const [marcasInput, setMarcasInput] = useState<SimNao | ''>('');
  const [obsInput, setObsInput] = useState('');

  // UI Modals
  const [mostrarEspelhoModal, setMostrarEspelhoModal] = useState(false);
  const [mostrarImportModal, setMostrarImportModal] = useState(false);

  // Alerts
  const [erroDuplicado, setErroDuplicado] = useState<string | null>(null);
  const [alertaValidacao, setAlertaValidacao] = useState<string | null>(null);
  const [sucessoNotif, setSucessoNotif] = useState<string | null>(null);

  // Data
  const [produtos, setProdutos] = useState<ProdutoAuditoria[]>(() =>
    db.listarProdutos({ caixa: caixaAtiva })
  );
  const [contadores, setContadores] = useState(() =>
    db.obterContadoresCaixa(caixaAtiva)
  );

  const serialInputRef = useRef<HTMLInputElement>(null);
  const tableBottomRef = useRef<HTMLDivElement>(null);

  // Keep focus on the serial cell
  useEffect(() => {
    serialInputRef.current?.focus();
  }, [caixaAtiva, produtos.length]);

  // Refresh when box changes
  useEffect(() => {
    recarregarDados(caixaAtiva);
  }, [caixaAtiva]);

  const recarregarDados = (nomeCaixa: string) => {
    setProdutos(db.listarProdutos({ caixa: nomeCaixa }));
    setContadores(db.obterContadoresCaixa(nomeCaixa));
  };

  const handleModeloChange = (novoModelo: string) => {
    setModeloAtivo(novoModelo);
    const encontrado = SAMSUNG_MODELOS_PRESET.find((m) => m.modelo === novoModelo);
    if (encontrado) {
      setEanAtivo(encontrado.ean);
    }
  };

  // Main Bipagem Trigger (Excel Row Enter)
  const processarLinhaBipagem = () => {
    const serialLimpo = serialInput.trim().toUpperCase();
    setErroDuplicado(null);
    setAlertaValidacao(null);
    setSucessoNotif(null);

    if (!serialLimpo) {
      setAlertaValidacao('Por favor, bipe ou digite o serial do produto.');
      sounds.playError();
      serialInputRef.current?.focus();
      return;
    }

    // 1. VALIDATE DUPLICITY
    const check = db.validarDuplicidade(serialLimpo);
    if (check.duplicado && check.produto) {
      sounds.playError();
      setErroDuplicado(
        `SERIAL DUPLICADO: Este número já foi auditado na ${check.produto.numero_caixa} em ${check.produto.data_auditoria}.`
      );
      serialInputRef.current?.select();
      return;
    }

    // 2. VALIDATE NON-SEALED MANDATORY FIELDS
    if (lacrePadrao === 'NÃO') {
      if (!kitInput) {
        sounds.playError();
        setAlertaValidacao('Para produto NÃO lacrado, selecione se o Kit está Completo (SIM/NÃO).');
        return;
      }
      if (!marcasInput) {
        sounds.playError();
        setAlertaValidacao('Para produto NÃO lacrado, selecione se há Marcas de Uso (SIM/NÃO).');
        return;
      }
    }

    // 3. INSERT IN DATABASE
    const dataHoje = new Date().toISOString().split('T')[0];
    const res = db.inserirProduto({
      modelo_produto: modeloAtivo,
      ean: eanAtivo,
      serial: serialLimpo,
      data_auditoria: dataHoje,
      numero_caixa: caixaAtiva,
      produto_lacrado: lacrePadrao,
      kit_completo: lacrePadrao === 'SIM' ? null : (kitInput as SimNao),
      aparelho_marcas_uso: lacrePadrao === 'SIM' ? null : (marcasInput as SimNao),
      observacao: obsInput,
    });

    if (res.sucesso && res.produto) {
      sounds.playSuccess();
      setSucessoNotif(`Serial ${serialLimpo} registrado na planilha!`);
      setTimeout(() => setSucessoNotif(null), 2000);

      // Reset cell inputs for the next continuous row
      setSerialInput('');
      setObsInput('');
      if (lacrePadrao === 'NÃO') {
        setKitInput('');
        setMarcasInput('');
      }

      // Refresh list & counters
      recarregarDados(caixaAtiva);

      // Scroll to new row and keep focus
      tableBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      serialInputRef.current?.focus();
    } else {
      sounds.playError();
      setAlertaValidacao(res.erro || 'Falha ao registrar linha.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarLinhaBipagem();
    }
  };

  // Excluir linha
  const handleExcluirLinha = (id: number, serial: string) => {
    if (window.confirm(`Deseja excluir o registro do serial ${serial}?`)) {
      db.excluirProduto(id);
      recarregarDados(caixaAtiva);
    }
  };

  // Iniciar Nova Auditoria / Nova Caixa
  const handleNovaAuditoria = () => {
    const match = caixaAtiva.match(/(\d+)/);
    let novoNome = 'CAIXA 01';
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      novoNome = `CAIXA ${num < 10 ? '0' + num : num}`;
    } else {
      novoNome = `${caixaAtiva} - LOTE NOVO`;
    }
    setCaixaAtiva(novoNome);
  };

  // Exportar Excel
  const exportarPlanilhaExcel = () => {
    const dados = produtos.map((p, index) => ({
      'Nº': index + 1,
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
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, caixaAtiva.substring(0, 31));
    XLSX.writeFile(wb, `Planilha_Auditoria_${caixaAtiva.replace(/\s+/g, '_')}.xlsx`);
  };

  // Exportar PDF do Espelho da Caixa
  const exportarEspelhoPDF = () => {
    const doc = new jsPDF();
    const usuarioAtual = db.getUsuarioAtual();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - SETOR DE AUDITORIA & QUALIDADE', 14, 18);

    doc.setFontSize(11);
    doc.setTextColor(12, 77, 162); // Samsung Blue
    doc.text('ESPELHO DE AUDITORIA SAMSUNG', 14, 25);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 31);
    doc.text(`Auditor Responsável: ${usuarioAtual?.nome || 'Operador'}`, 14, 36);

    // Box Summary Info
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 41, 182, 28, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`CAIXA: ${caixaAtiva}`, 18, 49);
    doc.text(`FABRICANTE: SAMSUNG`, 18, 55);
    doc.text(`MODELO: ${modeloAtivo}`, 18, 61);

    doc.text(`EAN: ${eanAtivo}`, 110, 49);
    doc.text(`QUANTIDADE TOTAL: ${produtos.length} produtos`, 110, 55);
    doc.text(
      `STATUS: ${contadores.produtosLacrados} Lacrados | ${contadores.produtosNaoLacrados} Abertos`,
      110,
      61
    );

    const tableData = produtos.map((p, idx) => [
      (idx + 1).toString().padStart(2, '0'),
      p.serial,
      p.produto_lacrado,
      p.kit_completo || '-',
      p.aparelho_marcas_uso || '-',
      p.observacao || '-',
    ]);

    autoTable(doc, {
      startY: 74,
      head: [['Nº', 'Serial', 'Lacrado', 'Kit Completo', 'Marcas de Uso', 'Observação']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [12, 77, 162],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    if (finalY < 270) {
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.line(18, finalY + 10, 90, finalY + 10);
      doc.text('Assinatura do Auditor Responsável', 18, finalY + 15);

      doc.line(110, finalY + 10, 182, finalY + 10);
      doc.text('Supervisão / Qualidade Grupo Solutions', 110, finalY + 15);
    }

    doc.save(`Espelho_${caixaAtiva.replace(/\s+/g, '_')}_Samsung.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP CONTROL BAR & EXCEL TOOLBAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-300 shadow-xs space-y-4">
        {/* Row 1: Box selector & Action Buttons */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Caixa Atual Selector */}
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-xs">
              <Boxes className="w-4 h-4 text-blue-400" />
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Caixa Atual:
              </label>
              <select
                value={caixaAtiva}
                onChange={(e) => setCaixaAtiva(e.target.value)}
                className="bg-transparent font-black text-sm text-white focus:outline-none uppercase cursor-pointer"
              >
                {caixasDisponiveis.map((c) => (
                  <option key={c} value={c} className="text-slate-900">
                    {c}
                  </option>
                ))}
                {!caixasDisponiveis.includes(caixaAtiva) && (
                  <option value={caixaAtiva} className="text-slate-900">
                    {caixaAtiva}
                  </option>
                )}
              </select>
            </div>

            {/* Model Preset for the batch */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Modelo:</span>
              <select
                value={modeloAtivo}
                onChange={(e) => handleModeloChange(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-800 focus:outline-none cursor-pointer"
              >
                {SAMSUNG_MODELOS_PRESET.map((m) => (
                  <option key={m.modelo} value={m.modelo}>
                    {m.modelo}
                  </option>
                ))}
              </select>
            </div>

            {/* Lacre default */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Lacre:</span>
              <button
                type="button"
                onClick={() => setLacrePadrao('SIM')}
                className={`px-2 py-0.5 rounded font-black text-[11px] uppercase transition-colors ${
                  lacrePadrao === 'SIM'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                SIM (Lacrado)
              </button>
              <button
                type="button"
                onClick={() => setLacrePadrao('NÃO')}
                className={`px-2 py-0.5 rounded font-black text-[11px] uppercase transition-colors ${
                  lacrePadrao === 'NÃO'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                NÃO (Aberto)
              </button>
            </div>
          </div>

          {/* Action Buttons Required by Prompt */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={handleNovaAuditoria}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
              title="Iniciar nova caixa ou lote"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Auditoria
            </button>

            <button
              onClick={() => setMostrarImportModal(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border border-slate-300 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar Excel
            </button>

            <button
              onClick={() => setMostrarEspelhoModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Gerar Espelho
            </button>

            <button
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>

            <button
              onClick={exportarEspelhoPDF}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>

            <button
              onClick={exportarPlanilhaExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          </div>
        </div>

        {/* Row 2: Live Statistics Counters Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Auditado</span>
            <span className="text-xl font-black text-slate-900">{contadores.totalAuditados}</span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Caixa Atual</span>
            <span className="text-xl font-black text-blue-700 uppercase">{caixaAtiva}</span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-emerald-600 uppercase block">Lacrados</span>
            <span className="text-xl font-black text-emerald-600">{contadores.produtosLacrados}</span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-amber-600 uppercase block">Não Lacrados</span>
            <span className="text-xl font-black text-amber-600">{contadores.produtosNaoLacrados}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-rose-600 uppercase block">Pendências</span>
            <span className="text-xl font-black text-rose-600">{contadores.pendencias}</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {erroDuplicado && (
        <div className="bg-rose-50 border-2 border-rose-500 text-rose-900 rounded-xl p-3.5 flex items-center gap-3 shadow-sm animate-pulse">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-xs font-black">{erroDuplicado}</span>
        </div>
      )}

      {alertaValidacao && (
        <div className="bg-amber-50 border border-amber-400 text-amber-900 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-xs font-bold">{alertaValidacao}</span>
        </div>
      )}

      {sucessoNotif && (
        <div className="bg-emerald-50 border border-emerald-400 text-emerald-900 rounded-xl p-2.5 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{sucessoNotif}</span>
        </div>
      )}

      {/* 2. THE SPREADSHEET GRID (EXCEL FORMAT) */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-md overflow-hidden">
        {/* Excel Tab Header Bar */}
        <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-700 text-white font-mono font-bold px-2 py-0.5 rounded text-[11px]">
              XLS
            </span>
            <span className="uppercase tracking-wider">Planilha Operacional de Auditoria Contínua</span>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">
            {produtos.length} linhas registradas • [Enter] pula e salva automaticamente
          </span>
        </div>

        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            {/* Excel Headers */}
            <thead className="bg-slate-200/90 text-slate-800 uppercase font-black text-[11px] tracking-wider sticky top-0 z-20 border-b-2 border-slate-300 select-none shadow-2xs">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center bg-slate-300/80 border-r border-slate-300">
                  #
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300">Fabricante</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[150px]">Modelo Produto</th>
                <th className="py-2.5 px-3 border-r border-slate-300 font-mono">EAN</th>
                <th className="py-2.5 px-4 border-r border-slate-300 min-w-[180px] bg-blue-100/70 text-blue-950">
                  Serial (Bipar) ⚡
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center">Data Auditoria</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center">Caixa</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center">Produto Lacrado</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center">Kit Completo</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center">Marcas de Uso</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[140px]">Observação</th>
                <th className="py-2.5 px-2 text-center w-12">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {/* Existing Recorded Rows (Excel Data Rows) */}
              {produtos.map((item, index) => (
                <tr
                  key={item.id}
                  className={`hover:bg-blue-50/50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-400 bg-slate-100/60 border-r border-slate-200">
                    {index + 1}
                  </td>
                  <td className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                    {item.fabricante}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-200 truncate max-w-[160px]">
                    {item.modelo_produto}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-500 border-r border-slate-200">
                    {item.ean}
                  </td>
                  <td className="py-2 px-4 font-mono font-black text-slate-900 tracking-wider border-r border-slate-200 bg-blue-50/30">
                    {item.serial}
                  </td>
                  <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-200">
                    {item.data_auditoria}
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-blue-700 border-r border-slate-200">
                    {item.numero_caixa}
                  </td>
                  <td className="py-2 px-3 text-center border-r border-slate-200">
                    <span
                      className={`font-black px-2 py-0.5 rounded text-[10px] ${
                        item.produto_lacrado === 'SIM'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.produto_lacrado}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-bold border-r border-slate-200">
                    {item.kit_completo || '-'}
                  </td>
                  <td className="py-2 px-3 text-center font-bold border-r border-slate-200">
                    {item.aparelho_marcas_uso === 'SIM' ? (
                      <span className="text-rose-600 font-black">SIM</span>
                    ) : (
                      item.aparelho_marcas_uso || '-'
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-500 italic border-r border-slate-200 truncate max-w-[150px]">
                    {item.observacao || '-'}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => handleExcluirLinha(item.id, item.serial)}
                      title="Remover linha"
                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* 3. ACTIVE SCANNING ROW (Continuous Excel Input Cell) */}
              <tr className="bg-emerald-50/60 border-t-2 border-emerald-500 ring-2 ring-emerald-400/40 z-10 sticky bottom-0 shadow-lg">
                <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-100 border-r border-emerald-200">
                  {produtos.length + 1} ▶
                </td>
                <td className="py-2 px-3 font-black text-slate-700 border-r border-emerald-200">
                  SAMSUNG
                </td>
                <td className="py-2 px-3 border-r border-emerald-200">
                  <span className="font-bold text-slate-800 text-xs block">{modeloAtivo}</span>
                </td>
                <td className="py-2 px-3 font-mono text-slate-500 border-r border-emerald-200">
                  {eanAtivo}
                </td>

                {/* The Continuous Barcode Input Cell */}
                <td className="py-2 px-3 border-r border-emerald-200 bg-white">
                  <div className="relative">
                    <input
                      ref={serialInputRef}
                      type="text"
                      value={serialInput}
                      onChange={(e) => setSerialInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Bipe o serial..."
                      className="w-full font-mono font-black text-sm text-slate-900 bg-transparent focus:outline-none tracking-wider placeholder:text-slate-400 uppercase"
                      autoFocus
                    />
                  </div>
                </td>

                <td className="py-2 px-3 text-center text-slate-500 border-r border-emerald-200">
                  {new Date().toISOString().split('T')[0]}
                </td>
                <td className="py-2 px-3 text-center font-black text-blue-700 uppercase border-r border-emerald-200">
                  {caixaAtiva}
                </td>

                {/* Produto Lacrado toggle */}
                <td className="py-2 px-2 text-center border-r border-emerald-200">
                  <select
                    value={lacrePadrao}
                    onChange={(e) => {
                      setLacrePadrao(e.target.value as SimNao);
                      serialInputRef.current?.focus();
                    }}
                    className={`text-[11px] font-black px-2 py-1 rounded border focus:outline-none cursor-pointer ${
                      lacrePadrao === 'SIM'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-amber-500 text-white border-amber-600'
                    }`}
                  >
                    <option value="SIM">SIM</option>
                    <option value="NÃO">NÃO</option>
                  </select>
                </td>

                {/* Kit Completo */}
                <td className="py-2 px-2 text-center border-r border-emerald-200">
                  {lacrePadrao === 'SIM' ? (
                    <span className="text-slate-400 font-bold">-</span>
                  ) : (
                    <select
                      value={kitInput}
                      onChange={(e) => setKitInput(e.target.value as SimNao)}
                      className="text-[11px] font-bold bg-white border border-amber-300 rounded p-1"
                    >
                      <option value="">Selecione</option>
                      <option value="SIM">SIM</option>
                      <option value="NÃO">NÃO</option>
                    </select>
                  )}
                </td>

                {/* Marcas de Uso */}
                <td className="py-2 px-2 text-center border-r border-emerald-200">
                  {lacrePadrao === 'SIM' ? (
                    <span className="text-slate-400 font-bold">-</span>
                  ) : (
                    <select
                      value={marcasInput}
                      onChange={(e) => setMarcasInput(e.target.value as SimNao)}
                      className="text-[11px] font-bold bg-white border border-amber-300 rounded p-1"
                    >
                      <option value="">Selecione</option>
                      <option value="NÃO">NÃO</option>
                      <option value="SIM">SIM</option>
                    </select>
                  )}
                </td>

                {/* Observação */}
                <td className="py-2 px-2 border-r border-emerald-200">
                  <input
                    type="text"
                    value={obsInput}
                    onChange={(e) => setObsInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        processarLinhaBipagem();
                      }
                    }}
                    placeholder="Obs livre..."
                    className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none"
                  />
                </td>

                {/* Add button */}
                <td className="py-2 px-2 text-center">
                  <button
                    type="button"
                    onClick={processarLinhaBipagem}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase p-1.5 rounded shadow-xs"
                    title="Adicionar Linha (Enter)"
                  >
                    Enter ↵
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div ref={tableBottomRef} />
        </div>

        {/* Excel Status Bar Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-2 flex items-center justify-between text-[11px] font-bold text-slate-600 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Pronto para leitura
            </span>
            <span>Caixa: {caixaAtiva}</span>
            <span>Total da Caixa: {produtos.length} linhas</span>
          </div>
          <div className="text-slate-500">
            Dica: Para produtos lacrados, basta bipar o leitor que a próxima linha é criada
            automaticamente.
          </div>
        </div>
      </div>

      {/* 4. MODAL: GERAR ESPELHO DA CAIXA (Requisito Oficial) */}
      {mostrarEspelhoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-4">
                <SolutionsLogo height={36} />
                <div className="h-7 w-px bg-slate-200" />
                <SamsungLogo height={18} variant="blue" />
              </div>
              <button
                onClick={() => setMostrarEspelhoModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mirror Header */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                ESPELHO DE AUDITORIA
              </h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Grupo Solutions • Setor de Rastreabilidade Samsung
              </p>
            </div>

            {/* Details Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase block">Caixa:</span>
                <span className="font-black text-blue-700 text-sm uppercase">{caixaAtiva}</span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase block">Fabricante:</span>
                <span className="font-black text-slate-900 text-sm">SAMSUNG</span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase block">Modelo:</span>
                <span className="font-bold text-slate-800 text-sm">{modeloAtivo}</span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase block">Quantidade:</span>
                <span className="font-black text-emerald-600 text-sm">
                  {produtos.length} produtos
                </span>
              </div>
            </div>

            {/* Mirror Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-center w-12">Nº</th>
                    <th className="py-2 px-4">Serial</th>
                    <th className="py-2 px-3 text-center">Lacrado</th>
                    <th className="py-2 px-3 text-center">Kit Completo</th>
                    <th className="py-2 px-3 text-center">Marcas de Uso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {produtos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        Nenhum produto nesta caixa ainda.
                      </td>
                    </tr>
                  ) : (
                    produtos.map((p, index) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 text-center text-slate-400 font-sans">
                          {(index + 1).toString().padStart(2, '0')}
                        </td>
                        <td className="py-1.5 px-4 font-black text-slate-900">{p.serial}</td>
                        <td className="py-1.5 px-3 text-center font-bold">
                          {p.produto_lacrado}
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-600">
                          {p.kit_completo || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-600">
                          {p.aparelho_marcas_uso || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setMostrarEspelhoModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
              <button
                onClick={exportarPlanilhaExcel}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar Excel
              </button>
              <button
                onClick={exportarEspelhoPDF}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Baixar PDF Oficial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: IMPORTAÇÃO RÁPIDA DE EXCEL */}
      {mostrarImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 uppercase flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Importar Planilha de Auditoria
              </h3>
              <button
                onClick={() => setMostrarImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Selecione um arquivo Excel (.xlsx, .xls ou .csv) contendo as colunas: <strong>Modelo</strong>,{' '}
              <strong>EAN</strong>, <strong>Serial</strong>, <strong>Caixa</strong> e <strong>Data</strong>.
            </p>

            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center bg-slate-50 transition-colors">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <label className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl cursor-pointer shadow-xs transition-transform active:scale-95">
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
                          data: String(r['Data'] || r['data'] || ''),
                          lacrado: String(r['Lacrado'] || r['lacrado'] || 'SIM'),
                        }));
                        const res = db.importarPlanilha(normalizado);
                        alert(
                          `Importação concluída!\nLidas: ${res.totalProcessado}\nGravadas: ${res.sucessoCount}\nDuplicadas: ${res.duplicadosCount}`
                        );
                        recarregarDados(caixaAtiva);
                        setMostrarImportModal(false);
                      } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : String(err);
                        alert('Erro ao importar: ' + message);
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
