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
    <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40 no-print">
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

          {/* Regional & Computador Indicators (Enquadrados) */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {/* Regional Card */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0 h-10 shadow-2xs">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase leading-none">Regional</span>
                <span className="text-xs font-black text-slate-900 uppercase tracking-tight whitespace-nowrap">
                  {usuario?.regional || 'TODAS (ADMIN)'}
                </span>
              </div>
            </div>

            {/* Workstation (Computador) Card */}
            <button
              onClick={() => setMostrarModalComputador(true)}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border border-slate-800 shrink-0 h-10 shadow-xs transition-all cursor-pointer"
              title="Identificação única desta máquina (Clique para alterar o computador/estação)"
            >
              <Monitor className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase leading-none">Estação</span>
                <span className="text-xs font-mono font-black text-amber-300 tracking-wide whitespace-nowrap">
                  {computadorAtual.id}
                </span>
              </div>
            </button>
          </div>

          {/* Status, Sync Engine & User Actions (Todos Enquadrados) */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {/* Sync Status Box */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border shrink-0 h-10 shadow-2xs whitespace-nowrap ${
                statusSync.pendentes === 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
              title={
                statusSync.ultimaSincronizacao
                  ? `Último envio: ${new Date(statusSync.ultimaSincronizacao).toLocaleString('pt-BR')}`
                  : 'Nenhum envio recente realizado'
              }
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusSync.pendentes === 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-black text-slate-500 uppercase leading-none">Status</span>
                <span className="text-xs font-black uppercase tracking-tight">
                  {statusSync.pendentes === 0 ? 'Enviado' : `${statusSync.pendentes} Pendente${statusSync.pendentes > 1 ? 's' : ''}`}
                </span>
              </div>
            </div>

            {/* Botão ENVIAR PARA ONLINE */}
            <button
              onClick={handleSincronizar}
              disabled={syncLoading}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 h-10 shadow-xs transition-all cursor-pointer whitespace-nowrap"
              title="Enviar novos registros deste computador para a base online central"
            >
              {syncLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <CloudUpload className="w-4 h-4 shrink-0" />
              )}
              <span>Enviar para Online</span>
            </button>

            {/* 100% Offline Engine Box */}
            <div className="hidden xl:flex items-center gap-2 bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0 h-10 text-xs font-bold shadow-2xs whitespace-nowrap">
              <WifiOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase leading-none">Modo</span>
                <span className="text-xs font-bold text-slate-700">Offline Ativo</span>
              </div>
            </div>

            {/* User Info Box */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 pl-2.5 pr-1 py-1 rounded-xl shrink-0 h-10 shadow-2xs">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                {usuario?.perfil === 'ADMINISTRADOR' ? (
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                ) : (
                  <UserIcon className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div className="hidden sm:flex flex-col text-left pr-1">
                <span className="text-xs font-black text-slate-900 leading-none whitespace-nowrap">
                  {usuario?.nome || 'Operador'}
                </span>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider leading-none mt-0.5 whitespace-nowrap ${
                    usuario?.perfil === 'ADMINISTRADOR' ? 'text-purple-600' : 'text-blue-600'
                  }`}
                >
                  {usuario?.regional || usuario?.perfil || 'OPERADOR'}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Sair / Trocar de Regional"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
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

