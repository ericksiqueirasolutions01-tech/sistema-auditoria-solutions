import React, { useState, useEffect } from 'react';
import { SamsungLogo } from './SamsungLogo';
import { SolutionsLogo } from './SolutionsLogo';
import { db } from '../db/storage';
import { ModalIdentificacaoComputador } from './ModalIdentificacaoComputador';
import { ModalItensPendentes } from './ModalItensPendentes';
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
  const [mostrarModalPendentes, setMostrarModalPendentes] = useState(false);
  const [computadorAtual, setComputadorAtual] = useState<ComputadorInfo>(() =>
    db.obterComputadorAtual(usuario?.regional || undefined)
  );

  const [statusSync, setStatusSync] = useState(() => db.obterStatusSincronizacao());

  useEffect(() => {
    return db.onMudanca(() => {
      setStatusSync(db.obterStatusSincronizacao());
    });
  }, []);

  const handleSincronizar = async () => {
    setSyncLoading(true);
    try {
      const res = await db.sincronizarOnline();
      setSyncFeedback(res.mensagem);
    } catch {
      setSyncFeedback('Erro ao conectar com o servidor central.');
    } finally {
      setSyncLoading(false);
      setStatusSync(db.obterStatusSincronizacao());
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40 no-print">
      <div className="w-full px-2 sm:px-3">
        {/* DESKTOP HEADER (MD e superior) */}
        <div className="hidden md:flex items-center justify-between h-20 gap-4">
          {/* Brand Logos Duo */}
          <div className="flex items-center gap-5 shrink-0">
            <SolutionsLogo height={40} />
            <div className="h-9 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Parceiro Oficial:
              </span>
              <div className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center">
                <SamsungLogo height={18} variant="blue" />
              </div>
            </div>
          </div>

          {/* Regional & Computador Indicators (Enquadrados) */}
          <div className="flex items-center gap-2 shrink-0">
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

          {/* Status, Sync Engine & User Actions */}
          <div className="flex items-center gap-2 py-1 shrink-0">
            {/* Sync Status Button (Clicável com modal de pendências) */}
            <button
              onClick={() => setMostrarModalPendentes(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border shrink-0 h-10 shadow-2xs whitespace-nowrap transition-all cursor-pointer hover:shadow-sm active:scale-95 ${
                statusSync.pendentes === 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/70'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70 ring-1 ring-amber-300 animate-subtle-pulse'
              }`}
              title="Clique para ver os detalhes dos itens pendentes de sincronização"
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusSync.pendentes === 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-black text-slate-500 uppercase leading-none">Status</span>
                <span className="text-xs font-black uppercase tracking-tight flex items-center gap-1">
                  {statusSync.pendentes === 0 ? 'Enviado' : `${statusSync.pendentes} Pendente${statusSync.pendentes > 1 ? 's' : ''}`}
                  {statusSync.pendentes > 0 && (
                    <span className="text-[9px] underline font-bold text-amber-700 ml-0.5">(Ver)</span>
                  )}
                </span>
              </div>
            </button>

            {/* Botão ENVIAR PARA ONLINE */}
            <button
              onClick={handleSincronizar}
              disabled={syncLoading}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-60 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 h-10 shadow-xs transition-all cursor-pointer whitespace-nowrap"
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
                <span className="text-[9px] font-black text-slate-400 uppercase leading-none">Rede</span>
                <span className="text-xs font-bold text-slate-700">Central Ativo</span>
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
              <div className="flex flex-col text-left pr-1">
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

        {/* MOBILE HEADER (Totalmente responsivo para celulares e coletores) */}
        <div className="flex md:hidden flex-col py-2.5 space-y-2.5">
          {/* Linha Superior: Logos + Estação + Usuário/Sair */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <SolutionsLogo height={28} />
              <div className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                <SamsungLogo height={14} variant="blue" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Estação Badge */}
              <button
                onClick={() => setMostrarModalComputador(true)}
                className="bg-slate-900 text-amber-300 text-[10px] font-mono font-bold px-2 py-1 rounded-lg flex items-center gap-1"
              >
                <Monitor className="w-3 h-3" />
                {computadorAtual.id.split('-').slice(-2).join('-')}
              </button>

              <button
                onClick={onLogout}
                title="Sair"
                className="p-1 text-slate-500 hover:text-red-600 rounded"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Linha Inferior Mobile: Status + Botão Enviar para Online em destaque */}
          <div className="grid grid-cols-12 gap-2 items-center">
            <button
              onClick={() => setMostrarModalPendentes(true)}
              className={`col-span-4 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-[11px] font-bold cursor-pointer active:scale-95 transition-all shadow-2xs ${
                statusSync.pendentes === 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-300'
              }`}
              title="Clique para ver os itens pendentes"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusSync.pendentes === 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className="truncate">
                {statusSync.pendentes === 0 ? 'Enviado' : `${statusSync.pendentes} Pend.`}
              </span>
            </button>

            <button
              onClick={handleSincronizar}
              disabled={syncLoading}
              className="col-span-8 bg-blue-600 active:bg-blue-800 disabled:opacity-60 text-white py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {syncLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              <span>Enviar para Online</span>
            </button>
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

      {/* Modal de Itens Pendentes (Inspeciona seriais e permite envio imediato) */}
      <ModalItensPendentes
        isOpen={mostrarModalPendentes}
        onClose={() => setMostrarModalPendentes(false)}
        onSyncConcluido={() => {
          setStatusSync(db.obterStatusSincronizacao());
        }}
      />
    </header>
  );
};

