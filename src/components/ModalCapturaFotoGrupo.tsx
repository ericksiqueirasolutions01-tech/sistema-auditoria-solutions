import React, { useState, useRef } from 'react';
import { db } from '../db/storage';
import { GrupoFotosInfo } from '../types';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';

interface ModalCapturaFotoGrupoProps {
  isOpen: boolean;
  onClose: () => void;
  grupoInfo: GrupoFotosInfo | null;
  caixa: string;
  regional: string;
  onFotoSalva?: () => void;
}

export const ModalCapturaFotoGrupo: React.FC<ModalCapturaFotoGrupoProps> = ({
  isOpen,
  onClose,
  grupoInfo,
  caixa,
  regional,
  onFotoSalva,
}) => {
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !grupoInfo) return null;

  // Comprimir imagem usando HTML5 Canvas (max 1280px, 80% qualidade)
  const comprimirImagem = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context unavailable'));
          ctx.drawImage(img, 0, 0, w, h);
          const dataUri = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUri);
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleArquivoSelecionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setProcessando(true);
    setErro(null);
    try {
      const dataUri = await comprimirImagem(file);
      setImagemPreview(dataUri);
    } catch (err: any) {
      setErro('Falha ao processar imagem: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setProcessando(false);
    }
  };

  const handleSalvarFoto = () => {
    if (!imagemPreview) {
      setErro('Nenhuma foto capturada ou anexada.');
      return;
    }
    try {
      db.salvarFotoGrupo({
        caixa,
        regional,
        grupoNumero: grupoInfo.grupoNumero,
        grupoRotulo: grupoInfo.grupoRotulo,
        rangeInicio: grupoInfo.rangeInicio,
        rangeFim: grupoInfo.rangeFim,
        totalNoGrupo: grupoInfo.totalNoGrupo,
        seriais: grupoInfo.seriais,
        fotoDataUri: imagemPreview,
      });
      if (onFotoSalva) onFotoSalva();
      onClose();
    } catch (err: any) {
      setErro('Erro ao salvar evidência: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Evidência Fotográfica dos Produtos</h3>
                <span className="bg-blue-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full">
                  Grupo {String(grupoInfo.grupoNumero).padStart(2, '0')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {caixa} • {grupoInfo.grupoRotulo} ({grupoInfo.totalNoGrupo} aparelhos)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instrução Oficial */}
        <div className="bg-blue-50 border-b border-blue-100 px-5 py-2.5 text-xs text-blue-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Regra Oficial:</strong> A foto deve mostrar os <strong>produtos dentro da caixa</strong> como comprovação da auditoria física realizada (evidência de conferência).
          </span>
        </div>

        {erro && (
          <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 text-xs font-bold text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Corpo do Modal */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Visualizador de Foto Atual ou Preview */}
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50 flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden">
            {imagemPreview || (grupoInfo.foto && grupoInfo.foto.fotoDataUri) ? (
              <div className="w-full flex flex-col items-center space-y-3">
                <div className="max-h-[320px] w-full flex items-center justify-center rounded-xl overflow-hidden bg-slate-900 shadow-md">
                  <img
                    src={imagemPreview || grupoInfo.foto?.fotoDataUri}
                    alt="Evidência Fotográfica do Grupo"
                    className="max-h-[320px] max-w-full object-contain"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setImagemPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      if (cameraInputRef.current) cameraInputRef.current.value = '';
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Substituir / Tirar Outra Foto
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3 py-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center shadow-inner">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Nenhuma foto anexada para este grupo
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Tire uma foto dos aparelhos dentro da caixa com a câmera ou escolha uma imagem salva.
                  </p>
                </div>

                {/* Botões de Ação de Captura */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {/* Câmera Direta (Celular/Tablet/Webcam) */}
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={processando}
                    className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tirar Foto (Câmera)</span>
                  </button>

                  {/* Anexar Arquivo do Computador */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processando}
                    className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>Anexar Arquivo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Inputs Ocultos */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleArquivoSelecionado}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleArquivoSelecionado}
            />
          </div>

          {/* Seriais deste Grupo */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Seriais contemplados nesta foto ({grupoInfo.seriais.length} aparelhos):</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {grupoInfo.seriais.map((sn, idx) => (
                <span
                  key={sn}
                  className="bg-white px-2 py-0.5 rounded border border-slate-300 text-[11px] font-mono font-bold text-slate-800"
                >
                  #{grupoInfo.rangeInicio + idx}: {sn}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {imagemPreview && (
            <button
              onClick={handleSalvarFoto}
              disabled={processando}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar e Salvar Foto</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
