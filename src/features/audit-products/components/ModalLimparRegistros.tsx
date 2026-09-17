import React, { useEffect } from 'react';
import { Trash2, X, AlertTriangle, ShieldCheck } from 'lucide-react';

export interface ModalLimparRegistrosProps {
  isOpen: boolean;
  onClose: () => void;
  limpandoRegistros: boolean;
  contagemStatusRegistros: {
    total: number;
    enviados: number;
    pendentes: number;
  };
  onConfirmar: () => void;
}

export const ModalLimparRegistros: React.FC<ModalLimparRegistrosProps> = ({
  isOpen,
  onClose,
  limpandoRegistros,
  contagemStatusRegistros,
  onConfirmar,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-limpar-registros"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-slate-300 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 id="titulo-limpar-registros" className="text-base font-black text-slate-900 uppercase tracking-tight">
                Limpar Registros da Tela
              </h3>
              <span className="text-xs font-bold text-amber-700">
                Limpa a tela deste computador mantendo os dados seguros na nuvem
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de limpeza de registros da tela"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50/70 border-2 border-amber-200 rounded-2xl p-4 text-slate-800 text-xs font-medium space-y-3">
          <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            Deseja limpar a tela deste computador?
          </div>
          <p className="leading-relaxed text-slate-700">
            Esta ação apagará todos os registros visualizados <strong>neste computador</strong> (inclusive os que já foram enviados para o online), deixando a tela 100% limpa para novos trabalhos.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1 pb-1">
            <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Registros na sua Tela</span>
              <span className="text-xl font-black text-amber-700">{contagemStatusRegistros.total}</span>
              <span className="text-[10px] text-amber-600 block mt-0.5">Serão removidos desta tela</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Salvos na Nuvem</span>
              <span className="text-xl font-black text-emerald-700">{contagemStatusRegistros.enviados}</span>
              <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">100% preservados no online</span>
            </div>
          </div>

          {contagemStatusRegistros.pendentes > 0 && (
            <div role="alert" className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-rose-900 text-[11px] font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Atenção:</strong> Você possui <strong>{contagemStatusRegistros.pendentes} produto(s) pendente(s)</strong> que ainda não foram enviados para o online. Se limpar a tela agora sem enviar, esses itens pendentes serão descartados deste computador.
              </div>
            </div>
          )}

          <div className="pt-2 text-emerald-900 font-semibold border-t border-amber-200 space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              A base enviada para a nuvem continua 100% intacta e segura.
            </p>
            <p className="text-[11px] text-slate-600 font-normal">
              A base online enviada só pode ser excluída ou resetada pelo <strong>Administrador Geral</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={limpandoRegistros}
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 uppercase cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={limpandoRegistros}
            onClick={onConfirmar}
            className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white bg-amber-600 hover:bg-amber-700 shadow-md flex items-center gap-2 cursor-pointer transition-colors active:scale-98"
          >
            <Trash2 className="w-4 h-4" />
            {limpandoRegistros ? 'Limpando Tela...' : 'CONFIRMAR E LIMPAR TELA'}
          </button>
        </div>
      </div>
    </div>
  );
};
