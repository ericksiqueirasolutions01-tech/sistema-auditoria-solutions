import React, { useState } from 'react';
import { db } from '../db/storage';
import {
  CloudDownload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  HardDrive,
  Database,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { SolutionsLogo } from './SolutionsLogo';
import { SamsungLogo } from './SamsungLogo';

interface ModalPrimeiraSincronizacaoProps {
  onConcluido: () => void;
}

export const ModalPrimeiraSincronizacao: React.FC<ModalPrimeiraSincronizacaoProps> = ({
  onConcluido,
}) => {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [etapaAtual, setEtapaAtual] = useState<number>(0); // 0: Inicial, 1: Conectando, 2: Baixando, 3: Finalizando, 4: Sucesso
  const usuarioAtual = db.getUsuarioAtual();

  const etapas = [
    { id: 1, rotulo: 'Verificação de conexão com servidor online', icon: Wifi },
    { id: 2, rotulo: 'Download de configurações, parâmetros e permissões', icon: CloudDownload },
    { id: 3, rotulo: 'Carga do catálogo de modelos Samsung e estrutura de caixas', icon: Database },
    { id: 4, rotulo: 'Inicialização da base local SQLite protegida (100% Offline)', icon: HardDrive },
  ];

  const handleIniciarSincronizacao = async () => {
    setLoading(true);
    setErro(null);
    setEtapaAtual(1);

    // Passo 1: Verificar conectividade
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErro(
        'Atenção: A primeira inicialização após a instalação requer conexão com a internet para baixar os parâmetros, regras e configurações oficiais do servidor. Por favor, conecte-se à internet para prosseguir.'
      );
      setLoading(false);
      setEtapaAtual(0);
      return;
    }

    try {
      setEtapaAtual(2);
      await new Promise((resolve) => setTimeout(resolve, 800));

      setEtapaAtual(3);
      const res = await db.executarPrimeiraSincronizacao(usuarioAtual?.nome || 'Administrador');

      if (res.sucesso) {
        setEtapaAtual(4);
        await new Promise((resolve) => setTimeout(resolve, 600));
        setEtapaAtual(5); // Concluído com sucesso
      } else {
        setErro(res.mensagem);
        setEtapaAtual(0);
      }
    } catch {
      setErro(
        'Não foi possível concluir a primeira sincronização com o servidor central. Verifique sua conexão e tente novamente.'
      );
      setEtapaAtual(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 p-6 text-white text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <SolutionsLogo height={32} showText={false} />
            <div className="h-6 w-px bg-white/20" />
            <SamsungLogo height={16} variant="white" />
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-400/30 text-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Primeiro Acesso • Instalação Concluída
            </span>
            <h2 className="text-lg font-black uppercase tracking-tight">
              Sincronização Inicial Obrigatória
            </h2>
            <p className="text-xs text-blue-200 font-medium max-w-md mx-auto mt-1">
              Para habilitar o funcionamento offline seguro neste computador, é necessário carregar os parâmetros oficiais e a estrutura da base de dados do servidor central.
            </p>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-6">
          {erro && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-3 text-rose-900 text-xs font-bold animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="block font-black uppercase tracking-wide">
                  Conexão com a Internet Necessária
                </span>
                <p className="font-medium text-rose-800 leading-relaxed">{erro}</p>
              </div>
            </div>
          )}

          {/* Lista de Etapas da Sincronização Inicial */}
          <div className="space-y-3">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Etapas da Configuração Local:
            </span>
            <div className="space-y-2">
              {etapas.map((etapa) => {
                const Icone = etapa.icon;
                const isConcluida = etapaAtual > etapa.id || etapaAtual === 5;
                const isEmAndamento = etapaAtual === etapa.id;

                return (
                  <div
                    key={etapa.id}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                      isConcluida
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                        : isEmAndamento
                        ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-400/30'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isConcluida
                            ? 'bg-emerald-100 text-emerald-700'
                            : isEmAndamento
                            ? 'bg-blue-100 text-blue-700 animate-pulse'
                            : 'bg-slate-200/70 text-slate-400'
                        }`}
                      >
                        <Icone className="w-4 h-4" />
                      </div>
                      <span className={`font-bold ${isConcluida ? 'text-emerald-950' : isEmAndamento ? 'text-blue-950' : 'text-slate-600'}`}>
                        {etapa.rotulo}
                      </span>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isConcluida ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : isEmAndamento ? (
                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                      ) : (
                        <span className="text-[10px] font-mono font-bold text-slate-400">Pendente</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feedback de Sucesso Final */}
          {etapaAtual === 5 && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="block font-black uppercase">
                  Base Local Configurada com Sucesso!
                </span>
                <p className="font-medium text-emerald-800">
                  O computador agora está pronto para operar normalmente 100% offline. Novos dados serão sincronizados manualmente quando desejar.
                </p>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="pt-2">
            {etapaAtual === 5 ? (
              <button
                type="button"
                onClick={onConcluido}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span>Acessar Sistema de Auditoria</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleIniciarSincronizacao}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-60 text-white py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Realizando Sincronização Inicial...</span>
                  </>
                ) : (
                  <>
                    <CloudDownload className="w-4 h-4" />
                    <span>Iniciar Sincronização Inicial</span>
                  </>
                )}
              </button>
            )}

            <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
              Esta etapa ocorre apenas uma vez por computador após a instalação.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

