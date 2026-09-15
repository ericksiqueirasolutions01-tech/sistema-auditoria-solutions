import React, { useState, useRef, useEffect } from 'react';
import { db } from '../db/storage';
import { FotosFechamentoLote, RegistroLoteFinalizado } from '../types';
import {
  Lock,
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Package,
  Layers,
  User,
  Calendar,
} from 'lucide-react';
import { ModalVisualizarFotoLote } from './ModalVisualizarFotoLote';

interface ModalFechamentoLoteProps {
  isOpen: boolean;
  lote: string;
  regional: string;
  colaborador: string;
  onClose: () => void;
  onLoteFinalizado: (loteFinalizado: RegistroLoteFinalizado) => void;
}

type SlotFoto = 'caixaFechada' | 'espelhoCaixa' | 'lacreSeguranca';

interface SlotConfig {
  id: SlotFoto;
  numero: number;
  titulo: string;
  subtitulo: string;
  objetivo: string;
}

const SLOTS_FOTOS: SlotConfig[] = [
  {
    id: 'caixaFechada',
    numero: 1,
    titulo: '1ª Foto Obrigatória: Caixa Fechada',
    subtitulo: 'Caixa física finalizada',
    objetivo: 'Comprovar que a caixa física foi finalizada.',
  },
  {
    id: 'espelhoCaixa',
    numero: 2,
    titulo: '2ª Foto Obrigatória: Espelho da Caixa',
    subtitulo: 'Espelho impresso e conferido',
    objetivo: 'Comprovar a conferência das informações.',
  },
  {
    id: 'lacreSeguranca',
    numero: 3,
    titulo: '3ª Foto Obrigatória: Lacre de Segurança',
    subtitulo: 'Lacre aplicado na embalagem',
    objetivo: 'Comprovar o fechamento e segurança da embalagem.',
  },
];

export const ModalFechamentoLote: React.FC<ModalFechamentoLoteProps> = ({
  isOpen,
  lote,
  regional,
  colaborador,
  onClose,
  onLoteFinalizado,
}) => {
  const [fotos, setFotos] = useState<FotosFechamentoLote>({
    caixaFechada: '',
    espelhoCaixa: '',
    lacreSeguranca: '',
  });

  const [slotAtivo, setSlotAtivo] = useState<SlotFoto>('caixaFechada');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [fotoZoom, setFotoZoom] = useState<{ url: string; titulo: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calcular contagens atuais do lote
  const produtosDoLote = db.listarProdutos({
    regional: regional === 'TODAS' ? undefined : regional,
    numero_lote: lote,
  });
  const totalProdutos = produtosDoLote.length;
  const caixasUnicas = Array.from(new Set(produtosDoLote.map((p) => p.numero_caixa || 'SEM CAIXA')));
  const totalCaixas = caixasUnicas.length;
  const totalNfConferidas = produtosDoLote.filter((p) => p.nf_conferida === 'SIM' || p.nf_conferida === 'NÃO' || p.nf_conferida === 'NAO').length;

  useEffect(() => {
    if (isOpen) {
      setFotos({ caixaFechada: '', espelhoCaixa: '', lacreSeguranca: '' });
      setSlotAtivo('caixaFechada');
      setErroValidacao(null);
      setMostrarConfirmacao(false);
      iniciarCamera();
    } else {
      pararCamera();
    }
    return () => {
      pararCamera();
    };
  }, [isOpen, lote, regional]);

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
    } catch (err) {
      console.warn('Câmera indisponível:', err);
      setErroCamera('Câmera ao vivo indisponível neste dispositivo. Utilize o botão "Anexar Foto / Tirar com Câmera do Celular".');
      setCameraAtiva(false);
    }
  };

  const pararCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  };

  const capturarFotoCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setProcessando(true);
    try {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > MAX_WIDTH) {
        h = Math.round((h * MAX_WIDTH) / w);
        w = MAX_WIDTH;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        const dataUri = canvas.toDataURL('image/jpeg', 0.72);
        atribuirFotoAoSlot(slotAtivo, dataUri);
      }
    } catch (e) {
      console.error('Erro ao capturar foto da câmera:', e);
    } finally {
      setProcessando(false);
    }
  };

  const processarArquivoFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessando(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          let w = img.width;
          let h = img.height;
          if (w > MAX_WIDTH) {
            h = Math.round((h * MAX_WIDTH) / w);
            w = MAX_WIDTH;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUri = canvas.toDataURL('image/jpeg', 0.72);
            atribuirFotoAoSlot(slotAtivo, dataUri);
          }
        } catch (err) {
          console.error('Erro ao comprimir imagem:', err);
        } finally {
          setProcessando(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const atribuirFotoAoSlot = (slot: SlotFoto, dataUri: string) => {
    setFotos((prev) => ({ ...prev, [slot]: dataUri }));
    setErroValidacao(null);

    // Avançar automaticamente para o próximo slot pendente
    if (slot === 'caixaFechada' && !fotos.espelhoCaixa) {
      setSlotAtivo('espelhoCaixa');
    } else if (slot === 'espelhoCaixa' && !fotos.lacreSeguranca) {
      setSlotAtivo('lacreSeguranca');
    }
  };

  const removerFotoSlot = (slot: SlotFoto, e: React.MouseEvent) => {
    e.stopPropagation();
    setFotos((prev) => ({ ...prev, [slot]: '' }));
    setSlotAtivo(slot);
  };

  const handleValidarAntesDeFinalizar = () => {
    setErroValidacao(null);

    // Validação estrita das 3 fotos obrigatórias conforme especificação:
    const faltaCaixa = !fotos.caixaFechada || fotos.caixaFechada.length < 50;
    const faltaEspelho = !fotos.espelhoCaixa || fotos.espelhoCaixa.length < 50;
    const faltaLacre = !fotos.lacreSeguranca || fotos.lacreSeguranca.length < 50;

    if (faltaCaixa || faltaEspelho || faltaLacre) {
      setErroValidacao(
        'Para finalizar o lote é obrigatório anexar as 3 fotos:\n' +
          (faltaCaixa ? '❌' : '✓') + ' Caixa fechada\n' +
          (faltaEspelho ? '❌' : '✓') + ' Espelho da caixa\n' +
          (faltaLacre ? '❌' : '✓') + ' Lacre de segurança'
      );
      // Direcionar foco para a primeira foto faltante
      if (faltaCaixa) setSlotAtivo('caixaFechada');
      else if (faltaEspelho) setSlotAtivo('espelhoCaixa');
      else setSlotAtivo('lacreSeguranca');
      return;
    }

    if (totalProdutos === 0) {
      setErroValidacao(`Não há produtos lançados no Lote ${lote}. Lance os produtos antes de fechar.`);
      return;
    }

    // Regra 8: Validação obrigatória da NF conferida para todos os produtos do lote
    const produtosSemNf = produtosDoLote.filter(
      (p) => !p.nf_conferida || (p.nf_conferida !== 'SIM' && p.nf_conferida !== 'NÃO' && p.nf_conferida !== 'NAO')
    );
    if (produtosSemNf.length > 0) {
      setErroValidacao(
        `Para finalizar o lote é obrigatório que todos os produtos tenham a conferência de NF realizada.\nExistem ${produtosSemNf.length} produto(s) sem a conferência definida. Atualize todos os itens antes de fechar o lote.`
      );
      return;
    }

    // Exibir confirmação do bloqueio definitivo
    setMostrarConfirmacao(true);
  };

  const handleConfirmarFechamentoOficial = () => {
    pararCamera();

    const res = db.finalizarLote({
      numeroLote: lote,
      regional,
      colaborador,
      fotos,
    });

    if (res.sucesso && res.lote) {
      onLoteFinalizado(res.lote);
    } else {
      setErroValidacao(res.erro || 'Erro ao finalizar lote.');
      setMostrarConfirmacao(false);
    }
  };

  if (!isOpen) return null;

  const slotAtivoConfig = SLOTS_FOTOS.find((s) => s.id === slotAtivo) || SLOTS_FOTOS[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl border-2 border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col max-h-[96vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                  Fechamento Oficial de Lote
                </span>
                <span className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase">
                  Lote {lote}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Validação obrigatória de evidências fotográficas antes da finalização definitiva.
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

        {/* Resumo do Lote */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-black text-slate-400 uppercase block">Cliente / Regional</span>
              <span className="font-black text-slate-900 uppercase truncate block">{regional}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-black text-slate-400 uppercase block">Colaborador Resp.</span>
              <span className="font-black text-blue-800 uppercase truncate block" title={colaborador}>
                {colaborador}
              </span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-black text-slate-400 uppercase block">Total de Caixas</span>
              <span className="font-black text-slate-900 block">{totalCaixas} caixas</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-black text-slate-400 uppercase block">Total de Aparelhos</span>
              <span className="font-black text-slate-900 block">{totalProdutos} unidades</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-black text-slate-400 uppercase block">NF Conferida</span>
              <span
                className={`font-black block text-[11px] truncate ${
                  totalNfConferidas === totalProdutos && totalProdutos > 0
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              >
                {totalNfConferidas === totalProdutos && totalProdutos > 0 ? '✓ 100% Conferido' : `${totalNfConferidas}/${totalProdutos} conferidos`}
              </span>
            </div>
          </div>
        </div>

        {/* Mensagem de Erro de Validação */}
        {erroValidacao && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-rose-50 border-2 border-rose-400 text-rose-900 rounded-xl text-xs font-bold leading-relaxed whitespace-pre-line flex items-start gap-2 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>{erroValidacao}</div>
          </div>
        )}

        {/* Conteúdo Principal: Seleção de Fotos e Captura */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Instrução de Obrigatoriedade */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black uppercase tracking-wider block">
                Regra de Segurança: As 3 Fotos são Obrigatórias
              </span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Para garantir a conformidade da auditoria, anexe uma foto da <strong>Caixa Fechada</strong>, uma foto do <strong>Espelho da Caixa</strong> e uma foto do <strong>Lacre de Segurança</strong>.
              </p>
            </div>
          </div>

          {/* Cards dos 3 Slots de Fotos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SLOTS_FOTOS.map((slot) => {
              const fotoUrl = fotos[slot.id];
              const temFoto = !!fotoUrl && fotoUrl.length > 50;
              const isSelecionado = slotAtivo === slot.id;

              return (
                <div
                  key={slot.id}
                  onClick={() => setSlotAtivo(slot.id)}
                  className={`rounded-xl border-2 p-3 transition-all cursor-pointer flex flex-col justify-between relative ${
                    isSelecionado
                      ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-400'
                      : temFoto
                      ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-400'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {/* Badge de Status */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                      Foto {slot.numero} de 3
                    </span>
                    {temFoto ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full uppercase">
                        <Check className="w-3 h-3" /> Anexada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full uppercase">
                        Obrigatória
                      </span>
                    )}
                  </div>

                  {/* Thumbnail / Placeholder */}
                  <div className="w-full h-32 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-700">
                    {temFoto ? (
                      <>
                        <img src={fotoUrl} alt={slot.titulo} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFotoZoom({ url: fotoUrl, titulo: slot.titulo });
                            }}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                            title="Ampliar foto"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => removerFotoSlot(slot.id, e)}
                            className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                            title="Remover e tirar outra"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <Camera className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        <span className="text-[10px] font-bold block">Clique para fotografar</span>
                      </div>
                    )}
                  </div>

                  {/* Detalhes do Slot */}
                  <div className="mt-2 text-left">
                    <span className="text-xs font-black text-slate-900 block leading-snug">
                      {slot.titulo.split(':')[1] || slot.titulo}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                      {slot.objetivo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Área Ativa de Captura para o Slot Selecionado */}
          <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-700 pb-2">
              <div>
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider block">
                  Capturando: {slotAtivoConfig.titulo}
                </span>
                <span className="text-[11px] text-slate-300">{slotAtivoConfig.objetivo}</span>
              </div>
              {fotos[slotAtivo] && (
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-600 flex items-center gap-1 uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Foto Atual Registrada
                </span>
              )}
            </div>

            {/* Viewfinder da Câmera ou Preview */}
            <div className="relative bg-black rounded-xl overflow-hidden min-h-[220px] max-h-[320px] flex items-center justify-center border border-slate-800">
              {cameraAtiva ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-[240px] sm:h-[280px] object-cover" />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Camera className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    {erroCamera || 'Câmera não conectada ou permissão pendente.'}
                  </p>
                </div>
              )}

              {processando && (
                <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                  <div className="text-center space-y-1">
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <span className="text-xs font-bold text-slate-200">Processando foto...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Controles de Disparo e Upload */}
            <div className="flex flex-col sm:flex-row items-center gap-2 justify-between pt-1">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {cameraAtiva && (
                  <button
                    type="button"
                    onClick={capturarFotoCamera}
                    disabled={processando}
                    className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tirar Foto Agora</span>
                  </button>
                )}

                <label className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all">
                  <Upload className="w-4 h-4" />
                  <span>Anexar / Câmera Celular</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={processarArquivoFoto}
                  />
                </label>
              </div>

              {!cameraAtiva && (
                <button
                  type="button"
                  onClick={iniciarCamera}
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tentar Ativar Webcam</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-semibold text-center sm:text-left">
            Total de fotos anexadas:{' '}
            <strong className="text-slate-900">
              {[fotos.caixaFechada, fotos.espelhoCaixa, fotos.lacreSeguranca].filter((f) => f && f.length > 50).length}{' '}
              de 3
            </strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold uppercase transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleValidarAntesDeFinalizar}
              className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
            >
              <Lock className="w-4 h-4 text-slate-950" />
              <span>Concluir Fechamento do Lote</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Bloqueio Definitivo */}
      {mostrarConfirmacao && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border-2 border-amber-400 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto border border-amber-300">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Confirmar Fechamento e Bloqueio Definitivo?
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Após confirmar, o <strong>Lote {lote}</strong> mudará para o status <strong>LOTE FINALIZADO</strong>.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>3 fotos obrigatórias anexadas com sucesso</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{totalCaixas} caixas conferidas • {totalProdutos} produtos</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Nenhum colaborador poderá mais incluir ou alterar produtos</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMostrarConfirmacao(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs uppercase hover:bg-slate-100 cursor-pointer"
              >
                Voltar e Revisar
              </button>
              <button
                type="button"
                onClick={handleConfirmarFechamentoOficial}
                className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Sim, Finalizar Lote</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lightbox de Foto */}
      {fotoZoom && (
        <ModalVisualizarFotoLote
          isOpen={!!fotoZoom}
          titulo={fotoZoom.titulo}
          fotoDataUri={fotoZoom.url}
          onClose={() => setFotoZoom(null)}
        />
      )}
    </div>
  );
};

