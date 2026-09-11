import React from 'react';
import { SamsungLogo } from './SamsungLogo';
import { SolutionsLogo } from './SolutionsLogo';
import { db } from '../db/storage';
import { LogOut, ShieldCheck, User as UserIcon, WifiOff } from 'lucide-react';

interface HeaderProps {
  onLogout: () => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const usuario = db.getUsuarioAtual();

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40">
      {/* Top Corporate Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logos Duo */}
          <div className="flex items-center gap-6">
            <SolutionsLogo height={42} />
            <div className="h-9 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:inline">
                Parceiro Oficial:
              </span>
              <div className="bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 flex items-center">
                <SamsungLogo height={20} variant="blue" />
              </div>
            </div>
          </div>

          {/* System Title & Badges */}
          <div className="hidden lg:flex flex-col items-center text-center">
            <h1 className="text-base font-black tracking-tight text-slate-800 uppercase flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              SISTEMA DE AUDITORIA GRUPO SOLUTIONS
            </h1>
            <p className="text-xs font-semibold text-slate-600">
              Controle, Conferência e Rastreabilidade de Produtos Samsung
            </p>
          </div>

          {/* Status & User Actions */}
          <div className="flex items-center gap-4">
            {/* 100% Offline Badge */}
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200 text-xs font-bold shadow-2xs">
              <WifiOff className="w-3.5 h-3.5" />
              <span>100% OFFLINE</span>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
                {usuario?.perfil === 'ADMINISTRADOR' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <UserIcon className="w-5 h-5" />
                )}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  {usuario?.nome || 'Operador'}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    usuario?.perfil === 'ADMINISTRADOR' ? 'text-purple-600' : 'text-blue-600'
                  }`}
                >
                  {usuario?.perfil || 'OPERADOR'}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Sair / Trocar de Usuário"
                className="ml-1 p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

