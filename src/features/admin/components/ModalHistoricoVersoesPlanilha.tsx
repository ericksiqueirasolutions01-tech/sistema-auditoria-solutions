import React, { useState, useEffect } from 'react';
import { History, X, CheckCircle2, Archive, FileSpreadsheet, User, Calendar, Database, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { db, extrairCodigoRegional } from '../../../db/storage';
import type { InventoryImportBatch } from '../../../types';

interface ModalHistoricoVersoesPlanilhaProps {
  regional: string;
  onFechar: () => void;
  onImportarNova: () => void;
  onBaseExcluida?: () => void;
}

export const ModalHistoricoVersoesPlanilha: React.FC<ModalHistoricoVersoesPlanilhaProps> = ({
  regional,
  onFechar,
  onImportarNova,
  onBaseExcluida,
}) => {
  const [batches, setBatches] = useState<InventoryImportBatch[]>(() => db.listarHistoricoImportacoes(regional));
  const [batchParaExcluir, setBatchParaExcluir] = useState<InventoryImportBatch | null>(null);
  const [confirmandoLimparTudo, setConfirmandoLimparTudo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [limpandoTudo, setLimpandoTudo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [sucessoExclusao, setSucessoExclusao] = useState<string | null>(null);

  const codigoReg = extrairCodigoRegional(regional);

  useEffect(() => {
    setBatches(db.listarHistoricoImportacoes(regional));

    let cancelado = false;
    db.puxarAtualizacoesServidor().then(() => {
      if (!cancelado) {
        setBatches(db.listarHistoricoImportacoes(regional));
      }
    });

    const unsub = db.onMudanca(() => {
      if (!cancelado) {
        setBatches(db.listarHistoricoImportacoes(regional));
      }
    });

    return () => {
      cancelado = true;
      unsub();
    };
  }, [regional]);

  const handleConfirmarExclusao = async () => {
    if (!batchParaExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const res = await db.excluirBaseReferenciaRegional(batchParaExcluir.id);
      if (res.sucesso) {
        setSucessoExclusao(`Base v${batchParaExcluir.version} (${batchParaExcluir.file_name}) excluída com sucesso.`);
        setBatches(db.listarHistoricoImportacoes(regional));
        setBatchParaExcluir(null);
        onBaseExcluida?.();
        setTimeout(() => setSucessoExclusao(null), 4000);
      } else {
        setErroExclusao(res.erro || 'Falha ao excluir base.');
      }
    } catch {
      setErroExclusao('Erro inesperado ao excluir base de dados.');
    } finally {
      setExcluindo(false);
    }
  };

  const handleConfirmarLimparTudo = async () => {
    setLimpandoTudo(true);
    setErroExclusao(null);
    try {
      const res = await db.excluirTodasBasesReferencia(regional);
      if (res.sucesso) {
        setSucessoExclusao(`Todas as ${res.totalRemovidos} bases da regional ${codigoReg} foram excluídas com sucesso.`);
        setBatches([]);
        setConfirmandoLimparTudo(false);
        onBaseExcluida?.();
        setTimeout(() => setSucessoExclusao(null), 4000);
      } else {
        setErroExclusao(res.erro || 'Falha ao excluir todas as bases.');
      }
    } catch {
      setErroExclusao('Erro inesperado ao excluir todas as bases de dados.');
    } finally {
      setLimpandoTudo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[85vh]">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
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

        {/* Mensagem de Sucesso */}
        {sucessoExclusao && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{sucessoExclusao}</span>
          </div>
        )}

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
                  className={`border rounded-2xl p-4 transition-all relative ${
                    isAtiva
                      ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 opacity-90 hover:opacity-100'
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

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {dataFormatada}
                      </span>
                      {/* Botão de Excluir Base */}
                      <button
                        type="button"
                        onClick={() => {
                          setBatchParaExcluir(b);
                          setErroExclusao(null);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Excluir esta base de dados"
                        aria-label={`Excluir base v${b.version}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              {batches.length} versão(ões) registrada(s)
            </span>
            {batches.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmandoLimparTudo(true)}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
                title="Excluir todas as versões de planilhas desta regional"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Zerar Histórico
              </button>
            )}
          </div>
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

      {/* Diálogo de Confirmação de Exclusão de Base */}
      {batchParaExcluir && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border-2 border-rose-300 shadow-2xl space-y-4">
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-slate-900 uppercase">
                Excluir Base de Referência?
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Você está prestes a excluir a base <strong>v{batchParaExcluir.version}</strong> ({batchParaExcluir.file_name}) da regional <strong>{batchParaExcluir.regional}</strong>.
              </p>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mt-3 text-left text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Atenção: Ação Irreversível</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  Todos os <strong>{batchParaExcluir.valid_count} IMEIs</strong> desta planilha serão removidos da base de dados regional.
                </p>
              </div>
            </div>

            {erroExclusao && (
              <p className="text-xs text-rose-600 font-bold text-center">
                {erroExclusao}
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={excluindo}
                onClick={() => setBatchParaExcluir(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs uppercase hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={handleConfirmarExclusao}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {excluindo ? (
                  <span>Excluindo...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmação de Zerar Todo o Histórico */}
      {confirmandoLimparTudo && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border-2 border-rose-300 shadow-2xl space-y-4">
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-slate-900 uppercase">
                Zerar Histórico de Planilhas?
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Você está prestes a excluir <strong>todas as {batches.length} versões</strong> de planilhas da regional <strong>{codigoReg}</strong>.
              </p>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mt-3 text-left text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Atenção: Ação Irreversível</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  Todas as referências de IMEI desta regional serão excluídas do banco central e deste computador para permitir uma nova importação limpa.
                </p>
              </div>
            </div>

            {erroExclusao && (
              <p className="text-xs text-rose-600 font-bold text-center">
                {erroExclusao}
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={limpandoTudo}
                onClick={() => setConfirmandoLimparTudo(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs uppercase hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={limpandoTudo}
                onClick={handleConfirmarLimparTudo}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {limpandoTudo ? (
                  <span>Zerando...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar Zeramento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


