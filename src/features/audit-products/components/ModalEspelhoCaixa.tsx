import React from 'react';
import {
  X,
  FileText,
  Boxes,
  PackageCheck,
  Printer,
  Download,
  Files,
} from 'lucide-react';
import { SolutionsLogo } from '../../../components/SolutionsLogo';
import { SamsungLogo } from '../../../components/SamsungLogo';
import { ProdutoAuditoria } from '../../../types';

export interface ResumoEanItem {
  item: number;
  ean: string;
  total: number;
}

export interface ResumoModeloItem {
  item: number;
  modelo: string;
  ean: string;
  total: number;
}

export interface EspelhoCaixaData {
  caixaNome: string;
  totalGeral: number;
  itens: ProdutoAuditoria[];
  resumoEans: ResumoEanItem[];
  resumoModelos: ResumoModeloItem[];
}

export interface ModalEspelhoCaixaProps {
  isOpen: boolean;
  onClose: () => void;
  espelhoCaixaAtual: EspelhoCaixaData;
  loteAtivo: string;
  regionalAtiva: string;
  usuarioAtual?: { nome?: string } | null;
  tipoEspelhoVisualizacao: 'completo' | 'transporte';
  setTipoEspelhoVisualizacao: (tipo: 'completo' | 'transporte') => void;
  incluirSeriaisEspelho: boolean;
  setIncluirSeriaisEspelho: (incluir: boolean) => void;
  exportarEspelhoPDF: () => void;
  exportarEspelhoTransportePDF: () => void;
  baixarAmbosEspelhos: () => void;
  handleImprimirEspelho: () => void;
}

export const ModalEspelhoCaixa: React.FC<ModalEspelhoCaixaProps> = ({
  isOpen,
  onClose,
  espelhoCaixaAtual,
  loteAtivo,
  regionalAtiva,
  usuarioAtual,
  tipoEspelhoVisualizacao,
  setTipoEspelhoVisualizacao,
  incluirSeriaisEspelho,
  setIncluirSeriaisEspelho,
  exportarEspelhoPDF,
  exportarEspelhoTransportePDF,
  baixarAmbosEspelhos,
  handleImprimirEspelho,
}) => {
  if (!isOpen) return null;

  return (
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
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg no-print cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor do Tipo de Espelho */}
        <div className="flex flex-wrap items-center justify-center gap-3 no-print bg-slate-100 p-2 rounded-2xl border border-slate-300">
          <button
            type="button"
            onClick={() => setTipoEspelhoVisualizacao('completo')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
              tipoEspelhoVisualizacao === 'completo'
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 scale-[1.02]'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Espelho 1: Completo (Dentro da Caixa Master)
          </button>
          <button
            type="button"
            onClick={() => setTipoEspelhoVisualizacao('transporte')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
              tipoEspelhoVisualizacao === 'transporte'
                ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400 scale-[1.02]'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Boxes className="w-4 h-4 text-amber-200" />
            Espelho 2: Expedição (Por EAN)
          </button>
        </div>

        {/* Título Oficial */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
            {tipoEspelhoVisualizacao === 'transporte'
              ? 'ESPELHO 2 - RESUMIDO DE EXPEDIÇÃO'
              : 'ESPELHO 1 - COMPLETO (OPERACIONAL)'}
          </h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Grupo Solutions • Setor de Rastreabilidade e Logística Samsung
          </p>
        </div>

        {/* AVISO DA CAIXA MASTER NO ESPELHO 1 */}
        {tipoEspelhoVisualizacao === 'completo' && (
          <div className="bg-blue-50 border-2 border-blue-400 text-blue-900 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
            <PackageCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="text-xs font-bold leading-relaxed">
              <strong>INSTRUÇÃO DE EMBARQUE:</strong> Este espelho deve ser colocado <strong>dentro da Caixa Master</strong>.
            </span>
          </div>
        )}

        {/* Quadro de Detalhes da Caixa */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="font-bold text-slate-400 uppercase text-[10px] block">Volume / Caixa:</span>
              <span className="font-black text-blue-700 text-base uppercase">{espelhoCaixaAtual.caixaNome}</span>
            </div>
            <div>
              <span className="font-bold text-slate-400 uppercase text-[10px] block">Lote:</span>
              <span className="font-black text-amber-600 text-base uppercase">
                LOTE {espelhoCaixaAtual.itens.length > 0 && espelhoCaixaAtual.itens[0].numero_lote ? espelhoCaixaAtual.itens[0].numero_lote : loteAtivo}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-400 uppercase text-[10px] block">Regional / Cliente:</span>
              <span className="font-black text-purple-700 text-base uppercase">{regionalAtiva}</span>
            </div>
            <div>
              <span className="font-bold text-slate-400 uppercase text-[10px] block">Qtd Total no Volume:</span>
              <span className="font-black text-emerald-700 text-base">
                {espelhoCaixaAtual.totalGeral} peças
              </span>
            </div>
          </div>
        </div>

        {/* RENDERIZAÇÃO DO CONTEÚDO CONFORME O TIPO DE ESPELHO SELECIONADO */}
        {tipoEspelhoVisualizacao === 'transporte' ? (
          /* ESPELHO 2: RESUMIDO / EXPEDIÇÃO (POR EAN) */
          <div className="space-y-4">
            <div className="border-2 border-amber-300 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-amber-700 text-white uppercase text-[11px] font-black tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-center w-16 border-r border-amber-600">Item</th>
                    <th className="py-3 px-5 font-mono border-r border-amber-600">Código EAN</th>
                    <th className="py-3 px-5 text-center w-48">Quantidade por EAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {espelhoCaixaAtual.resumoEans.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                        Nenhum produto registrado nesta caixa até o momento.
                      </td>
                    </tr>
                  ) : (
                    espelhoCaixaAtual.resumoEans.map((item) => (
                      <tr key={item.ean} className="hover:bg-amber-50/40">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400 border-r border-slate-200">
                          {item.item.toString().padStart(2, '0')}
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-slate-800 text-sm border-r border-slate-200">
                          {item.ean}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900">
                            {item.total} {item.total === 1 ? 'unidade' : 'unidades'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-amber-50 font-black text-slate-900 border-t-2 border-amber-300">
                  <tr>
                    <td colSpan={2} className="py-3.5 px-5 text-right uppercase text-xs tracking-wider text-amber-950">
                      TOTAL GERAL TRANSPORTADO NESTE VOLUME:
                    </td>
                    <td className="py-3.5 px-5 text-center text-sm text-amber-900 font-black">
                      {espelhoCaixaAtual.totalGeral} peças
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          /* ESPELHO 1: COMPLETO (OPERACIONAL COM MODELOS E EANS) */
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-1">
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

            {/* Opção de Controle de Seriais (Impressão e PDF) */}
            <div className="bg-slate-100 p-3 rounded-2xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-700 whitespace-nowrap">
                  Modo com IMEI:
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
                    📄 Sem IMEI (Padrão)
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
                    📋 Com IMEI
                  </button>
                </div>
              </div>
              <span className="text-xs text-slate-600 font-bold">
                {incluirSeriaisEspelho
                  ? '🟢 Modo com IMEI Ativo: Os códigos IMEI sairão na impressão'
                  : '⚪ Modo Padrão Ativo: Apenas Modelo, EAN e Quantidade'}
              </span>
            </div>

            {/* Relação de IMEIs (Opcional) */}
            {incluirSeriaisEspelho && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-700 tracking-wide">
                    Relação Detalhada de IMEIs da {espelhoCaixaAtual.caixaNome}:
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {espelhoCaixaAtual.itens.length} IMEIs
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800 text-white uppercase text-[10px] font-black tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2 px-3 text-center w-12 border-r border-slate-700">Nº</th>
                        <th className="py-2 px-4 border-r border-slate-700">Modelo Produto</th>
                        <th className="py-2 px-4 font-mono border-r border-slate-700">EAN</th>
                        <th className="py-2 px-4 font-mono">Número IMEI (15 Dígitos)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {espelhoCaixaAtual.itens.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 font-sans">
                            Nenhum IMEI nesta caixa.
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
          </div>
        )}

        {/* Assinaturas no Espelho */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
          <div>
            <div className="border-t border-slate-300 w-3/4 mx-auto mb-1"></div>
            <span className="font-bold text-slate-700 block">Responsável Casas Bahia</span>
            <span className="text-[10px] text-slate-400">Conferência e Recebimento</span>
          </div>
          <div>
            <div className="border-t border-slate-300 w-3/4 mx-auto mb-1"></div>
            <span className="font-bold text-slate-700 block">Responsável Grupo Solutions</span>
            <span className="text-[10px] text-slate-400">{usuarioAtual?.nome || 'Operador'}</span>
          </div>
        </div>

        {/* Ações do Modal do Espelho */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportarEspelhoPDF}
              className="px-3 py-2 rounded-xl text-xs font-black uppercase bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Baixar PDF do Espelho 1 (Completo com Modelos e EANs)"
            >
              <Download className="w-4 h-4" />
              Espelho 1 (Completo)
            </button>

            <button
              type="button"
              onClick={exportarEspelhoTransportePDF}
              className="px-3 py-2 rounded-xl text-xs font-black uppercase bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Baixar PDF do Espelho 2 (Região, EAN e Quantidade por EAN)"
            >
              <Boxes className="w-4 h-4" />
              Espelho 2 (Expedição)
            </button>

            <button
              type="button"
              onClick={baixarAmbosEspelhos}
              className="px-3 py-2 rounded-xl text-xs font-black uppercase bg-indigo-700 hover:bg-indigo-800 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Baixar automaticamente os dois espelhos (Completo + Transporte)"
            >
              <Files className="w-4 h-4" />
              Baixar Ambos (2 PDFs)
            </button>

            <button
              onClick={handleImprimirEspelho}
              className="px-3 py-2 rounded-xl text-xs font-bold uppercase text-white shadow-xs flex items-center gap-1.5 cursor-pointer bg-slate-800 hover:bg-slate-900"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
