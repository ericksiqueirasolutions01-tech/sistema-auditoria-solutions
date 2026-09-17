import React from 'react';
import { Boxes, X } from 'lucide-react';

export interface ModalNovaCaixaProps {
  isOpen: boolean;
  onClose: () => void;
  novaCaixaNome: string;
  setNovaCaixaNome: (nome: string) => void;
  onConfirmar: () => void;
}

export const ModalNovaCaixa: React.FC<ModalNovaCaixaProps> = ({
  isOpen,
  onClose,
  novaCaixaNome,
  setNovaCaixaNome,
  onConfirmar,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Iniciar Nova Caixa
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Defina a identificação da caixa. Cada caixa pode conter <strong>no máximo 20 produtos</strong> conforme a regra operacional do sistema.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase">Identificação da Caixa:</label>
          <input
            type="text"
            value={novaCaixaNome}
            onChange={(e) => setNovaCaixaNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onConfirmar();
              }
            }}
            placeholder="Ex: Caixa 02"
            className="w-full text-sm font-black text-slate-900 border-2 border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-600"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl shadow-xs cursor-pointer"
          >
            Iniciar Caixa
          </button>
        </div>
      </div>
    </div>
  );
};
