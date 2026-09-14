import React, { useState, useEffect } from 'react';
import { db } from '../db/storage';
import { StatusSincronizacao, DetalheImeiDuplicado } from '../types';
import {
  Wifi,
  WifiOff,
  Clock,
  Send,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  CloudUpload,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ModalAlertaDuplicidadeServidor } from './ModalAlertaDuplicidadeServidor';

interface PainelStatusSistemaProps {
  onAbrirPendentes?: () => void;
  compacto?: boolean;
}

export const PainelStatusSistema: React.FC<PainelStatusSistemaProps> = ({
  onAbrirPendentes,
  compacto = false,
}) => {
  const [status, setStatus] = useState<StatusSincronizacao>(() => db.obterStatusSincronizacao());
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [duplicadosAlerta, setDuplicadosAlerta] = useState<DetalheImeiDuplicado[] | null>(null);
  const [totalEnviadosAlerta, setTotalEnviadosAlerta] = useState<number>(0);
  const [expandido, setExpandido] = useState<boolean>(!compacto);

  const atualizarStatus = () => {
    setStatus(db.obterStatusSincronizacao());
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      atualizarStatus();
    };
    const handleOffline = () => {
      setIsOnline(false);
      atualizarStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = db.onMudanca(() => {
      atualizarStatus();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const handleEnviarParaOnline = async () => {
    if (!isOnline) {
      setSyncFeedback('Não foi possível enviar os dados. Verifique sua conexão com a internet.');
      setTimeout(() => setSyncFeedback(null), 4000);
      return;
    }

    setSyncLoading(true);
    try {
      const res = await db.sincronizarOnline();
      if (res.itensDuplicados && res.itensDuplicados.length > 0) {
        setDuplicadosAlerta(res.itensDuplicados);
        setTotalEnviadosAlerta(res.totalSincronizados);
        setSyncFeedback(
          `Bloqueio: ${res.itensDuplicados.length} IMEI(s) já existem no servidor central.`
        );
      } else {
        setSyncFeedback(
          res.totalSincronizados > 0
            ? 'Dados enviados com sucesso para o servidor.'
            : res.mensagem
        );
      }
    } catch {
      setSyncFeedback('Não foi possível enviar os dados. Verifique sua conexão.');
    } finally {
      setSyncLoading(false);
      atualizarStatus();
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all">
        {/* Barra Superior do Painel */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Painel de Status do Sistema
            </span>

            {/* Badge Status da Conexão */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-400/30 animate-pulse'
              }`}
            >
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Wifi className="w-3 h-3" />
                  <span>ONLINE</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <WifiOff className="w-3 h-3" />
                  <span>OFFLINE</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Enviar para Online */}
            <button
              onClick={handleEnviarParaOnline}
              disabled={syncLoading}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-60 text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              title="Sincronizar registros pendentes com o servidor central"
            >
              {syncLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              <span>Enviar para Online</span>
            </button>

            {compacto && (
              <button
                onClick={() => setExpandido(!expandido)}
                className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={expandido ? 'Recolher detalhes' : 'Expandir detalhes'}
              >
                {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Feedback Temporário de Envio */}
        {syncFeedback && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b ${
              syncFeedback.includes('sucesso')
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : syncFeedback.includes('Bloqueio') || syncFeedback.includes('Não foi possível')
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {syncFeedback.includes('sucesso') ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Indicadores Detalhados (Grid 5 Cards) */}
        {expandido && (
          <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs bg-slate-50/70">
            {/* Card 1: Registros Pendentes */}
            <div
              onClick={onAbrirPendentes}
              className={`p-3 rounded-xl border transition-all ${
                status.registrosPendentes > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-900 cursor-pointer hover:bg-amber-100/70 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Registros Pendentes
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    status.registrosPendentes > 0 ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
                  }`}
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black font-mono">
                  {status.registrosPendentes}
                </span>
                {status.registrosPendentes > 0 && onAbrirPendentes && (
                  <span className="text-[10px] font-bold text-amber-700 underline">
                    (Ver fila)
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {status.registrosPendentes > 0 ? 'Aguardando envio' : 'Todos sincronizados'}
              </span>
            </div>

            {/* Card 2: Quantidade Enviada */}
            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Quantidade Enviada
                </span>
                <Send className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-xl font-black font-mono text-emerald-700">
                {status.quantidadeEnviada}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Gravados no servidor central
              </span>
            </div>

            {/* Card 3: Quantidade Bloqueada */}
            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Quantidade Bloqueada
                </span>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <span
                className={`text-xl font-black font-mono ${
                  status.quantidadeBloqueada > 0 ? 'text-rose-600 font-bold' : 'text-slate-700'
                }`}
              >
                {status.quantidadeBloqueada}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {status.quantidadeBloqueada > 0
                  ? 'IMEIs duplicados evitados'
                  : 'Nenhum bloqueio'}
              </span>
            </div>

            {/* Card 4: Último Envio */}
            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Último Envio
                </span>
                <Clock className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="font-bold text-slate-900 block truncate text-xs mt-1">
                {status.ultimoEnvio || 'Nenhum envio recente'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Transmissão para a nuvem
              </span>
            </div>

            {/* Card 5: Última Sincronização */}
            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Última Sincronização
                </span>
                <RefreshCw className="w-3.5 h-3.5 text-cyan-600" />
              </div>
              <span className="font-bold text-slate-900 block truncate text-xs mt-1">
                {status.ultimaSincronizacao || 'Carga inicial ativa'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Base central oficial
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modal Interativo de Alerta ao Colaborador quando houver IMEI Duplicado */}
      {duplicadosAlerta && duplicadosAlerta.length > 0 && (
        <ModalAlertaDuplicidadeServidor
          isOpen={!!duplicadosAlerta}
          duplicados={duplicadosAlerta}
          totalSincronizados={totalEnviadosAlerta}
          onClose={() => {
            setDuplicadosAlerta(null);
            atualizarStatus();
          }}
          onItensRemovidos={() => {
            atualizarStatus();
          }}
          onContinuarEnvio={async () => {
            setDuplicadosAlerta(null);
            await handleEnviarParaOnline();
          }}
        />

      )}
    </>
  );
};
