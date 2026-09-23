import React, { useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Download,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { updateService, StatusAtualizacao } from '../services/updateService';
import { VERSAO_LOCAL } from '../version';

interface ModalAtualizacaoObrigatoriaProps {
  status: StatusAtualizacao;
}

export const ModalAtualizacaoObrigatoria: React.FC<ModalAtualizacaoObrigatoriaProps> = ({
  status,
}) => {
  const [iniciouClique, setIniciouClique] = useState(false);
  const info = status.infoNovaVersao;

  const handleAtualizar = async () => {
    setIniciouClique(true);
    await updateService.aplicarAtualizacao();
  };

  const downloadUrl =
    info?.downloadUrl ||
    'https://sistema-auditoria-solutions.vercel.app/downloads/Sistema-Auditoria-Solutions-Setup.exe';

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho de Alerta Bloqueante */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 p-5 sm:p-6 text-slate-950 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-950/20 flex items-center justify-center shrink-0 border border-slate-950/30">
            <AlertTriangle className="w-7 h-7 text-slate-950 animate-bounce" />
          </div>
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-1.5 shadow-xs">
              <Lock className="w-3 h-3" />
              Acesso Bloqueado Temporariamente
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950 leading-tight">
              Nova Versão Disponível — Atualização Obrigatória
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-900/90 mt-0.5">
              Esta estação precisa sincronizar antes de continuar. Por favor, atualize agora para continuar trabalhando na bancada.
            </p>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 sm:p-6 space-y-5 text-slate-200 text-xs sm:text-sm">
          {/* Card de Comparação de Versões */}
          <div className="grid grid-cols-2 gap-3 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                Sua Versão Atual
              </span>
              <span className="text-base font-black text-rose-400 font-mono block">
                v{VERSAO_LOCAL.versao} (Desatualizada)
              </span>
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[10px] font-black uppercase text-amber-400 block tracking-wider">
                Nova Versão Oficial
              </span>
              <span className="text-base font-black text-emerald-400 font-mono block">
                v{info?.versao || '1.1.0'} (Obrigatória)
              </span>
            </div>
          </div>

          {/* Justificativa e Regras da Atualização */}
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 text-amber-200/90 space-y-2">
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-amber-400">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              Novas Regras e Funcionalidades Obrigatórias:
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300 font-medium pl-1">
              {(info?.novidades && info.novidades.length > 0 ? info.novidades : VERSAO_LOCAL.novidades).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mensagem de Erro (se houver) */}
          {status.erro && (
            <div className="bg-rose-950/70 border border-rose-500 p-3 rounded-xl text-xs font-semibold text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{status.erro}</span>
            </div>
          )}

          {/* Estado de Progresso */}
          {status.atualizando && (
            <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl space-y-2.5 text-center">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{status.progresso || 'Aplicando atualização...'}</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-full w-full animate-pulse"></div>
              </div>
              <p className="text-[11px] text-slate-400">
                Por favor, não feche o aplicativo. O sistema reiniciará automaticamente com a nova versão.
              </p>
            </div>
          )}

          {/* Botão de Ação Principal (Clicar aqui para atualizar o sistema) */}
          {!status.atualizando && (
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleAtualizar}
                disabled={status.atualizando}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-98 ring-2 ring-amber-300"
              >
                <RefreshCw className="w-5 h-5 text-slate-950 animate-spin-slow" />
                {iniciouClique ? 'Atualizando Sistema...' : 'Clicar Aqui Para Atualizar o Sistema'}
              </button>

              <div className="flex items-center justify-center gap-3 pt-1">
                <a
                  href={downloadUrl}
                  download="Sistema-Auditoria-Solutions-Setup.exe"
                  className="text-[11px] font-bold text-slate-400 hover:text-amber-400 underline transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar instalador manualmente se necessário (.exe)
                </a>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-slate-800">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Atualização oficial e autenticada • Grupo Solutions & Samsung Brasil</span>
          </div>
        </div>
      </div>
    </div>
  );
};

