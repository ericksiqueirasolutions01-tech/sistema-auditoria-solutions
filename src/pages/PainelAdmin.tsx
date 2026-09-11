import React, { useState, useMemo } from 'react';
import { db, REGIONAIS_PADRAO } from '../db/storage';
import { ProdutoAuditoria, EstatisticasRegional } from '../types';
import { SamsungLogo } from '../components/SamsungLogo';
import { SolutionsLogo } from '../components/SolutionsLogo';
import { LOGO_SAMSUNG_BASE64, LOGO_SOLUTIONS_BASE64 } from '../assets/logosDataUri';
import {
  Building2,
  Boxes,
  Barcode,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  TrendingUp,
  PieChart,
  BarChart3,
  RefreshCw,
  Laptop,
  Monitor,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const PainelAdmin: React.FC = () => {
  // Seletor de visualização: 'CONSOLIDADO' ou nome de uma regional específica
  const [regionalAtiva, setRegionalAtiva] = useState<string>('CONSOLIDADO');
  
  // Estados para tabela estilo Excel
  const [busca, setBusca] = useState('');
  const [filtroCaixa, setFiltroCaixa] = useState('TODAS');
  const [filtroLacrado, setFiltroLacrado] = useState('TODOS');
  const [filtroMarcas, setFiltroMarcas] = useState('TODOS');
  const [filtroComputador, setFiltroComputador] = useState('TODOS');
  const [filtroSync, setFiltroSync] = useState<'TODOS' | 'PENDENTE' | 'ENVIADO'>('TODOS');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);
  const [ordemCampo, setOrdemCampo] = useState<keyof ProdutoAuditoria>('id');
  const [ordemDirecao, setOrdemDirecao] = useState<'asc' | 'desc'>('desc');

  const estatisticasRegionais = db.obterEstatisticasRegionais();
  const metricasGerais = db.obterMetricasDashboard('TODAS');
  const metricasRegional = db.obterMetricasDashboard(regionalAtiva);

  // Detalhamento dos computadores da regional ativa (Item 7 do Prompt)
  const detalhamentoComputadores = useMemo(() => {
    if (regionalAtiva === 'CONSOLIDADO') return [];
    return db.obterDetalhamentoComputadoresRegional(regionalAtiva);
  }, [regionalAtiva]);

  // Lista de produtos da visão ativa
  const todosProdutosRegional = useMemo(() => {
    if (regionalAtiva === 'CONSOLIDADO') {
      return db.listarProdutos({ regional: 'TODAS' });
    }
    return db.listarProdutos({ regional: regionalAtiva });
  }, [regionalAtiva]);

  // Caixas disponíveis para o filtro
  const caixasDisponiveis = useMemo(() => {
    return db.listarCaixas(regionalAtiva === 'CONSOLIDADO' ? undefined : regionalAtiva);
  }, [regionalAtiva]);

  // Filtragem e busca da tabela estilo Excel
  const produtosFiltrados = useMemo(() => {
    return todosProdutosRegional.filter((p) => {
      if (busca) {
        const termo = busca.toLowerCase();
        const match =
          p.serial.toLowerCase().includes(termo) ||
          p.modelo_produto.toLowerCase().includes(termo) ||
          p.ean.toLowerCase().includes(termo) ||
          p.numero_caixa.toLowerCase().includes(termo) ||
          p.regional.toLowerCase().includes(termo) ||
          (p.computador_id && p.computador_id.toLowerCase().includes(termo)) ||
          (p.computador_nome && p.computador_nome.toLowerCase().includes(termo)) ||
          p.observacao.toLowerCase().includes(termo);
        if (!match) return false;
      }
      if (filtroCaixa !== 'TODAS' && p.numero_caixa !== filtroCaixa) return false;
      if (filtroLacrado !== 'TODOS' && p.produto_lacrado !== filtroLacrado) return false;
      if (filtroMarcas !== 'TODOS' && p.aparelho_marcas_uso !== filtroMarcas) return false;
      if (filtroComputador !== 'TODOS' && (p.computador_id || '') !== filtroComputador) return false;
      if (filtroSync !== 'TODOS' && (p.status_sincronizacao || 'PENDENTE') !== filtroSync) return false;
      return true;
    });
  }, [todosProdutosRegional, busca, filtroCaixa, filtroLacrado, filtroMarcas, filtroComputador, filtroSync]);

  // Ordenação
  const produtosOrdenados = useMemo(() => {
    return [...produtosFiltrados].sort((a, b) => {
      const valA = a[ordemCampo] ?? '';
      const valB = b[ordemCampo] ?? '';
      if (typeof valA === 'string' && typeof valB === 'string') {
        return ordemDirecao === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (valA < valB) return ordemDirecao === 'asc' ? -1 : 1;
      if (valA > valB) return ordemDirecao === 'asc' ? 1 : -1;
      return 0;
    });
  }, [produtosFiltrados, ordemCampo, ordemDirecao]);

  // Paginação
  const totalPaginas = Math.ceil(produtosOrdenados.length / itensPorPagina) || 1;
  const produtosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return produtosOrdenados.slice(inicio, inicio + itensPorPagina);
  }, [produtosOrdenados, paginaAtual, itensPorPagina]);

  const alternarOrdem = (campo: keyof ProdutoAuditoria) => {
    if (ordemCampo === campo) {
      setOrdemDirecao(ordemDirecao === 'asc' ? 'desc' : 'asc');
    } else {
      setOrdemCampo(campo);
      setOrdemDirecao('asc');
    }
  };

  // =========================================================================
  // 1. EXPORTAÇÕES DA REGIONAL (EXCEL, PDF E IMPRESSÃO)
  // =========================================================================
  const exportarExcelRegional = (regionalAlvo: string) => {
    const lista = regionalAlvo === 'CONSOLIDADO'
      ? db.listarProdutos({ regional: 'TODAS' })
      : db.listarProdutos({ regional: regionalAlvo });

    const dadosExcel = lista.map((p, idx) => ({
      'Nº': idx + 1,
      Regional: p.regional,
      'Computador ID': p.computador_id || 'PC-01',
      'Nome Estação': p.computador_nome || 'Estação 01',
      Fabricante: p.fabricante,
      'Modelo Produto': p.modelo_produto,
      EAN: p.ean,
      Serial: p.serial,
      Caixa: p.numero_caixa,
      'Data Auditoria': p.data_auditoria,
      'Produto Lacrado': p.produto_lacrado,
      'Kit Completo': p.kit_completo || '-',
      'Marcas de Uso': p.aparelho_marcas_uso || '-',
      Observações: p.observacao || '-',
      Auditor: p.usuario_cadastro,
      'Status Sincronização': p.status_sincronizacao === 'ENVIADO' ? 'ENVIADO' : 'PENDENTE',
      'Data Sincronização': p.data_sincronizacao || '-',
      'ID Servidor': p.id_servidor || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    const sheetName = regionalAlvo === 'CONSOLIDADO' ? 'Geral_Todas_Regionais' : regionalAlvo.replace(/\s+/g, '_').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    const fileName = regionalAlvo === 'CONSOLIDADO'
      ? `Auditoria_Consolidada_Todas_Regionais.xlsx`
      : `Auditoria_${regionalAlvo.replace(/\s+/g, '_')}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const exportarPDFRegional = (regionalAlvo: string) => {
    const lista = regionalAlvo === 'CONSOLIDADO'
      ? db.listarProdutos({ regional: 'TODAS' })
      : db.listarProdutos({ regional: regionalAlvo });

    const metricas = db.obterMetricasDashboard(regionalAlvo === 'CONSOLIDADO' ? undefined : regionalAlvo);
    const doc = new jsPDF('landscape');
    const nomeRegionalFormatado = regionalAlvo === 'CONSOLIDADO' ? 'CONSOLIDADO GERAL - TODAS AS REGIONAIS' : regionalAlvo;

    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 8, 36, 11.8);
      doc.addImage(LOGO_SAMSUNG_BASE64, 'PNG', 246, 8, 36, 15.4);
    } catch {
      // Fallback
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - DEPARTAMENTO DE AUDITORIA & QUALIDADE SAMSUNG', 14, 25);

    doc.setFontSize(11);
    doc.setTextColor(12, 77, 162);
    doc.text(`RELATÓRIO OFICIAL DE AUDITORIA - ${nomeRegionalFormatado}`, 14, 31);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Emissão: ${new Date().toLocaleString('pt-BR')} | Total: ${lista.length} produtos | Caixas: ${metricas.totalCaixas} | Lacrados: ${metricas.produtosLacrados} | Pendências: ${metricas.pendencias}`,
      14,
      36
    );

    const tableData = lista.map((p, idx) => [
      (idx + 1).toString(),
      p.regional,
      p.computador_id || 'PC-01',
      p.numero_caixa,
      p.modelo_produto,
      p.ean,
      p.serial,
      p.produto_lacrado,
      p.status_sincronizacao === 'ENVIADO' ? '🟢 OK' : '🟡 Pend',
      p.data_auditoria,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nº', 'Regional', 'Computador', 'Caixa', 'Modelo', 'EAN', 'Serial', 'Lacrado', 'Sync', 'Data']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [12, 77, 162],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    if (finalY < 190) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.line(18, finalY + 10, 110, finalY + 10);
      doc.text('Auditoria Responsável Regional', 18, finalY + 15);

      doc.line(170, finalY + 10, 265, finalY + 10);
      doc.text('Diretoria de Operações Grupo Solutions', 170, finalY + 15);
    }

    const fileName = regionalAlvo === 'CONSOLIDADO'
      ? `Relatorio_Geral_Todas_Regionais_${new Date().toISOString().split('T')[0]}.pdf`
      : `Relatorio_Auditoria_${regionalAlvo.replace(/\s+/g, '_')}.pdf`;

    doc.save(fileName);
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header do Painel Administrativo */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-xs no-print">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-purple-200">
                Acesso Exclusivo Administrador
              </span>
              <span className="text-xs text-slate-400 font-bold">•</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Controle Multi Regional Samsung
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              <Building2 className="w-6 h-6 text-purple-600" />
              Painel Administrativo de Regionais
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Visão integrada de auditorias por regional, indicadores consolidados, gráficos e exportações.
            </p>
          </div>

          {/* Botões de Ação Rápida no Topo */}
          <div className="flex flex-wrap items-center gap-2">
            {regionalAtiva !== 'CONSOLIDADO' && (
              <button
                onClick={() => setRegionalAtiva('CONSOLIDADO')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Consolidado
              </button>
            )}

            <button
              onClick={() => exportarExcelRegional(regionalAtiva)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Baixar planilha completa em Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>

            <button
              onClick={() => exportarPDFRegional(regionalAtiva)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Baixar relatório profissional em PDF com logos"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>

            <button
              onClick={handleImprimir}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </div>

        {/* Barra de Navegação entre Regionais (Botões / Abas Rápidas) */}
        <div className="flex items-center gap-2 mt-4 pt-2 overflow-x-auto pb-1">
          {/* Botão com Destaque: REGIONAIS (Item 8 do Prompt) */}
          <button
            onClick={() => { setRegionalAtiva('CONSOLIDADO'); setPaginaAtual(1); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-2 cursor-pointer border-2 ${
              regionalAtiva === 'CONSOLIDADO'
                ? 'bg-purple-700 text-white border-purple-500 shadow-md ring-2 ring-purple-300'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-300'
            }`}
          >
            <Building2 className="w-4 h-4 text-purple-300" />
            <span>REGIONAIS</span>
            <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              4 Polos
            </span>
          </button>

          <div className="h-6 w-px bg-slate-200 shrink-0 mx-1" />

          {REGIONAIS_PADRAO.map((reg) => {
            const stats = estatisticasRegionais.find((e) => e.regional === reg);
            const total = stats?.totalProdutos || 0;
            const isAtivo = regionalAtiva === reg;

            return (
              <button
                key={reg}
                onClick={() => { setRegionalAtiva(reg); setPaginaAtual(1); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-2 cursor-pointer border ${
                  isAtivo
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <span>📍 {reg}</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                    isAtivo ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 1. SEÇÃO CONSOLIDADA GERAL (SELECIONADA QUANDO 'CONSOLIDADO') */}
      {/* ======================================================================= */}
      {regionalAtiva === 'CONSOLIDADO' && (
        <div className="space-y-6">
          {/* CARDS DAS REGIONAIS CONFORME ITEM 8 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                REGIONAIS ATIVAS (Clique em uma regional para abrir suas informações detalhadas):
              </h3>
              <span className="text-xs font-bold text-slate-400">
                {REGIONAIS_PADRAO.length} polos regionais
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {REGIONAIS_PADRAO.map((reg) => {
                const stats = estatisticasRegionais.find((e) => e.regional === reg);
                const total = stats?.totalProdutos || 0;
                const caixas = stats?.totalCaixas || 0;
                const pend = stats?.pendencias || 0;
                const taxa = stats?.taxaQualidade || 100;

                return (
                  <div
                    key={reg}
                    onClick={() => { setRegionalAtiva(reg); setPaginaAtual(1); }}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-2 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 uppercase">
                        📍 {reg}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>

                    <div className="space-y-1">
                      <div className="text-2xl font-black text-slate-900 tracking-tight">
                        {total} <span className="text-xs font-bold text-slate-400">aparelhos</span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Lotes / Caixas:</span>
                        <strong className="text-slate-800">{caixas}</strong>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>Taxa de Lacrados:</span>
                        <strong className="text-emerald-700">{taxa}%</strong>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>Pendências:</span>
                        <strong className={pend > 0 ? 'text-rose-600 font-black' : 'text-slate-700'}>
                          {pend}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TABELA CONSOLIDADA DE TODAS AS REGIONAIS (ITEM 10) */}
          <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Quadro Consolidado Comparativo de Regionais
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">Total Brasil</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Regional</th>
                    <th className="py-3 px-4 text-center">Produtos Auditados</th>
                    <th className="py-3 px-4 text-center">Caixas Auditadas</th>
                    <th className="py-3 px-4 text-center">Produtos Lacrados</th>
                    <th className="py-3 px-4 text-center">Não Lacrados</th>
                    <th className="py-3 px-4 text-center">Pendências</th>
                    <th className="py-3 px-4 text-center">% Qualidade</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {estatisticasRegionais.map((e) => (
                    <tr key={e.regional} className="hover:bg-slate-50 font-medium transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900 text-xs">
                        📍 {e.regional}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-blue-700 text-sm">
                        {e.totalProdutos}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700">
                        {e.totalCaixas}
                      </td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-bold">
                        {e.produtosLacrados}
                      </td>
                      <td className="py-3 px-4 text-center text-amber-700 font-bold">
                        {e.produtosNaoLacrados}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-black ${
                            e.pendencias > 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {e.pendencias}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${e.taxaQualidade}%` }}
                            />
                          </div>
                          <span className="text-slate-700 text-[11px]">{e.taxaQualidade}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => { setRegionalAtiva(e.regional); setPaginaAtual(1); }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Ver Detalhes →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td className="py-3 px-4 uppercase tracking-wide text-xs">Total Consolidado:</td>
                    <td className="py-3 px-4 text-center text-blue-800 text-sm font-black">
                      {metricasGerais.totalAuditados}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-900">
                      {metricasGerais.totalCaixas}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-700">
                      {metricasGerais.produtosLacrados}
                    </td>
                    <td className="py-3 px-4 text-center text-amber-700">
                      {metricasGerais.produtosNaoLacrados}
                    </td>
                    <td className="py-3 px-4 text-center text-rose-700">
                      {metricasGerais.pendencias}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-700 font-black">
                      {metricasGerais.totalAuditados > 0
                        ? Math.round((metricasGerais.produtosLacrados / metricasGerais.totalAuditados) * 100)
                        : 100}%
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* GRÁFICOS COMPARATIVOS GERAIS (ITEM 10) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Volume por Regional */}
            <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Volume de Auditoria por Regional
                </h3>
                <span className="text-[11px] text-slate-400 font-bold">Comparativo</span>
              </div>

              <div className="space-y-3 pt-2">
                {estatisticasRegionais.map((item) => {
                  const maxTotal = Math.max(...estatisticasRegionais.map((e) => e.totalProdutos), 1);
                  const pct = Math.round((item.totalProdutos / maxTotal) * 100);

                  return (
                    <div key={item.regional} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">{item.regional}</span>
                        <span className="text-blue-700 font-black">{item.totalProdutos} produtos</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gráfico de Pendências por Regional */}
            <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Inconformidades / Pendências por Regional
                </h3>
                <span className="text-[11px] text-slate-400 font-bold">Avarias & Faltantes</span>
              </div>

              <div className="space-y-3 pt-2">
                {estatisticasRegionais.map((item) => {
                  const maxPend = Math.max(...estatisticasRegionais.map((e) => e.pendencias), 1);
                  const pct = Math.round((item.pendencias / maxPend) * 100);

                  return (
                    <div key={item.regional} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">{item.regional}</span>
                        <span className={item.pendencias > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}>
                          {item.pendencias} pendências
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 2. SEÇÃO DA REGIONAL SELECIONADA (ITEM 6, 7, 8, 9) */}
      {/* ======================================================================= */}
      {regionalAtiva !== 'CONSOLIDADO' && (
        <div className="space-y-6">
          {/* Banner da Regional com Indicadores (Item 6) */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                      Regional Samsung Solutions
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      Auditorias & Rastreabilidade
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase mt-1">
                    📍 {regionalAtiva}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportarExcelRegional(regionalAtiva)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel {regionalAtiva.replace('VIA VAREJO ', '')}
                  </button>
                  <button
                    onClick={() => exportarPDFRegional(regionalAtiva)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    PDF {regionalAtiva.replace('VIA VAREJO ', '')}
                  </button>
                </div>
              </div>

              {/* KPIs da Regional Selecionada (Item 6) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-300 uppercase block">Total Produtos</span>
                  <span className="text-2xl font-black text-white">{metricasRegional.totalAuditados}</span>
                  <span className="text-[10px] text-blue-300 block font-semibold mt-0.5">conferidos</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-300 uppercase block">Total Caixas</span>
                  <span className="text-2xl font-black text-white">{metricasRegional.totalCaixas}</span>
                  <span className="text-[10px] text-indigo-300 block font-semibold mt-0.5">lotes ativos</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-300 uppercase block">Total Modelos</span>
                  <span className="text-2xl font-black text-white">{metricasRegional.produtosPorModelo.length}</span>
                  <span className="text-[10px] text-purple-300 block font-semibold mt-0.5">diferentes</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase block">Lacrados</span>
                  <span className="text-2xl font-black text-emerald-400">{metricasRegional.produtosLacrados}</span>
                  <span className="text-[10px] text-emerald-200 block font-semibold mt-0.5">
                    {metricasRegional.totalAuditados > 0
                      ? Math.round((metricasRegional.produtosLacrados / metricasRegional.totalAuditados) * 100)
                      : 100}%
                  </span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-amber-300 uppercase block">Não Lacrados</span>
                  <span className="text-2xl font-black text-amber-400">{metricasRegional.produtosNaoLacrados}</span>
                  <span className="text-[10px] text-amber-200 block font-semibold mt-0.5">abertos</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-rose-300 uppercase block">Pendências</span>
                  <span className="text-2xl font-black text-rose-400">{metricasRegional.pendencias}</span>
                  <span className="text-[10px] text-rose-200 block font-semibold mt-0.5">inconformes</span>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* ORIGEM DOS LANÇAMENTOS POR COMPUTADOR / ESTAÇÃO (ITEM 7 DO PROMPT) */}
          {/* ======================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200 tracking-wider">
                    Item 7 • Rastreabilidade por Posto
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-indigo-600" />
                  Computadores Vinculados & Origem dos Lançamentos ({regionalAtiva})
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Visualização da produção por máquina/estação que alimentou esta regional. Clique em um computador para filtrar a tabela.
                </p>
              </div>

              {filtroComputador !== 'TODOS' && (
                <button
                  onClick={() => setFiltroComputador('TODOS')}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                >
                  Limpar filtro de PC ({filtroComputador}) ✕
                </button>
              )}
            </div>

            {detalhamentoComputadores.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                Nenhum computador registrado nesta regional até o momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {detalhamentoComputadores.map((pc) => {
                  const isSelecionado = filtroComputador === pc.computador_id;
                  return (
                    <div
                      key={pc.computador_id}
                      onClick={() => {
                        setFiltroComputador(isSelecionado ? 'TODOS' : pc.computador_id);
                        setPaginaAtual(1);
                      }}
                      className={`rounded-2xl p-4 border-2 transition-all cursor-pointer relative ${
                        isSelecionado
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-200'
                          : 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                            <Laptop className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="font-mono font-black text-sm text-slate-900 block tracking-wide">
                              {pc.computador_id}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 block truncate max-w-[170px]">
                              {pc.computador_nome}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                          {pc.percentual}%
                        </span>
                      </div>

                      {/* Contador e Barra de Progresso */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Volume auditado:</span>
                          <span className="font-black text-slate-900">
                            {pc.totalAuditados.toLocaleString('pt-BR')}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">produtos</span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(pc.percentual, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Badges de Sincronização */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-[11px]">
                        <span className="flex items-center gap-1 font-bold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {pc.produtosEnviados.toLocaleString('pt-BR')} Enviados
                        </span>
                        <span className="flex items-center gap-1 font-bold text-amber-700">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          {pc.produtosPendentes.toLocaleString('pt-BR')} Pendentes
                        </span>
                      </div>

                      <div className="text-[10px] font-bold text-right mt-2 text-indigo-600">
                        {isSelecionado ? '✓ Filtrando tabela abaixo por este PC' : 'Clique para filtrar auditorias'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* GRÁFICOS DA REGIONAL (ITEM 8) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Gráfico 1: Produtos por Caixa */}
            <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  Produtos por Caixa
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Top Caixas</span>
              </div>

              {metricasRegional.produtosPorCaixa.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">Sem caixas registradas.</div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  {metricasRegional.produtosPorCaixa.slice(0, 5).map((item) => {
                    const max = metricasRegional.produtosPorCaixa[0]?.total || 1;
                    const pct = Math.round((item.total / max) * 100);
                    return (
                      <div key={item.caixa} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 truncate max-w-[180px]">{item.caixa}</span>
                          <span className="text-blue-700">{item.total} un</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gráfico 2: Lacrados x Não Lacrados */}
            <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-emerald-600" />
                  Lacrados x Não Lacrados
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Status Físico</span>
              </div>

              <div className="pt-2 flex flex-col items-center justify-center space-y-3">
                <div className="flex items-center gap-4 w-full">
                  <div className="flex-1 bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Lacrados</span>
                    <span className="text-2xl font-black text-emerald-800">{metricasRegional.produtosLacrados}</span>
                  </div>
                  <div className="flex-1 bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                    <span className="text-[10px] font-bold uppercase text-amber-700 block">Não Lacrados</span>
                    <span className="text-2xl font-black text-amber-800">{metricasRegional.produtosNaoLacrados}</span>
                  </div>
                </div>

                <div className="w-full space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600">
                    <span>Proporção de Lacre:</span>
                    <span>
                      {metricasRegional.totalAuditados > 0
                        ? Math.round((metricasRegional.produtosLacrados / metricasRegional.totalAuditados) * 100)
                        : 100}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-amber-200 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{
                        width: `${
                          metricasRegional.totalAuditados > 0
                            ? (metricasRegional.produtosLacrados / metricasRegional.totalAuditados) * 100
                            : 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico 3: Modelos Auditados */}
            <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  Modelos Auditados
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Por Modelo</span>
              </div>

              {metricasRegional.produtosPorModelo.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">Sem modelos registrados.</div>
              ) : (
                <div className="space-y-2 pt-1">
                  {metricasRegional.produtosPorModelo.slice(0, 5).map((item) => {
                    const max = metricasRegional.produtosPorModelo[0]?.total || 1;
                    const pct = Math.round((item.total / max) * 100);
                    return (
                      <div key={item.modelo} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 truncate max-w-[170px]">{item.modelo}</span>
                          <span className="text-indigo-700">{item.total} un</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* TABELA COMPLETA DA REGIONAL ESTILO EXCEL (ITEM 7) */}
          <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  Tabela Completa de Registros ({regionalAtiva})
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {produtosFiltrados.length} aparelhos encontrados
                </span>
              </div>

              {/* Controles de Filtros e Busca */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); setPaginaAtual(1); }}
                    placeholder="Buscar serial, modelo, EAN..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <select
                  value={filtroCaixa}
                  onChange={(e) => { setFiltroCaixa(e.target.value); setPaginaAtual(1); }}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold uppercase text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="TODAS">Todas as Caixas</option>
                  {caixasDisponiveis.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* Filtro por Computador / Estação (Item 7) */}
                <select
                  value={filtroComputador}
                  onChange={(e) => { setFiltroComputador(e.target.value); setPaginaAtual(1); }}
                  className="bg-indigo-50 border border-indigo-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none cursor-pointer"
                  title="Filtrar lançamentos por Computador / Estação"
                >
                  <option value="TODOS">💻 Todos os Computadores</option>
                  {detalhamentoComputadores.map((pc) => (
                    <option key={pc.computador_id} value={pc.computador_id}>
                      {pc.computador_id} ({pc.totalAuditados} un)
                    </option>
                  ))}
                </select>

                <select
                  value={filtroLacrado}
                  onChange={(e) => { setFiltroLacrado(e.target.value); setPaginaAtual(1); }}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold uppercase text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="TODOS">Lacre: Todos</option>
                  <option value="SIM">Lacrado: SIM</option>
                  <option value="NÃO">Lacrado: NÃO</option>
                </select>

                {/* Filtro por Status de Sincronização */}
                <select
                  value={filtroSync}
                  onChange={(e) => { setFiltroSync(e.target.value as 'TODOS' | 'PENDENTE' | 'ENVIADO'); setPaginaAtual(1); }}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  title="Filtrar por status de envio online"
                >
                  <option value="TODOS">Sync: Todos</option>
                  <option value="ENVIADO">🟢 Apenas Enviados</option>
                  <option value="PENDENTE">🟡 Apenas Pendentes</option>
                </select>
              </div>
            </div>

            {/* Grid da Tabela Estilo Excel */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0C4DA2] text-white uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12 border-r border-blue-600">Nº</th>
                    <th className="py-2.5 px-3 border-r border-blue-600 min-w-[110px]">Computador 💻</th>
                    <th
                      onClick={() => alternarOrdem('modelo_produto')}
                      className="py-2.5 px-4 border-r border-blue-600 cursor-pointer select-none hover:bg-blue-800"
                    >
                      <div className="flex items-center gap-1">
                        <span>Modelo</span>
                        <ArrowUpDown className="w-3 h-3 text-blue-200" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 font-mono border-r border-blue-600">EAN</th>
                    <th
                      onClick={() => alternarOrdem('serial')}
                      className="py-2.5 px-4 font-mono border-r border-blue-600 cursor-pointer select-none hover:bg-blue-800"
                    >
                      <div className="flex items-center gap-1">
                        <span>Serial</span>
                        <ArrowUpDown className="w-3 h-3 text-blue-200" />
                      </div>
                    </th>
                    <th
                      onClick={() => alternarOrdem('numero_caixa')}
                      className="py-2.5 px-3 border-r border-blue-600 cursor-pointer select-none hover:bg-blue-800"
                    >
                      <div className="flex items-center gap-1">
                        <span>Caixa</span>
                        <ArrowUpDown className="w-3 h-3 text-blue-200" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-600">Lacrado</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-600">Kit Compl.</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-600">Marcas Uso</th>
                    <th className="py-2.5 px-4 border-r border-blue-600">Observação</th>
                    <th
                      onClick={() => alternarOrdem('data_auditoria')}
                      className="py-2.5 px-3 text-center border-r border-blue-600 cursor-pointer select-none hover:bg-blue-800"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Data</span>
                        <ArrowUpDown className="w-3 h-3 text-blue-200" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center min-w-[95px]">Status Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {produtosPaginados.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400 font-sans">
                        Nenhum registro encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    produtosPaginados.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-sans border-r border-slate-200">
                          {(paginaAtual - 1) * itensPorPagina + idx + 1}
                        </td>
                        <td className="py-2 px-3 font-sans border-r border-slate-200 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-200 block">
                            💻 {p.computador_id || 'PC-01'}
                          </span>
                        </td>
                        <td className="py-2 px-4 font-sans font-bold text-slate-900 border-r border-slate-200">
                          {p.modelo_produto}
                        </td>
                        <td className="py-2 px-3 text-slate-600 border-r border-slate-200 font-bold">
                          {p.ean}
                        </td>
                        <td className="py-2 px-4 font-black text-slate-900 tracking-wider border-r border-slate-200">
                          {p.serial}
                        </td>
                        <td className="py-2 px-3 font-sans font-bold text-blue-700 uppercase border-r border-slate-200">
                          {p.numero_caixa}
                        </td>
                        <td className="py-2 px-3 text-center font-sans border-r border-slate-200">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              p.produto_lacrado === 'SIM'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.produto_lacrado}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-sans border-r border-slate-200 text-slate-600">
                          {p.kit_completo || '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-sans border-r border-slate-200">
                          <span
                            className={`font-bold ${
                              p.aparelho_marcas_uso === 'SIM' ? 'text-rose-600' : 'text-slate-500'
                            }`}
                          >
                            {p.aparelho_marcas_uso || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-4 font-sans text-slate-600 max-w-xs truncate border-r border-slate-200">
                          {p.observacao || '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-sans text-slate-500 border-r border-slate-200">
                          {p.data_auditoria}
                        </td>
                        <td className="py-2 px-3 text-center font-sans">
                          <span
                            className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full ${
                              p.status_sincronizacao === 'ENVIADO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.status_sincronizacao === 'ENVIADO'
                                  ? 'bg-emerald-600'
                                  : 'bg-amber-600 animate-pulse'
                              }`}
                            />
                            {p.status_sincronizacao === 'ENVIADO' ? 'Enviado' : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação da Tabela Estilo Excel */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Itens por página:</span>
                <select
                  value={itensPorPagina}
                  onChange={(e) => { setItensPorPagina(Number(e.target.value)); setPaginaAtual(1); }}
                  className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-800 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  Mostrando {(paginaAtual - 1) * itensPorPagina + 1} a{' '}
                  {Math.min(paginaAtual * itensPorPagina, produtosFiltrados.length)} de{' '}
                  {produtosFiltrados.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))}
                  disabled={paginaAtual === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 font-bold text-slate-800">
                  Página {paginaAtual} de {totalPaginas}
                </span>
                <button
                  onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))}
                  disabled={paginaAtual >= totalPaginas}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PainelAdmin;

