import React, { useState, useRef, useEffect } from 'react';
import { db } from '../db/storage';
import { ROTULOS_10_FOTOS_CAIXA, FotoCaixa10Item } from '../types';
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
  const [indiceAtual, setIndiceAtual] = useState<number>(1); // 1 a 10
  const [fotos, setFotos] = useState<FotoCaixa10Item[]>(() => {
    const reg = db.obter10FotosCaixa(caixa, regional);
    if (reg && reg.fotos && reg.fotos.length === 10) {
      return reg.fotos;
    }
    return ROTULOS_10_FOTOS_CAIXA.map((ref) => ({
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
      if (reg && reg.fotos && reg.fotos.length === 10) {
        setFotos(reg.fotos);
      } else {
        setFotos(
          ROTULOS_10_FOTOS_CAIXA.map((ref) => ({
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

    setMensagemSucesso(`Foto ${indice} de 10 registrada com sucesso!`);
    setTimeout(() => setMensagemSucesso(null), 2500);

    // Avançar automaticamente para a próxima foto vazia
    const proximaVazia = fotos.find((f) => f.indice > indice && !f.fotoDataUri);
    if (proximaVazia) {
      setIndiceAtual(proximaVazia.indice);
    } else {
      const qualquerVazia = fotos.find((f) => f.indice !== indice && !f.fotoDataUri);
      if (qualquerVazia) {
        setIndiceAtual(qualquerVazia.indice);
      }
    }
  };

  const totalComFoto = fotos.filter((f) => !!f.fotoDataUri && f.fotoDataUri.length > 50).length;
  const todasCompletas = totalComFoto === 10;
  const fotoAtualRef = ROTULOS_10_FOTOS_CAIXA[indiceAtual - 1];
  const fotoAtualData = fotos.find((f) => f.indice === indiceAtual);

  const handleSalvarTodas = () => {
    if (!todasCompletas) {
      alert(`Obrigatório registrar as 10 fotos completas. Faltam ${10 - totalComFoto} foto(s).`);
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
        className="bg-white rounded-2xl shadow-2xl border-2 border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col max-h-[96vh]"
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
                  Fotos Obrigatórias ao Trocar de Caixa
                </span>
                <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase">
                  {caixa}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Requisito Operacional: 10 fotos obrigatórias para finalizar a caixa e liberar a próxima.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cancelar troca de caixa"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progresso das 10 Fotos */}
        <div className="bg-slate-100 px-4 sm:px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-700">Progresso:</span>
            <span
              className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${
                todasCompletas
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {totalComFoto} de 10 fotos registradas
            </span>
          </div>

          <span className="text-[11px] text-slate-500 font-bold">
            {todasCompletas
              ? '✓ Todas as 10 fotos capturadas! Pronto para salvar.'
              : `Faltam ${10 - totalComFoto} foto(s) para habilitar o salvamento.`}
          </span>
        </div>

        {/* Corpo com Grid das 10 Fotos e Área de Captura */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Seletor / Carrossel dos 10 Slots de Foto */}
          <div>
            <span className="text-[11px] font-black uppercase text-slate-600 block mb-2">
              Selecione o ângulo ou capture sequencialmente (Foto 1 a 10):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ROTULOS_10_FOTOS_CAIXA.map((item) => {
                const fotoItem = fotos.find((f) => f.indice === item.id);
                const temFoto = !!fotoItem?.fotoDataUri;
                const isSelected = indiceAtual === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndiceAtual(item.id)}
                    className={`p-2 rounded-xl text-left border-2 transition-all flex flex-col justify-between h-24 relative overflow-hidden cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-400'
                        : temFoto
                        ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-100/60'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {temFoto && fotoItem?.fotoDataUri ? (
                      <div className="absolute inset-0 opacity-25">
                        <img
                          src={fotoItem.fotoDataUri}
                          alt={item.rotulo}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between w-full relative z-10">
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : temFoto
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        Foto {item.id}/10
                      </span>
                      {temFoto ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </div>

                    <div className="relative z-10">
                      <span className="text-[10px] font-bold text-slate-900 line-clamp-2 leading-tight">
                        {item.rotulo}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destaque da Foto Selecionada */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border-2 border-blue-600/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-lg uppercase font-mono">
                  Foto {indiceAtual} de 10
                </span>
                <div>
                  <h4 className="text-sm font-black text-white">{fotoAtualRef.rotulo}</h4>
                  <p className="text-[11px] text-slate-300">{fotoAtualRef.descricao}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={indiceAtual <= 1}
                  onClick={() => setIndiceAtual((prev) => Math.max(1, prev - 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white cursor-pointer"
                  title="Foto Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={indiceAtual >= 10}
                  onClick={() => setIndiceAtual((prev) => Math.min(10, prev + 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white cursor-pointer"
                  title="Próxima Foto"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pré-visualização ou Câmera ao Vivo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              {/* Lado Esquerdo: Stream da Câmera */}
              <div className="bg-black rounded-xl overflow-hidden aspect-video relative flex items-center justify-center border border-slate-700">
                {cameraAtiva ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-slate-400 space-y-2">
                    <Camera className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-xs">
                      {erroCamera || 'Câmera não conectada. Use o botão abaixo para anexar foto.'}
                    </p>
                    <button
                      type="button"
                      onClick={iniciarCamera}
                      className="text-xs text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      Tentar reconectar câmera
                    </button>
                  </div>
                )}

                {cameraAtiva && (
                  <button
                    type="button"
                    onClick={capturarDoVideo}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg border border-blue-400 cursor-pointer active:scale-95 transition-transform"
                  >
                    <Camera className="w-4 h-4" />
                    Capturar Foto {indiceAtual}
                  </button>
                )}
              </div>

              {/* Lado Direito: Foto Atual Registrada deste ângulo */}
              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 flex flex-col justify-between aspect-video relative overflow-hidden">
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="font-bold text-slate-300">Evidência Deste Ângulo:</span>
                  {fotoAtualData?.fotoDataUri ? (
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" /> FOTO REGISTRADA
                    </span>
                  ) : (
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/30">
                      <AlertTriangle className="w-3 h-3" /> AGUARDANDO CAPTURA
                    </span>
                  )}
                </div>

                {fotoAtualData?.fotoDataUri ? (
                  <div className="flex-1 rounded-lg overflow-hidden relative border border-slate-600 my-1 bg-black">
                    <img
                      src={fotoAtualData.fotoDataUri}
                      alt={fotoAtualRef.rotulo}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex-1 rounded-lg border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-400 text-xs p-3 my-1">
                    <span>Nenhuma imagem registrada para {fotoAtualRef.rotulo}.</span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Bata a foto ou anexe um arquivo abaixo.
                    </span>
                  </div>
                )}

                {/* Ações para a foto atual */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processando}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold text-[11px] uppercase py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-300" />
                    {processando ? 'Processando...' : 'Anexar / Tirar c/ Celular'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleArquivoSelecionado}
                  />

                  {fotoAtualData?.fotoDataUri && (
                    <button
                      type="button"
                      onClick={() => aplicarFotoNoIndice(indiceAtual, '')}
                      className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg cursor-pointer"
                      title="Excluir foto deste ângulo"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
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
              Regra: Salvar somente após as <strong>10 fotos completas</strong>. Fotos parciais não são permitidas.
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
                ? 'Salvar 10 Fotos e Concluir Caixa'
                : `Salvar 10 Fotos (${totalComFoto}/10 completas)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

