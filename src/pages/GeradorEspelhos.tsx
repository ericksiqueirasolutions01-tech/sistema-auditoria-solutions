import React, { useState } from 'react';
import { db } from '../db/storage';
import { ProdutoAuditoria } from '../types';
import { SamsungLogo } from '../components/SamsungLogo';
import { SolutionsLogo } from '../components/SolutionsLogo';
import { LOGO_SAMSUNG_BASE64, LOGO_SOLUTIONS_BASE64 } from '../assets/logosDataUri';
import { ModalVisualizarFotosCaixa } from '../components/ModalVisualizarFotosCaixa';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Download,
  Box,
  Layers,
  Files,
  HardDrive,
  Camera,
  Eye,
  PackageCheck,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const GeradorEspelhos: React.FC = () => {
  const caixas = db.listarCaixas();
  const [caixaSelecionada, setCaixaSelecionada] = useState<string>(
    caixas.length > 0 ? caixas[0] : 'Caixa 01'
  );
  const [incluirSeriaisEspelho, setIncluirSeriaisEspelho] = useState<boolean>(false);
  const [tipoEspelhoVisualizacao, setTipoEspelhoVisualizacao] = useState<'completo' | 'transporte'>('completo');
  const [modalVisualizarFotosAberto, setModalVisualizarFotosAberto] = useState(false);

  const produtosCaixa = db.listarProdutos({ caixa: caixaSelecionada });
  const usuarioAtual = db.getUsuarioAtual();
  const regionalAtiva = usuarioAtual?.regional || (usuarioAtual?.perfil === 'ADMINISTRADOR' ? 'TODAS AS REGIONAIS (ADMIN)' : 'VIA VAREJO RJ');

  // Evidências Fotográficas da Caixa Selecionada (10 em 10)
  const gruposFotos = db.obterGruposFotosCaixa(caixaSelecionada, regionalAtiva);
  const totalFotosAnexadas = gruposFotos.filter((g) => g.temFoto).length;
  const totalGrupos = gruposFotos.length;

  // Agrupamento estrito por Modelo e EAN conforme exigência:
  // "espelho deve informar o modelo, o EAN e a quantidade. exemplo mesmo modelo e mesmo ean o espelho só informa a quantidade ex 10,
  // mudou o ean e o modelo ai vem embaixo o modelo e o ean e quantidade"
  const agrupamentoModelos = new Map<
    string,
    { item: number; modelo: string; ean: string; total: number; seriais: string[] }
  >();

  for (const p of produtosCaixa) {
    const modelo = p.modelo_produto?.trim() || 'SAMSUNG';
    const ean = p.ean?.trim() || 'SEM EAN';
    const chave = `${modelo}___${ean}`;
    const ex = agrupamentoModelos.get(chave);
    if (ex) {
      ex.total++;
      ex.seriais.push(p.serial);
    } else {
      agrupamentoModelos.set(chave, {
        item: agrupamentoModelos.size + 1,
        modelo,
        ean,
        total: 1,
        seriais: [p.serial],
      });
    }
  }
  const listaModelosEan = Array.from(agrupamentoModelos.values()).map((r, idx) => ({
    ...r,
    item: idx + 1,
  }));

  // Agrupamento exclusivo por EAN (Requisito Espelho 2: Região, EAN, Quantidade por EAN)
  const agrupamentoEans = new Map<string, { item: number; ean: string; total: number }>();
  for (const p of produtosCaixa) {
    const ean = p.ean?.trim() || 'SEM EAN';
    const ex = agrupamentoEans.get(ean);
    if (ex) {
      ex.total++;
    } else {
      agrupamentoEans.set(ean, {
        item: agrupamentoEans.size + 1,
        ean,
        total: 1,
      });
    }
  }
  const listaEans = Array.from(agrupamentoEans.values()).map((r, idx) => ({
    ...r,
    item: idx + 1,
  }));

  const getDataFormatada = (): string => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  // =========================================================================
  // 1. EXPORTAR PDF DO ESPELHO DA CAIXA (COM LOGOS SOLUTIONS E SAMSUNG)
  // Modelo, EAN e Quantidade desse modelo representando esse EAN.
  // SEM colunas de lacrado, kit ou marcas (conforme instrução oficial).
  // =========================================================================
  const exportarEspelhoPDF = () => {
    const doc = new jsPDF();

    // 1. Logos Oficiais anexadas no cabeçalho do documento
    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 10, 36, 11.8);
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
    doc.text(`Responsável Grupo Solutions: ${usuarioAtual?.nome || 'Operador'}`, 14, 45);

    // Box de Instrução: Colocar dentro da Caixa Master
    doc.setDrawColor(37, 99, 235);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, 49, 182, 10, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 64, 175);
    doc.text('ATENÇÃO: Este espelho deve ser colocado dentro da Caixa Master.', 18, 55.5);

    // 3. Informações da Caixa
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 62, 182, 34, 2, 2, 'FD');

    const loteCaixa = produtosCaixa.length > 0 && produtosCaixa[0].numero_lote ? produtosCaixa[0].numero_lote : (db.obterUltimoLote() || '01');
    const lacreCaixa =
      db.obterLacreCaixa(caixaSelecionada, regionalAtiva) ||
      produtosCaixa.find((p) => p.lacre_seguranca)?.lacre_seguranca ||
      'NÃO INFORMADO';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`CAIXA: ${caixaSelecionada.toUpperCase()}`, 18, 70);
    doc.text(`LOTE: ${loteCaixa.toUpperCase()}`, 18, 77);
    doc.text(`FABRICANTE: SAMSUNG`, 18, 84);
    doc.text(`LACRE DE SEGURANÇA: ${lacreCaixa.toUpperCase()}`, 18, 91);

    doc.text(`REGIONAL: ${regionalAtiva}`, 105, 70);
    doc.text(`QUANTIDADE TOTAL NA CAIXA: ${produtosCaixa.length} ${produtosCaixa.length === 1 ? 'produto' : 'produtos'}`, 105, 77);
    doc.text(`MODELOS/EANS DISTINTOS: ${listaModelosEan.length}`, 105, 84);

    // 4. TABELA PRINCIPAL DO ESPELHO: MODELO, EAN E QUANTIDADE AGRUPADA
    // Exatamente como solicitado:
    // "espelho deve informar o modelo, o EAN e a quantidade. exemplo mesmo modelo e mesmo ean o espelho só informa a quantidade ex 10,
    // mudou o ean e o modelo ai vem embaixo o modelo e o ean e quantidade"
    const tableData = listaModelosEan.map((item) => [
      item.item.toString().padStart(2, '0'),
      item.modelo,
      item.ean,
      `${item.total} ${item.total === 1 ? 'unidade' : 'unidades'}`,
    ]);

    autoTable(doc, {
      startY: 100,
      head: [['Item', 'Modelo Produto', 'Código EAN', 'Quantidade']],
      body: tableData.length > 0 ? tableData : [['-', 'Nenhum produto registrado nesta caixa', '-', '-']],
      foot: [
        ['', 'TOTAL GERAL DE PRODUTOS NA CAIXA', '', `${produtosCaixa.length} ${produtosCaixa.length === 1 ? 'unidade' : 'unidades'}`],
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

    // 5. Relação Detalhada de Seriais (Opcional caso usuário queira)
    if (incluirSeriaisEspelho && produtosCaixa.length > 0) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('RELAÇÃO DE IMEIS BIPADOS NESTA CAIXA:', 14, currentY);

      const serialsData = produtosCaixa.map((p, idx) => [
        (idx + 1).toString().padStart(2, '0'),
        p.modelo_produto,
        p.ean,
        p.imei || p.serial,
      ]);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Nº', 'Modelo Produto', 'EAN', 'Número IMEI (15 Dígitos)']],
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

    // 6. Bloco de Assinaturas (Requisito 5: Responsável Casas Bahia e Responsável Grupo Solutions)
    if (currentY > 250) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.line(18, currentY + 15, 90, currentY + 15);
    doc.text('Responsável Casas Bahia', 18, currentY + 20);

    doc.line(110, currentY + 15, 182, currentY + 15);
    doc.text('Responsável Grupo Solutions', 110, currentY + 20);

    doc.save(`Espelho_Completo_${caixaSelecionada.replace(/\s+/g, '_')}_Samsung.pdf`);
  };

  // =========================================================================
  // ESPELHO 2: RESUMIDO / TRANSPORTE (SEGURANÇA DE CARGA)
  // REQUISITO DE SEGURANÇA: NÃO EXIBE MODELOS DOS PRODUTOS
  // Contém apenas NF, Caixas, quantidades por caixa e totais + assinaturas
  // =========================================================================
  const exportarEspelhoTransportePDF = () => {
    const doc = new jsPDF();
    const totalGeral = produtosCaixa.length;

    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 10, 36, 11.8);
      doc.addImage(LOGO_SAMSUNG_BASE64, 'PNG', 160, 9, 36, 15.4);
    } catch {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - CONTROLE DE TRANSPORTE E EXPEDIÇÃO', 14, 28);

    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9); // Âmbar transporte
    doc.text('ESPELHO 2 - RESUMIDO DE EXPEDIÇÃO', 14, 34);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 40);
    doc.text(`Responsável pelo Embarque: ${usuarioAtual?.nome || 'Operador'}`, 14, 45);

    // Quadro de informações gerais (Região, Lote, Caixa e Lacre)
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 49, 182, 26, 2, 2, 'FD');

    const loteCaixa2 = produtosCaixa.length > 0 && produtosCaixa[0].numero_lote ? produtosCaixa[0].numero_lote : (db.obterUltimoLote() || '01');
    const lacreCaixa2 =
      db.obterLacreCaixa(caixaSelecionada, regionalAtiva) ||
      produtosCaixa.find((p) => p.lacre_seguranca)?.lacre_seguranca ||
      'NÃO INFORMADO';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`REGIONAL: ${regionalAtiva}`, 18, 57);
    doc.text(`VOLUME / CAIXA: ${caixaSelecionada.toUpperCase()}`, 18, 63);
    doc.text(`LACRE DE SEGURANÇA: ${lacreCaixa2.toUpperCase()}`, 18, 69);
    doc.text(`LOTE: ${loteCaixa2.toUpperCase()}`, 105, 57);
    doc.text(`QUANTIDADE TOTAL NO VOLUME: ${totalGeral} peças`, 105, 63);

    const tableData = listaEans.map((e) => [
      e.item.toString().padStart(2, '0'),
      e.ean,
      `${e.total} ${e.total === 1 ? 'unidade' : 'unidades'}`,
    ]);

    autoTable(doc, {
      startY: 81,
      head: [['Item', 'Código EAN', 'Quantidade por EAN']],
      body: tableData.length > 0 ? tableData : [['-', 'Nenhum produto registrado nesta caixa', '-']],
      foot: [['', 'TOTAL GERAL NO VOLUME', `${totalGeral} ${totalGeral === 1 ? 'unidade' : 'unidades'}`]],
      theme: 'grid',
      headStyles: {
        fillColor: [180, 83, 9],
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
        cellPadding: 4,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { font: 'courier', fontStyle: 'bold' },
        2: { halign: 'center', fontStyle: 'bold' },
      },
    });

    let currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 25;

    if (currentY > 250) {
      doc.addPage();
      currentY = 30;
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.line(18, currentY + 15, 90, currentY + 15);
    doc.text('Responsável Casas Bahia', 18, currentY + 20);

    doc.line(110, currentY + 15, 182, currentY + 15);
    doc.text('Responsável Grupo Solutions', 110, currentY + 20);

    doc.save(`Espelho_2_Expedicao_${caixaSelecionada.replace(/\s+/g, '_')}.pdf`);
  };

  const baixarAmbosEspelhos = () => {
    exportarEspelhoPDF();
    setTimeout(() => {
      exportarEspelhoTransportePDF();
    }, 600);
  };

  // =========================================================================
  // 2. EXPORTAR RELATÓRIOS (EXCEL E PDF - DA CAIXA OU GERAL DE TODAS AS CAIXAS)
  // Contém todas as informações detalhadas de conferência (Lacrado, Kit, Marcas, Obs)
  // =========================================================================
  const exportarRelatorioExcel = (geralTodasCaixas: boolean) => {
    const lista = geralTodasCaixas ? db.listarProdutos() : produtosCaixa;

    const dadosExcel = lista.map((p, idx) => ({
      'Nº': idx + 1,
      Regional: p.regional || regionalAtiva,
      Fabricante: p.fabricante,
      'Modelo Produto': p.modelo_produto,
      EAN: p.ean,
      IMEI: p.imei || p.serial,
      Caixa: p.numero_caixa,
      'Lacre de Segurança': p.lacre_seguranca || db.obterLacreCaixa(p.numero_caixa, regionalAtiva) || '-',
      Lote: p.numero_lote || '01',
      'Data Auditoria': p.data_auditoria,
      'Produto Lacrado': p.produto_lacrado,
      'NF Conferida': p.nf_conferida || 'SIM',
      'Kit Completo': p.kit_completo || '-',
      'Marcas de Uso': p.aparelho_marcas_uso || '-',
      Observações: p.observacao || '-',
      Auditor: p.usuario_cadastro,
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    const sheetName = geralTodasCaixas
      ? 'Auditoria_Geral_Samsung'
      : caixaSelecionada.substring(0, 31);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(
      wb,
      geralTodasCaixas
        ? `Relatorio_Geral_Todas_Caixas_Samsung_${regionalAtiva.replace(/\s+/g, '_')}_${getDataFormatada().replace(/\//g, '-')}.xlsx`
        : `Relatorio_Auditoria_${sheetName.replace(/\s+/g, '_')}.xlsx`
    );
  };

  const exportarRelatorioPDF = (geralTodasCaixas: boolean) => {
    const lista = geralTodasCaixas ? db.listarProdutos() : produtosCaixa;
    const doc = new jsPDF('landscape');
    const titulo = geralTodasCaixas
      ? `RELATÓRIO GERAL DE AUDITORIA - TODAS AS CAIXAS SAMSUNG (${regionalAtiva})`
      : `RELATÓRIO DE AUDITORIA E CONFERÊNCIA - ${caixaSelecionada} (${regionalAtiva})`;

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
      p.imei || p.serial,
      p.produto_lacrado,
      p.nf_conferida || 'SIM',
      p.kit_completo || '-',
      p.aparelho_marcas_uso || '-',
      p.observacao || '-',
      p.data_auditoria,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nº', 'Regional', 'Caixa', 'Modelo', 'EAN', 'IMEI', 'Lacrado', 'NF Conf', 'Kit Completo', 'Marcas de Uso', 'Observação', 'Data']],
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
        ? `Relatorio_Geral_Todas_Caixas_${regionalAtiva.replace(/\s+/g, '_')}_${getDataFormatada().replace(/\//g, '-')}.pdf`
        : `Relatorio_${caixaSelecionada.replace(/\s+/g, '_')}.pdf`
    );
  };

  const imprimirEspelho = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with Box Selector and Actions */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-xs no-print">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Gerador de Espelhos & Relatórios de Auditoria
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Espelho oficial com Modelo, EAN, Quantidade e Logos Samsung & Solutions.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-xl px-3 py-2">
              <Box className="w-4 h-4 text-slate-500" />
              <label className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap">Caixa:</label>
              <select
                value={caixaSelecionada}
                onChange={(e) => setCaixaSelecionada(e.target.value)}
                className="bg-transparent font-black text-slate-900 text-sm focus:outline-none uppercase cursor-pointer"
              >
                {caixas.map((c) => (
                  <option key={c} value={c}>
                    {c} ({db.obterContadoresCaixa(c).totalAuditados} produtos)
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Espelho Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300">
              <button
                type="button"
                onClick={() => setIncluirSeriaisEspelho(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                  !incluirSeriaisEspelho
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Apenas Modelo, EAN e Quantidade"
              >
                📄 Padrão (Sem IMEI)
              </button>
              <button
                type="button"
                onClick={() => setIncluirSeriaisEspelho(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                  incluirSeriaisEspelho
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Incluir relação de IMEIs no Espelho"
              >
                📋 Com IMEI
              </button>
            </div>

            {/* VISUALIZAR FOTOS DA CAIXA (Requisito 11 do Prompt) */}
            <button
              type="button"
              onClick={() => setModalVisualizarFotosAberto(true)}
              className="bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-600 font-black text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Visualizar evidências fotográficas dos produtos desta caixa"
            >
              <Camera className="w-4 h-4 text-blue-300" />
              VISUALIZAR FOTOS DA CAIXA ({totalFotosAnexadas}/{totalGrupos})
            </button>

            {/* Botões de Download dos 2 Espelhos conforme Requisito 6 */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-300">
              <button
                onClick={exportarEspelhoPDF}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-3 py-2 rounded-lg shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Baixar Espelho 1 Completo (Modelo, EAN, Quantidade)"
              >
                <Download className="w-3.5 h-3.5" />
                Espelho 1 (Completo)
              </button>
              <button
                onClick={exportarEspelhoTransportePDF}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-3 py-2 rounded-lg shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Baixar Espelho 2 Resumido (Região, EAN e Quantidade por EAN)"
              >
                <Download className="w-3.5 h-3.5" />
                Espelho 2 (Expedição)
              </button>
              <button
                onClick={baixarAmbosEspelhos}
                className="bg-purple-700 hover:bg-purple-800 text-white font-black text-xs px-3 py-2 rounded-lg shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Baixar ambos os espelhos em PDF"
              >
                <Files className="w-3.5 h-3.5" />
                Baixar Ambos
              </button>
            </div>

            {/* Imprimir Espelho */}
            <button
              onClick={imprimirEspelho}
              className={`text-white font-bold text-xs px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                tipoEspelhoVisualizacao === 'transporte' ? 'bg-amber-700 hover:bg-amber-800' : 'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              <Printer className="w-4 h-4" />
              Imprimir Visualização
            </button>

            {/* Relatório da Caixa Excel */}
            <button
              onClick={() => exportarRelatorioExcel(false)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Baixar Relatório completo da Caixa em Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel Caixa
            </button>

            {/* Relatório Geral Todas as Caixas (Excel) */}
            <button
              onClick={() => exportarRelatorioExcel(true)}
              className="bg-teal-700 hover:bg-teal-800 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Baixar Relatório Geral de TODAS as Caixas em Excel"
            >
              <Files className="w-4 h-4" />
              Relatório Geral (Excel)
            </button>

            {/* Relatório Geral Todas as Caixas (PDF) */}
            <button
              onClick={() => exportarRelatorioPDF(true)}
              className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Baixar Relatório Geral de TODAS as Caixas em PDF"
            >
              <Download className="w-4 h-4" />
              Relatório Geral (PDF)
            </button>
          </div>
        </div>

        {/* Quick Tabs for all boxes */}
        <div className="flex items-center gap-2 mt-4 pt-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Caixas Cadastradas:
          </span>
          {caixas.map((c) => (
            <button
              key={c}
              onClick={() => setCaixaSelecionada(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-colors shrink-0 cursor-pointer ${
                caixaSelecionada === c
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              📄 {c}
            </button>
          ))}
        </div>
      </div>

      {/* Seletor de visualização do espelho em tela */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-xs no-print">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase text-slate-700 whitespace-nowrap">Visualização em Tela:</span>
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-300">
            <button
              type="button"
              onClick={() => setTipoEspelhoVisualizacao('completo')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                tipoEspelhoVisualizacao === 'completo'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📄 Espelho 1: Completo (Dentro da Caixa Master)
            </button>
            <button
              type="button"
              onClick={() => setTipoEspelhoVisualizacao('transporte')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                tipoEspelhoVisualizacao === 'transporte'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚚 Espelho 2: Expedição (Por EAN)
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {tipoEspelhoVisualizacao === 'completo'
            ? 'ℹ️ Visualizando dados completos • Colocar dentro da Caixa Master'
            : '🚚 Visualizando documento de expedição simplificado por EAN'}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FOLHA DO ESPELHO DE AUDITORIA (LAYOUT IMPRESSO E VISUAL) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-300 p-8 sm:p-12 max-w-5xl mx-auto print:shadow-none print:border-none print:p-0 print:m-0 print-container">
        {tipoEspelhoVisualizacao === 'transporte' ? (
          /* ======================================================================= */
          /* ESPELHO 2 - RESUMIDO / EXPEDIÇÃO (POR EAN)                              */
          /* ======================================================================= */
          <div>
            {/* Cabeçalho Transporte */}
            <div className="border-b-2 border-amber-600 pb-6 mb-6">
              <div className="flex items-center justify-between">
                <SolutionsLogo height={44} />
                <div className="text-center hidden sm:block">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                    GRUPO SOLUTIONS
                  </span>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                    ESPELHO 2 - RESUMIDO DE EXPEDIÇÃO
                  </h1>
                  <span className="text-xs font-black text-amber-700 uppercase tracking-wider">
                    Controle de Expedição & Transporte
                  </span>
                </div>
                <SamsungLogo height={28} />
              </div>
              <div className="text-center sm:hidden mt-3">
                <h1 className="text-base font-black text-slate-900 tracking-tight uppercase">
                  ESPELHO 2 - RESUMIDO DE EXPEDIÇÃO
                </h1>
              </div>
            </div>

            {/* Informações do Volume (Região, Lote, Volume, Lacre e Quantidade) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Regional / Cliente:</span>
                  <span className="text-xl font-black text-purple-700 uppercase">{regionalAtiva}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Lote:</span>
                  <span className="text-xl font-black text-amber-600 uppercase">
                    LOTE {produtosCaixa.length > 0 && produtosCaixa[0].numero_lote ? produtosCaixa[0].numero_lote : (db.obterUltimoLote() || '01')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Volume / Caixa:</span>
                  <span className="text-xl font-black text-blue-700 uppercase">{caixaSelecionada}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Lacre de Segurança:</span>
                  <span className="text-xl font-black text-indigo-700 uppercase font-mono">
                    {db.obterLacreCaixa(caixaSelecionada, regionalAtiva) || produtosCaixa.find((p) => p.lacre_seguranca)?.lacre_seguranca || 'NÃO INFORMADO'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Quantidade no Volume:</span>
                  <span className="text-xl font-black text-emerald-700">
                    {produtosCaixa.length} {produtosCaixa.length === 1 ? 'peça' : 'peças'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela de Expedição por EAN */}
            <div className="mb-6">
              <div className="border-2 border-amber-500 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-amber-700 text-white uppercase text-[11px] font-black tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-center w-16 border-r border-amber-600">Item</th>
                      <th className="py-3 px-5 font-mono border-r border-amber-600">Código EAN</th>
                      <th className="py-3 px-5 text-center w-52">Quantidade por EAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs font-bold">
                    {listaEans.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                          Nenhum produto registrado nesta caixa até o momento.
                        </td>
                      </tr>
                    ) : (
                      listaEans.map((item) => (
                        <tr key={item.ean} className="hover:bg-amber-50/40">
                          <td className="py-4 px-4 text-center font-bold text-slate-400 border-r border-slate-200">
                            {item.item.toString().padStart(2, '0')}
                          </td>
                          <td className="py-4 px-5 font-mono text-slate-900 text-sm border-r border-slate-200">
                            {item.ean}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900">
                              {item.total} {item.total === 1 ? 'unidade' : 'unidades'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={2} className="py-3 px-5 text-right uppercase text-xs tracking-wider">
                        Total Geral Transportado Neste Volume:
                      </td>
                      <td className="py-3 px-5 text-center text-sm text-amber-800 font-black">
                        {produtosCaixa.length} {produtosCaixa.length === 1 ? 'peça' : 'peças'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Assinaturas no Espelho 2 */}
            <div className="grid grid-cols-2 gap-12 text-center pt-8 border-t border-slate-200 text-xs text-slate-500">
              <div>
                <div className="border-t border-slate-400 w-4/5 mx-auto mb-2"></div>
                <span className="font-bold text-slate-700 block">Responsável Casas Bahia</span>
                <span className="text-[11px] text-slate-400">Conferência e Recebimento no Transporte</span>
              </div>
              <div>
                <div className="border-t border-slate-400 w-4/5 mx-auto mb-2"></div>
                <span className="font-bold text-slate-700 block">Responsável Grupo Solutions</span>
                <span className="text-[11px] text-slate-400">{usuarioAtual?.nome || 'Operador'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================================= */
          /* ESPELHO 1 - COMPLETO / OPERACIONAL (COM MODELOS, EAN E QUANTIDADES)      */
          /* ======================================================================= */
          <div>
            {/* Cabeçalho com Logos Oficiais Solutions & Samsung */}
            <div className="border-b-2 border-slate-800 pb-6 mb-6">
              <div className="flex items-center justify-between">
                <SolutionsLogo height={44} />
                <div className="text-center hidden sm:block">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                    GRUPO SOLUTIONS
                  </span>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                    ESPELHO DE AUDITORIA SAMSUNG
                  </h1>
                </div>
                <SamsungLogo height={28} />
              </div>
              <div className="text-center sm:hidden mt-3">
                <h1 className="text-base font-black text-slate-900 tracking-tight uppercase">
                  ESPELHO DE AUDITORIA SAMSUNG
                </h1>
              </div>
            </div>

            {/* Aviso Obrigatório: Colocar dentro da Caixa Master */}
            <div className="bg-blue-50 border-2 border-blue-400 text-blue-900 rounded-2xl p-4 mb-6 flex items-center gap-3 shadow-xs">
              <PackageCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="text-xs font-bold leading-relaxed">
                <strong>INSTRUÇÃO DE EMBARQUE:</strong> Este espelho deve ser colocado <strong>dentro da Caixa Master</strong>.
              </span>
            </div>

            {/* Informações da Caixa */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Caixa:</span>
                  <span className="text-xl font-black text-blue-700 uppercase">{caixaSelecionada}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Lote:</span>
                  <span className="text-xl font-black text-amber-600 uppercase">
                    LOTE {produtosCaixa.length > 0 && produtosCaixa[0].numero_lote ? produtosCaixa[0].numero_lote : (db.obterUltimoLote() || '01')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Lacre de Segurança:</span>
                  <span className="text-xl font-black text-indigo-700 uppercase font-mono">
                    {db.obterLacreCaixa(caixaSelecionada, regionalAtiva) || produtosCaixa.find((p) => p.lacre_seguranca)?.lacre_seguranca || 'NÃO INFORMADO'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Regional:</span>
                  <span className="text-xl font-black text-purple-700 uppercase">{regionalAtiva}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Fabricante:</span>
                  <span className="text-xl font-black text-slate-900">SAMSUNG</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Quantidade:</span>
                  <span className="text-xl font-black text-emerald-700">
                    {produtosCaixa.length} {produtosCaixa.length === 1 ? 'produto' : 'produtos'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Modelos/EANs:</span>
                  <span className="text-xl font-black text-slate-800">
                    {listaModelosEan.length}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Fotos da Caixa:</span>
                  <span className="text-sm font-black text-blue-900 block">
                    {totalFotosAnexadas} de {totalGrupos} foto(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalVisualizarFotosAberto(true)}
                    className="mt-1 text-[11px] font-black uppercase text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer no-print"
                    title="Visualizar evidências fotográficas anexadas"
                  >
                    <Camera className="w-3 h-3" /> Visualizar Fotos
                  </button>
                </div>
              </div>
            </div>

            {/* TABELA PRINCIPAL DO ESPELHO: MODELO, EAN E QUANTIDADE */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase text-slate-800 tracking-wide">
                  Conteúdo Consolidado da Caixa:
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {listaModelosEan.length} item(ns) agrupado(s)
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
                    {listaModelosEan.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400 font-medium">
                          Nenhum produto registrado nesta caixa até o momento.
                        </td>
                      </tr>
                    ) : (
                      listaModelosEan.map((item) => (
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
                        {produtosCaixa.length} {produtosCaixa.length === 1 ? 'produto' : 'produtos'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Opção de Controle de Seriais (Impressão e PDF) */}
            <div className="bg-slate-100 p-3 rounded-2xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 no-print">
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
                    📄 Espelho Padrão (Sem IMEI)
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
                    📋 Espelho com IMEI
                  </button>
                </div>
              </div>
              <span className="text-xs text-slate-600 font-bold">
                {incluirSeriaisEspelho
                  ? '🟢 Modo com IMEI Ativo: Os códigos IMEI sairão na impressão e no PDF'
                  : '⚪ Modo Padrão Ativo: Apenas Modelo, EAN e Quantidade (sem códigos IMEI)'}
              </span>
            </div>

            {/* Relação de IMEIs (Exibida caso o usuário ative a opção) */}
            {incluirSeriaisEspelho && (
              <div className="space-y-2 mb-8">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-700 tracking-wide">
                    Relação Detalhada de IMEIs da {caixaSelecionada}:
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {produtosCaixa.length} IMEIs
                  </span>
                </div>

                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800 text-white uppercase text-[10px] font-black tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4 text-center w-14 border-r border-slate-700">Nº</th>
                        <th className="py-2.5 px-4 border-r border-slate-700">Modelo Produto</th>
                        <th className="py-2.5 px-4 font-mono border-r border-slate-700">EAN</th>
                        <th className="py-2.5 px-4 font-mono">Número IMEI (15 Dígitos)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-xs">
                      {produtosCaixa.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                            Nenhum IMEI gravado nesta caixa.
                          </td>
                        </tr>
                      ) : (
                        produtosCaixa.map((p, idx) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2 px-4 text-center text-slate-400 font-sans border-r border-slate-200">
                              {(idx + 1).toString().padStart(2, '0')}
                            </td>
                            <td className="py-2 px-4 font-sans font-bold text-slate-800 border-r border-slate-200">
                              {p.modelo_produto}
                            </td>
                            <td className="py-2 px-4 text-slate-600 border-r border-slate-200">
                              {p.ean}
                            </td>
                            <td className="py-2 px-4 font-black text-slate-900 tracking-wider">
                              {p.imei || p.serial}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Assinaturas no Espelho Completo (Requisito 5) */}
            <div className="grid grid-cols-2 gap-12 text-center pt-8 border-t border-slate-200 text-xs text-slate-500">
              <div>
                <div className="border-t border-slate-400 w-4/5 mx-auto mb-2"></div>
                <span className="font-bold text-slate-700 block">Responsável Casas Bahia</span>
                <span className="text-[11px] text-slate-400">Conferência e Recebimento</span>
              </div>
              <div>
                <div className="border-t border-slate-400 w-4/5 mx-auto mb-2"></div>
                <span className="font-bold text-slate-700 block">Responsável Grupo Solutions</span>
                <span className="text-[11px] text-slate-400">{usuarioAtual?.nome || 'Operador'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Visualização de Fotos da Caixa (Item 11 do Prompt) */}
      <ModalVisualizarFotosCaixa
        isOpen={modalVisualizarFotosAberto}
        onClose={() => setModalVisualizarFotosAberto(false)}
        caixa={caixaSelecionada}
        regional={regionalAtiva}
      />
    </div>
  );
};

export default GeradorEspelhos;
