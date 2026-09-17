import React from 'react';
import { X, Download, ZoomIn } from 'lucide-react';

interface ModalVisualizarFotoLoteProps {
  isOpen: boolean;
  titulo: string;
  subtitulo?: string;
  fotoDataUri: string;
  onClose: () => void;
}

export const ModalVisualizarFotoLote: React.FC<ModalVisualizarFotoLoteProps> = ({
  isOpen,
  titulo,
  subtitulo,
  fotoDataUri,
  onClose,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !fotoDataUri) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = fotoDataUri;
    a.download = `${titulo.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-visualizar-foto"
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="bg-slate-950/80 px-4 sm:px-6 py-3 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <h3 id="titulo-visualizar-foto" className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                {titulo}
              </h3>
              {subtitulo && <p className="text-[10px] text-slate-400">{subtitulo}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              aria-label="Baixar imagem em alta resolução"
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 min-h-[44px] rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Baixar imagem em alta resolução"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Baixar Foto</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar visualização de foto"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image content */}
        <div className="flex-1 overflow-auto p-3 sm:p-6 flex items-center justify-center bg-slate-950/50 min-h-[300px]">
          <img
            src={fotoDataUri}
            alt={titulo}
            className="max-h-[78vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-800"
          />
        </div>
      </div>
    </div>
  );
};

