import React from 'react';
import { History, X, CheckCircle2, Archive, FileSpreadsheet, User, Calendar, Database } from 'lucide-react';
import { db, extrairCodigoRegional } from '../../../db/storage';
import type { InventoryImportBatch } from '../../../types';

interface ModalHistoricoVersoesPlanilhaProps {
  regional: string;
  onFechar: () => void;
  onImportarNova: () => void;
}

export const ModalHistoricoVersoesPlanilha: React.FC<ModalHistoricoVersoesPlanilhaProps> = ({
  regional,
  onFechar,
  onImportarNova,
}) => {
  const batches = db.listarHistoricoImportacoes(regional);
  const codigoReg = extrairCodigoRegional(regional);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[85vh]">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-500/30 text-blue-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Rastreabilidade
                </span>
                <span className="text-xs text-slate-300">Regional {codigoReg}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                Histórico de Versões da Planilha
              </h2>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Versões */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {batches.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-700">Nenhuma versão importada</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Esta regional ainda não possui listas de referência de inventário cadastradas. Importe a primeira versão para habilitar o preenchimento automático de IMEI.
              </p>
              <button
                onClick={() => {
                  onFechar();
                  onImportarNova();
                }}
                className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-black uppercase px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Importar Primeira Planilha
              </button>
            </div>
          ) : (
            batches.map((b) => {
              const isAtiva = b.status === 'ATIVA';
              const dataFormatada = new Date(b.imported_at).toLocaleString('pt-BR');

              return (
                <div
                  key={b.id}
                  className={`border rounded-2xl p-4 transition-all ${
                    isAtiva
                      ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-black uppercase px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${
                          isAtiva
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isAtiva ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        Versão v{b.version} {isAtiva ? '(ATIVA)' : '(HISTÓRICA)'}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{b.regional}</span>
                    </div>

                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {dataFormatada}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Arquivo</span>
                      <span className="font-bold text-slate-800 truncate block" title={b.file_name}>
                        {b.file_name}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Importado Por</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {b.imported_by}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Itens Válidos</span>
                      <span className="font-black text-emerald-600 block">
                        {b.valid_count} IMEIs
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Linhas</span>
                      <span className="font-bold text-slate-700 block">
                        {b.row_count} linhas
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            {batches.length} versão(ões) registrada(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onFechar();
                onImportarNova();
              }}
              className="bg-blue-900 hover:bg-blue-800 text-white text-xs font-black uppercase px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Importar Nova Versão
            </button>
            <button
              onClick={onFechar}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold uppercase hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

