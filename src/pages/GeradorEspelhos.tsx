import React, { useState } from 'react';
import { db } from '../db/storage';
import { ProdutoAuditoria } from '../types';
import { SamsungLogo } from '../components/SamsungLogo';
import { SolutionsLogo } from '../components/SolutionsLogo';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Download,
  Box,
  Layers,
  CheckCircle2,
  Calendar,
  User,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const GeradorEspelhos: React.FC = () => {
  const caixas = db.listarCaixas();
  const [caixaSelecionada, setCaixaSelecionada] = useState<string>(
    caixas.length > 0 ? caixas[0] : 'CAIXA 01'
  );

  const produtosCaixa = db.listarProdutos({ caixa: caixaSelecionada });
  const usuarioAtual = db.getUsuarioAtual();

  // Primary model and EAN for this box
  const modeloPrincipal =
    produtosCaixa.length > 0 ? produtosCaixa[0].modelo_produto : 'Galaxy A55 5G';
  const eanPrincipal = produtosCaixa.length > 0 ? produtosCaixa[0].ean : '7891234567890';
  const dataAuditoria =
    produtosCaixa.length > 0 ? produtosCaixa[0].data_auditoria : new Date().toISOString().split('T')[0];

  // Statistics
  const totalProdutos = produtosCaixa.length;
  const lacradosCount = produtosCaixa.filter((p) => p.produto_lacrado === 'SIM').length;
  const naoLacradosCount = produtosCaixa.filter((p) => p.produto_lacrado === 'NÃO').length;
  const marcasUsoCount = produtosCaixa.filter((p) => p.aparelho_marcas_uso === 'SIM').length;

  // 1. EXPORT TO PDF
  const exportarPDF = () => {
    const doc = new jsPDF();

    // Corporate Header
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

    // Box Summary Box
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 42, 182, 28, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`CAIXA: ${caixaSelecionada}`, 18, 50);
    doc.text(`FABRICANTE: SAMSUNG`, 18, 56);
    doc.text(`MODELO: ${modeloPrincipal}`, 18, 62);

    doc.text(`EAN: ${eanPrincipal}`, 105, 50);
    doc.text(`QUANTIDADE TOTAL: ${totalProdutos} produtos`, 105, 56);
    doc.text(`STATUS: ${lacradosCount} Lacrados | ${naoLacradosCount} Abertos`, 105, 62);

    // Products Table
    const tableData = produtosCaixa.map((p, idx) => [
      (idx + 1).toString(),
      p.serial,
      p.produto_lacrado,
      p.kit_completo || '-',
      p.aparelho_marcas_uso || '-',
      p.observacao || '-',
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Nº', 'Serial', 'Lacrado', 'Kit Completo', 'Marcas de Uso', 'Observação']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [12, 77, 162], // Samsung blue
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

    // Signature Footer
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
    if (finalY < 270) {
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.line(18, finalY + 12, 90, finalY + 12);
      doc.text('Assinatura do Auditor Responsável', 18, finalY + 17);

      doc.line(110, finalY + 12, 182, finalY + 12);
      doc.text('Supervisão / Conferência Grupo Solutions', 110, finalY + 17);
    }

    doc.save(`Espelho_${caixaSelecionada.replace(/\s+/g, '_')}_Samsung.pdf`);
  };

  // 2. EXPORT TO EXCEL
  const exportarExcel = () => {
    const dadosExcel = produtosCaixa.map((p, idx) => ({
      'Nº': idx + 1,
      Fabricante: p.fabricante,
      Modelo: p.modelo_produto,
      EAN: p.ean,
      Serial: p.serial,
      Caixa: p.numero_caixa,
      'Data Auditoria': p.data_auditoria,
      Lacrado: p.produto_lacrado,
      'Kit Completo': p.kit_completo || '-',
      'Marcas de Uso': p.aparelho_marcas_uso || '-',
      Observações: p.observacao || '-',
      Auditor: p.usuario_cadastro,
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, caixaSelecionada.substring(0, 31));
    XLSX.writeFile(wb, `Espelho_${caixaSelecionada.replace(/\s+/g, '_')}.xlsx`);
  };

  // 3. NATIVE PRINT
  const imprimirEspelho = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Selector Bar (No Print) */}
      <div className="no-print bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2.5 uppercase">
              <FileText className="w-6 h-6 text-blue-600" />
              Gerador de Espelhos de Auditoria
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Geração automática agrupada por caixa com layout oficial Samsung & Solutions
            </p>
          </div>

          {/* Box Selector & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
              <Box className="w-4 h-4 text-slate-500" />
              <label className="text-xs font-bold text-slate-600 uppercase">Caixa:</label>
              <select
                value={caixaSelecionada}
                onChange={(e) => setCaixaSelecionada(e.target.value)}
                className="bg-transparent font-black text-slate-800 text-sm focus:outline-none uppercase"
              >
                {caixas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={exportarPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>

            <button
              onClick={exportarExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>

            <button
              onClick={imprimirEspelho}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </div>

        {/* Quick Tabs for all available boxes */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Caixas Registradas:
          </span>
          {caixas.map((c) => (
            <button
              key={c}
              onClick={() => setCaixaSelecionada(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-colors shrink-0 ${
                caixaSelecionada === c
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              📄 Espelho {c}
            </button>
          ))}
        </div>
      </div>

      {/* Official Inspection Mirror Paper (Printable Sheet Layout) */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-300 p-8 sm:p-12 max-w-5xl mx-auto print:shadow-none print:border-none print:p-0 print:m-0">
        {/* Mirror Official Header with Logos */}
        <div className="border-b-2 border-slate-800 pb-6 mb-6">
          <div className="flex items-center justify-between">
            <SolutionsLogo height={44} />
            <div className="text-center hidden sm:block">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                RELATÓRIO OFICIAL DE CONFERÊNCIA FÍSICA
              </span>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                ESPELHO DE AUDITORIA
              </h1>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg">
              <SamsungLogo height={24} variant="blue" />
            </div>
          </div>
        </div>

        {/* Mirror Meta Information Block (Requisito 15) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-xl border border-slate-200 mb-6 text-xs">
          <div>
            <span className="font-bold text-slate-400 uppercase block">Fabricante:</span>
            <span className="font-black text-slate-900 text-sm">SAMSUNG</span>
          </div>
          <div>
            <span className="font-bold text-slate-400 uppercase block">Modelo Principal:</span>
            <span className="font-black text-slate-900 text-sm">{modeloPrincipal}</span>
          </div>
          <div>
            <span className="font-bold text-slate-400 uppercase block">EAN do Lote:</span>
            <span className="font-mono font-bold text-slate-800">{eanPrincipal}</span>
          </div>
          <div>
            <span className="font-bold text-slate-400 uppercase block">Caixa Identificada:</span>
            <span className="font-black text-blue-700 text-sm uppercase">{caixaSelecionada}</span>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <span className="font-bold text-slate-400 uppercase block">Quantidade Auditada:</span>
            <span className="font-black text-slate-900 text-base">{totalProdutos} produtos</span>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <span className="font-bold text-slate-400 uppercase block">Produtos Lacrados:</span>
            <span className="font-black text-emerald-600 text-sm">{lacradosCount} itens</span>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <span className="font-bold text-slate-400 uppercase block">Não Lacrados:</span>
            <span className="font-black text-amber-600 text-sm">{naoLacradosCount} itens</span>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <span className="font-bold text-slate-400 uppercase block">Com Marcas de Uso:</span>
            <span className="font-black text-rose-600 text-sm">{marcasUsoCount} itens</span>
          </div>
        </div>

        {/* Audit Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-black uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-3 w-12 text-center">Nº</th>
                <th className="py-3 px-4">Serial</th>
                <th className="py-3 px-4">Modelo</th>
                <th className="py-3 px-3 text-center">Lacrado</th>
                <th className="py-3 px-3 text-center">Kit Completo</th>
                <th className="py-3 px-3 text-center">Marcas de Uso</th>
                <th className="py-3 px-4">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {produtosCaixa.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    Nenhum produto auditado nesta caixa.
                  </td>
                </tr>
              ) : (
                produtosCaixa.map((p, index) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-center font-bold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="py-2 px-4 font-mono font-black text-slate-900 tracking-wider">
                      {p.serial}
                    </td>
                    <td className="py-2 px-4 text-slate-700">{p.modelo_produto}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`font-black px-2 py-0.5 rounded text-[10px] ${
                          p.produto_lacrado === 'SIM'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.produto_lacrado}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-slate-700">
                      {p.kit_completo || '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {p.aparelho_marcas_uso === 'SIM' ? (
                        <span className="text-rose-600 font-black">SIM</span>
                      ) : (
                        <span className="text-slate-500">{p.aparelho_marcas_uso || '-'}</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-slate-500 italic">
                      {p.observacao || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Signatures for Quality Inspection */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-12 text-center text-xs">
          <div className="space-y-2">
            <div className="border-b border-slate-400 w-3/4 mx-auto pb-8"></div>
            <p className="font-bold text-slate-800 uppercase">
              {usuarioAtual?.nome || 'Operador de Bipagem'}
            </p>
            <p className="text-slate-500 text-[11px]">Auditor Responsável - Grupo Solutions</p>
          </div>
          <div className="space-y-2">
            <div className="border-b border-slate-400 w-3/4 mx-auto pb-8"></div>
            <p className="font-bold text-slate-800 uppercase">Controle de Qualidade</p>
            <p className="text-slate-500 text-[11px]">Supervisão de Operações & Rastreabilidade</p>
          </div>
        </div>
      </div>
    </div>
  );
};

