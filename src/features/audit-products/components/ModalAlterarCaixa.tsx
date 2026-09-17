import React, { useEffect } from 'react';
import { Boxes, X } from 'lucide-react';

export interface ModalAlterarCaixaProps {
  isOpen: boolean;
  onClose: () => void;
  caixaAtiva: string;
  caixaParaMudarInput: string;
  setCaixaParaMudarInput: (val: string) => void;
  caixasExistentes: string[];
  onConfirmar: () => void;
}

export const ModalAlterarCaixa: React.FC<ModalAlterarCaixaProps> = ({
  isOpen,
  onClose,
  caixaAtiva,
  caixaParaMudarInput,
  setCaixaParaMudarInput,
  caixasExistentes,
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
      aria-labelledby="titulo-alterar-caixa"
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 id="titulo-alterar-caixa" className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Alterar Caixa Operacional
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de alteração de caixa"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Todas as fotos da caixa atual <strong>{caixaAtiva}</strong> estão validadas. Escolha a próxima caixa para continuar:
        </p>

        <div className="space-y-2">
          <label htmlFor="input-caixa-alvo" className="text-xs font-bold text-slate-700 uppercase block">
            Caixa Alvo:
          </label>
          <input
            id="input-caixa-alvo"
            list="lista-caixas-existentes"
            type="text"
            value={caixaParaMudarInput}
            onChange={(e) => setCaixaParaMudarInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onConfirmar();
              }
            }}
            placeholder="Ex: Caixa 02"
            className="w-full text-sm font-black text-slate-900 border-2 border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 uppercase"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-slate-400 block w-full">Caixas Existentes:</span>
          {caixasExistentes.map((cx) => (
            <button
              key={cx}
              type="button"
              onClick={() => setCaixaParaMudarInput(cx)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center ${
                caixaParaMudarInput === cx
                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cx}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            Confirmar Troca
          </button>
        </div>
      </div>
    </div>
  );
};
