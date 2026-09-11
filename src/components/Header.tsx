import React, { useState } from 'react';
import { SamsungLogo } from './SamsungLogo';
import { SolutionsLogo } from './SolutionsLogo';
import { db } from '../db/storage';
import { ModalIdentificacaoComputador } from './ModalIdentificacaoComputador';
import { ComputadorInfo } from '../types';
import {
  LogOut,
  ShieldCheck,
  User as UserIcon,
  WifiOff,
  CloudUpload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Monitor,
} from 'lucide-react';

interface HeaderProps {
  onLogout: () => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const usuario = db.getUsuarioAtual();
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [mostrarModalComputador, setMostrarModalComputador] = useState(false);
  const [computadorAtual, setComputadorAtual] = useState<ComputadorInfo>(() =>
    db.obterComputadorAtual(usuario?.regional || undefined)
  );

  const statusSync = db.obterStatusSincronizacao();

  const handleSincronizar = () => {
    setSyncLoading(true);
    setTimeout(() => {
      const res = db.sincronizarOnline();
      setSyncLoading(false);
      setSyncFeedback(res.mensagem);
      setTimeout(() => setSyncFeedback(null), 4000);
    }, 600);
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40">
      {/* Top Corporate Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Brand Logos Duo */}
          <div className="flex items-center gap-5 shrink-0">
            <SolutionsLogo height={40} />
            <div className="h-9 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">
                Parceiro Oficial:
              </span>
              <div className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center">
                <SamsungLogo height={18} variant="blue" />
              </div>
            </div>
          </div>

          {/* Regional & Computador Indicators */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Regional Indicator Pill */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Regional:
              </span>
              <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
                {usuario?.regional || 'TODAS AS REGIONAIS (ADMIN)'}
              </span>
            </div>

            {/* Workstation (Computador) Pill */}
            <button
              onClick={() => setMostrarModalComputador(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-full border border-slate-700 text-xs font-black uppercase shadow-xs transition-all cursor-pointer"
              title="Identificação única desta máquina (Clique para alterar o computador/estação)"
            >
              <Monitor className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-amber-300">{computadorAtual.id}</span>
              <span className="text-slate-400 text-[10px] hidden md:inline font-normal">({computadorAtual.nome})</span>
            </button>
          </div>

          {/* Status, Sync Engine & User Actions */}
          <div className="flex items-center gap-3">
            {/* Online Sync Controls */}
            <div className="flex items-center gap-2">
              {/* Sync Status Badge (Amarelo Pendente / Verde Enviado) */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider shadow-2xs ${
                  statusSync.pendentes === 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-400 animate-pulse'
                }`}
                title={
                  statusSync.ultimaSincronizacao
                    ? `Última sincronização: ${new Date(statusSync.ultimaSincronizacao).toLocaleString('pt-BR')}`
                    : 'Nenhum envio recente realizado'
                }
              >
                {statusSync.pendentes === 0 ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>🟢 Enviado</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                    <span>🟡 {statusSync.pendentes} Pendente{statusSync.pendentes > 1 ? 's' : ''}</span>
                  </>
                )}
              </div>

              {/* Botão ENVIAR PARA ONLINE */}
              <button
                onClick={handleSincronizar}
                disabled={syncLoading}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Enviar novos registros deste computador para a base online central"
              >
                {syncLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                <span>ENVIAR PARA ONLINE</span>
              </button>
            </div>

            {/* 100% Offline Engine Badge */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold shadow-2xs">
              <WifiOff className="w-3.5 h-3.5 text-slate-500" />
              <span>Offline Ativo</span>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
                {usuario?.perfil === 'ADMINISTRADOR' ? (
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                ) : (
                  <UserIcon className="w-5 h-5" />
                )}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-black text-slate-900 leading-tight">
                  {usuario?.nome || 'Operador'}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    usuario?.perfil === 'ADMINISTRADOR' ? 'text-purple-600' : 'text-blue-600'
                  }`}
                >
                  {usuario?.regional || usuario?.perfil || 'OPERADOR'}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Sair / Trocar de Regional"
                className="ml-1 p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div className="bg-emerald-600 text-white py-1.5 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-inner transition-all animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Modal de Identificação do Computador */}
      {mostrarModalComputador && (
        <ModalIdentificacaoComputador
          onClose={() => setMostrarModalComputador(false)}
          onSalvar={(c) => {
            setComputadorAtual(c);
            setMostrarModalComputador(false);
          }}
        />
      )}
    </header>
  );
};

