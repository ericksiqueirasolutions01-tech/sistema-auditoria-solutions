import React, { useState, useRef } from 'react';
import { db, isDesktopApp } from '../db/storage';
import { SamsungLogo } from './SamsungLogo';
import { SolutionsLogo } from './SolutionsLogo';
import { Lock, User, ShieldCheck, ArrowRight, AlertTriangle, KeyRound, Download, Monitor, Globe } from 'lucide-react';
import { ModalDownloadApp } from './ModalDownloadApp';

interface LoginModalProps {
  onLoginSucesso: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSucesso }) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarModalDownload, setMostrarModalDownload] = useState(false);
  const senhaInputRef = useRef<HTMLInputElement>(null);

  const ehDesktop = isDesktopApp();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const loginNorm = login.trim().toUpperCase();
    if (ehDesktop && (loginNorm === 'ADMIN' || loginNorm === 'ADMINISTRADOR')) {
      setErro(
        'Acesso Restrito: O Painel de Administrador (Servidor Central) funciona exclusivamente pela Web Online (https://sistema-auditoria-solutions.vercel.app). Este aplicativo instalado no computador é exclusivo para operação e bipagem dos colaboradores nas bancadas.'
      );
      return;
    }

    const res = db.autenticar(login, senha);
    if (res.sucesso) {
      if (res.usuario) {
        db.registrarAcessoUsuario(res.usuario.nome, res.usuario.perfil, res.usuario.regional);
      }
      onLoginSucesso();
    } else {
      setErro(res.erro || 'Usuário ou senha incorretos.');
      senhaInputRef.current?.select();
    }
  };


  const selecionarUsuario = (loginNome: string) => {
    setLogin(loginNome);
    if (loginNome === 'ADMIN' || loginNome === 'ADMINISTRADOR') {
      setSenha('Solutions123');
    } else {
      setSenha('');
    }
    setErro(null);
    setTimeout(() => {
      senhaInputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 space-y-6">
        {/* Logos & System Title */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <SolutionsLogo height={42} showText={false} />
            <div className="h-8 w-px bg-slate-200" />
            <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <SamsungLogo height={18} variant="blue" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center mb-2">
              {ehDesktop ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 border border-blue-200 text-blue-800 rounded-full text-[10px] font-black uppercase tracking-wider">
                  <Monitor className="w-3.5 h-3.5 text-blue-600" />
                  Estação de Bipagem • Operador
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 border border-purple-200 text-purple-800 rounded-full text-[10px] font-black uppercase tracking-wider shadow-2xs">
                  <Globe className="w-3.5 h-3.5 text-purple-600" />
                  Servidor Central Online • Gestão
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              SISTEMA DE AUDITORIA GRUPO SOLUTIONS
            </h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {ehDesktop
                ? 'Estação Local de Bipagem • Modo 100% Offline'
                : 'Servidor Central de Consolidação • Painel Administrativo'}
            </p>
          </div>
        </div>

        {erro && (
          <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold flex items-start gap-2 leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Usuário / Regional
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={ehDesktop ? "Ex: VIA VAREJO RJ" : "Ex: ADMIN ou VIA VAREJO RJ"}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={senhaInputRef}
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black py-3 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-blue-500/25 transition-all cursor-pointer"
          >
            <span>Acessar o Sistema</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Seleção Rápida de Usuários */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block text-center">
            {ehDesktop ? 'Selecione a sua regional de bipagem:' : 'Acesso rápido para autenticação:'}
          </span>

          {/* Se estiver no servidor online, botão ADMIN em destaque absoluto */}
          {!ehDesktop && (
            <button
              type="button"
              onClick={() => selecionarUsuario('ADMIN')}
              className={`w-full py-3 px-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border shadow-sm ${
                login === 'ADMIN' || login === 'ADMINISTRADOR'
                  ? 'bg-purple-700 text-white border-purple-800 ring-2 ring-purple-400'
                  : 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-purple-200" />
              <span>Acessar Painel do Administrador (Servidor Central)</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => selecionarUsuario('VIA VAREJO RJ')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase transition-all text-left flex items-center justify-between cursor-pointer border ${
                login === 'VIA VAREJO RJ'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
              }`}
            >
              <span>📍 RJ</span>
              <span className={`text-[10px] font-bold ${login === 'VIA VAREJO RJ' ? 'text-blue-100' : 'text-blue-600'}`}>
                VIA VAREJO RJ
              </span>
            </button>

            <button
              type="button"
              onClick={() => selecionarUsuario('VIA VAREJO SP')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase transition-all text-left flex items-center justify-between cursor-pointer border ${
                login === 'VIA VAREJO SP'
                  ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                  : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-200'
              }`}
            >
              <span>📍 SP</span>
              <span className={`text-[10px] font-bold ${login === 'VIA VAREJO SP' ? 'text-cyan-100' : 'text-cyan-600'}`}>
                VIA VAREJO SP
              </span>
            </button>

            <button
              type="button"
              onClick={() => selecionarUsuario('VIA VAREJO MG')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase transition-all text-left flex items-center justify-between cursor-pointer border ${
                login === 'VIA VAREJO MG'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              <span>📍 MG</span>
              <span className={`text-[10px] font-bold ${login === 'VIA VAREJO MG' ? 'text-emerald-100' : 'text-emerald-600'}`}>
                VIA VAREJO MG
              </span>
            </button>

            <button
              type="button"
              onClick={() => selecionarUsuario('VIA VAREJO BA')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase transition-all text-left flex items-center justify-between cursor-pointer border ${
                login === 'VIA VAREJO BA'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              <span>📍 BA</span>
              <span className={`text-[10px] font-bold ${login === 'VIA VAREJO BA' ? 'text-amber-100' : 'text-amber-600'}`}>
                VIA VAREJO BA
              </span>
            </button>
          </div>
        </div>

        {/* Rodapé: Download (Apenas na versão Online) ou Indicador (No Desktop) */}
        {!ehDesktop ? (
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setMostrarModalDownload(true)}
              className="w-full bg-slate-900 hover:bg-slate-800 active:scale-98 text-white py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all border border-slate-800"
            >
              <Download className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>⬇ Baixar Aplicativo para Computador (.EXE)</span>
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-1 font-medium">
              Instalador Windows para bancadas de operadores • Funcionamento 100% Offline
            </p>
          </div>
        ) : (
          <div className="border-t border-slate-100 pt-3 text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-[10px] font-bold">
              <Monitor className="w-3.5 h-3.5 text-blue-600" />
              <span>Aplicativo Windows Instalado • Estação de Bipagem</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              O Painel do Administrador (Servidor Central) funciona exclusivamente pela Web Online.
            </p>
          </div>
        )}
      </div>

      {mostrarModalDownload && (
        <ModalDownloadApp onClose={() => setMostrarModalDownload(false)} />
      )}
    </div>
  );
};


