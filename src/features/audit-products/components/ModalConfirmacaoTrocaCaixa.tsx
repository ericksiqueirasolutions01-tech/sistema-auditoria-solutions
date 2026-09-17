import React from 'react';
import { Camera, X, Check, AlertTriangle } from 'lucide-react';

export interface ModalConfirmacaoTrocaCaixaProps {
  isOpen: boolean;
  onClose: () => void;
  caixaAtiva: string;
  exibirCampoMotivoSemFotos: boolean;
  setExibirCampoMotivoSemFotos: (val: boolean) => void;
  motivoSemFotosInput: string;
  setMotivoSemFotosInput: (val: string) => void;
  onRespostaSim: () => void;
  onRespostaNao: () => void;
  onConfirmarMotivo: () => void;
}

export const ModalConfirmacaoTrocaCaixa: React.FC<ModalConfirmacaoTrocaCaixaProps> = ({
  isOpen,
  onClose,
  caixaAtiva,
  exibirCampoMotivoSemFotos,
  setExibirCampoMotivoSemFotos,
  motivoSemFotosInput,
  setMotivoSemFotosInput,
  onRespostaSim,
  onRespostaNao,
  onConfirmarMotivo,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-slate-300 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase">
                Fotos dos Produtos
              </h3>
              <span className="text-xs font-bold text-slate-500">
                Confirmação da {caixaAtiva}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!exibirCampoMotivoSemFotos ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-base font-black text-slate-900">
                As fotos dos produtos foram anexadas?
              </p>
              <p className="text-xs text-slate-600">
                Se você já anexou as fotos da <strong>{caixaAtiva}</strong>, clique em <strong>SIM</strong> para liberar a mudança de caixa. Caso não tenha fotos, clique em <strong>NÃO</strong> para justificar o motivo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onRespostaSim}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Check className="w-5 h-5" />
                SIM (Liberar)
              </button>
              <button
                type="button"
                onClick={onRespostaNao}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black text-sm uppercase py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
                NÃO
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Informe o motivo de não ter colocado as fotos:
              </div>
              <p className="text-xs text-slate-600">
                Para liberar a mudança de caixa sem as fotos anexadas, informe uma breve justificativa abaixo:
              </p>
              <textarea
                value={motivoSemFotosInput}
                onChange={(e) => setMotivoSemFotosInput(e.target.value)}
                rows={3}
                placeholder="Ex: Câmera temporariamente indisponível, caixa lacrada de fábrica pelo fabricante, etc."
                className="w-full text-xs font-medium text-slate-900 border-2 border-amber-300 rounded-xl p-2.5 focus:outline-none focus:border-amber-600 bg-white"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExibirCampoMotivoSemFotos(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 uppercase cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={onConfirmarMotivo}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Check className="w-4 h-4" />
                Confirmar Motivo e Liberar Caixa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
