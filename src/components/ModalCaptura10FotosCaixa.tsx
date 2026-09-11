import React, { useState, useRef, useEffect } from 'react';
import { db } from '../db/storage';
import { ROTULOS_2_FOTOS_CAIXA, FotoCaixa10Item } from '../types';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface ModalCaptura10FotosCaixaProps {
  isOpen: boolean;
  caixa: string;
  regional?: string;
  onClose: () => void;
  onConcluido: () => void;
}

export const ModalCaptura10FotosCaixa: React.FC<ModalCaptura10FotosCaixaProps> = ({
  isOpen,
  caixa,
  regional,
  onClose,
  onConcluido,
}) => {
  const [indiceAtual, setIndiceAtual] = useState<number>(1); // 1 ou 2
  const [fotos, setFotos] = useState<FotoCaixa10Item[]>(() => {
    const reg = db.obter10FotosCaixa(caixa, regional);
    if (reg && reg.fotos && reg.fotos.length === 2) {
      return reg.fotos;
    }
    return ROTULOS_2_FOTOS_CAIXA.map((ref) => ({
      indice: ref.id,
      rotulo: ref.rotulo,
      descricao: ref.descricao,
      fotoDataUri: '',
    }));
  });

  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar fotos existentes da caixa ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      const reg = db.obter10FotosCaixa(caixa, regional);
      if (reg && reg.fotos && reg.fotos.length === 2) {
        setFotos(reg.fotos);
      } else {
        setFotos(
          ROTULOS_2_FOTOS_CAIXA.map((ref) => ({
            indice: ref.id,
            rotulo: ref.rotulo,
            descricao: ref.descricao,
            fotoDataUri: '',
          }))
        );
      }
      setIndiceAtual(1);
      iniciarCamera();
    } else {
      pararCamera();
    }

    return () => {
      pararCamera();
    };
  }, [isOpen, caixa, regional]);

  const iniciarCamera = async () => {
    setErroCamera(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraAtiva(true);
      }
    } catch (err: any) {
      console.warn('Câmera indisponível:', err);
      setErroCamera(
        'Câmera ao vivo indisponível neste dispositivo. Utilize o botão "Anexar Foto / Tirar com Câmera do Celular".'
      );
      setCameraAtiva(false);
    }
  };

  const pararCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  };

  // Comprimir imagem em canvas (max 1280px)
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
          if (!ctx) return reject(new Error('Canvas indisponível'));
          ctx.drawImage(img, 0, 0, w, h);
          const dataUri = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUri);
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  // Captura direta do stream de vídeo
  const capturarDoVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUri = canvas.toDataURL('image/jpeg', 0.82);
    aplicarFotoNoIndice(indiceAtual, dataUri);
  };

  // Captura via input de arquivo ou câmera nativa
  const handleArquivoSelecionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setProcessando(true);
    try {
      const dataUri = await comprimirImagem(file);
      aplicarFotoNoIndice(indiceAtual, dataUri);
    } catch (err: any) {
      alert('Falha ao processar a foto: ' + (err.message || 'Erro'));
    } finally {
      setProcessando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const aplicarFotoNoIndice = (indice: number, dataUri: string) => {
    setFotos((prev) =>
      prev.map((f) => (f.indice === indice ? { ...f, fotoDataUri: dataUri } : f))
    );
    setMensagemSucesso(`Foto ${indice} registrada com sucesso!`);
    setTimeout(() => setMensagemSucesso(null), 2500);

    // Se acabou de tirar a foto 1 e a foto 2 estiver vazia, avança para a foto 2
    if (dataUri) {
      if (indice === 1) {
        const foto2 = fotos.find((f) => f.indice === 2);
        if (!foto2?.fotoDataUri) {
          setIndiceAtual(2);
        }
      }
    }
  };

  const totalComFoto = fotos.filter((f) => !!f.fotoDataUri && f.fotoDataUri.length > 50).length;
  const todasCompletas = totalComFoto === 2;
  const fotoAtualRef = ROTULOS_2_FOTOS_CAIXA[indiceAtual - 1] || ROTULOS_2_FOTOS_CAIXA[0];
  const fotoAtualData = fotos.find((f) => f.indice === indiceAtual);

  const handleSalvarTodas = () => {
    if (!todasCompletas) {
      alert(`É obrigatório registrar as 2 fotos completas da caixa. Faltam ${2 - totalComFoto} foto(s).`);
      return;
    }

    try {
      db.salvar10FotosCaixa(caixa, fotos, regional);
      pararCamera();
      onConcluido();
    } catch (err: any) {
      alert('Erro ao salvar evidências: ' + (err.message || 'Erro desconhecido'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl border-2 border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[96vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Oficial */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                  Fotos Obrigatórias da Caixa
                </span>
                <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase">
                  {caixa}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Requisito Operacional: 2 fotos obrigatórias (Interior dos Aparelhos e Lacre/Fechamento) para concluir e trocar de caixa.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progresso das 2 Fotos */}
        <div className="bg-slate-100 px-4 sm:px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-700">Progresso:</span>
            <span
              className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-full ${
                todasCompletas
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {totalComFoto} de 2 fotos registradas
            </span>
          </div>

          <span className="text-[11px] text-slate-600 font-bold">
            {todasCompletas
              ? '✓ Ambas as 2 fotos capturadas! Liberado para concluir.'
              : `Falta ${2 - totalComFoto} foto para permitir a troca de caixa.`}
          </span>
        </div>

        {/* Corpo com Seleção das 2 Fotos e Área de Captura */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Seletor das 2 Fotos em Cards Grandes e Claros */}
          <div>
            <span className="text-[11px] font-black uppercase text-slate-600 block mb-2">
              Selecione o ângulo para capturar (Foto 1 ou Foto 2):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ROTULOS_2_FOTOS_CAIXA.map((item) => {
                const fotoItem = fotos.find((f) => f.indice === item.id);
                const temFoto = !!fotoItem?.fotoDataUri;
                const isSelected = indiceAtual === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndiceAtual(item.id)}
                    className={`p-3 rounded-xl border-2 text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-500 shadow-sm'
                        : temFoto
                        ? 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100/60'
                        : 'bg-slate-50 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                          temFoto
                            ? 'bg-emerald-600 text-white'
                            : isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        #{item.id}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-black uppercase block text-slate-900 truncate">
                          {item.rotulo}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {item.descricao}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {temFoto ? (
                        <span className="bg-emerald-600 text-white font-black text-[10px] uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 font-bold text-[10px] uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Pendente
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Área de Visualização e Disparo do Ângulo Ativo */}
          <div className="bg-slate-900 rounded-2xl p-4 border border-slate-700 text-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="text-xs font-black uppercase text-blue-400 block">
                  Capturando Foto {indiceAtual} de 2:
                </span>
                <span className="text-sm font-bold text-white">
                  {fotoAtualRef.rotulo}
                </span>
                <p className="text-[11px] text-slate-400">
                  {fotoAtualRef.descricao}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={indiceAtual === 1}
                  onClick={() => setIndiceAtual(1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white cursor-pointer"
                  title="Foto anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={indiceAtual === 2}
                  onClick={() => setIndiceAtual(2)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white cursor-pointer"
                  title="Próxima foto"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Viewfinder ou Foto Capturada */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-slate-800">
              {fotoAtualData?.fotoDataUri ? (
                <div className="relative w-full h-full">
                  <img
                    src={fotoAtualData.fotoDataUri}
                    alt={fotoAtualRef.rotulo}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 bg-emerald-600/90 backdrop-blur-xs text-white px-2.5 py-1 rounded-md text-[11px] font-black uppercase flex items-center gap-1 shadow-md">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Foto {indiceAtual} Registrada
                  </div>
                </div>
              ) : cameraAtiva ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4 space-y-2">
                  <Camera className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    {erroCamera || 'Nenhuma foto capturada para este ângulo.'}
                  </p>
                </div>
              )}

              {processando && (
                <div className="absolute inset-0 bg-black/75 flex items-center justify-center text-white text-xs font-bold gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processando imagem...
                </div>
              )}
            </div>

            {/* Controles de Disparo e Upload */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                {cameraAtiva && (
                  <button
                    type="button"
                    disabled={processando}
                    onClick={capturarDoVideo}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Tirar Foto Agora
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleArquivoSelecionado}
                />

                <button
                  type="button"
                  disabled={processando}
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase px-3.5 py-2 rounded-xl flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-blue-400" />
                  {fotoAtualData?.fotoDataUri ? 'Substituir por Arquivo/Câmera' : 'Anexar Foto / Câmera Celular'}
                </button>
              </div>

              {fotoAtualData?.fotoDataUri && (
                <button
                  type="button"
                  onClick={() => aplicarFotoNoIndice(indiceAtual, '')}
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Excluir foto deste ângulo"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Excluir Foto
                </button>
              )}
            </div>

            {mensagemSucesso && (
              <div className="bg-emerald-900/70 border border-emerald-500 text-emerald-200 text-xs p-2 rounded-lg font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {mensagemSucesso}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé com Validação Rigorosa e Botão Salvar */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Regra: Salvar somente após as <strong>2 fotos completas</strong> da caixa.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 border border-slate-300 uppercase transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={!todasCompletas}
              onClick={handleSalvarTodas}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                todasCompletas
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md scale-100 hover:scale-[1.02]'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75'
              }`}
            >
              <Check className="w-4 h-4" />
              {todasCompletas
                ? 'Salvar 2 Fotos e Liberar Caixa'
                : `Salvar 2 Fotos (${totalComFoto}/2 completas)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
