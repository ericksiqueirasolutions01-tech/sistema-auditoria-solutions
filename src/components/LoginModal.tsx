import React, { useState, useRef } from 'react';
import { db } from '../db/storage';
import { SamsungLogo } from './SamsungLogo';
import { SolutionsLogo } from './SolutionsLogo';
import { Lock, User, ShieldCheck, ArrowRight, AlertTriangle, KeyRound } from 'lucide-react';

interface LoginModalProps {
  onLoginSucesso: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSucesso }) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const senhaInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const res = db.autenticar(login, senha);
    if (res.sucesso) {
      onLoginSucesso();
    } else {
      setErro(res.erro || 'Usuário ou senha incorretos.');
      senhaInputRef.current?.select();
    }
  };

  const selecionarUsuario = (loginNome: string) => {
    setLogin(loginNome);
    setSenha('');
    setErro(null);
    setTimeout(() => {
      senhaInputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
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
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              SISTEMA DE AUDITORIA GRUPO SOLUTIONS
            </h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Autenticação por Perfil & Regional • Samsung
            </p>
          </div>
        </div>

        {erro && (
          <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
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
                placeholder="Ex: VIA VAREJO RJ ou ADMIN"
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
                placeholder="Digite a senha (diferencia maiúsculas)"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            Acessar Sistema
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Regional / Admin Selection Buttons */}
        <div className="border-t border-slate-100 pt-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              Selecionar Usuário / Regional:
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Requer senha individual</span>
          </div>

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
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}
            >
              <span>📍 SP</span>
              <span className={`text-[10px] font-bold ${login === 'VIA VAREJO SP' ? 'text-indigo-100' : 'text-indigo-600'}`}>
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

          <button
            type="button"
            onClick={() => selecionarUsuario('ADMIN')}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border mt-1 ${
              login === 'ADMIN' || login === 'ADMINISTRADOR'
                ? 'bg-purple-700 text-white border-purple-800 shadow-xs'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span>Selecionar <strong>ADMIN</strong> (Administrador Geral)</span>
          </button>

          <p className="text-[10px] text-slate-400 text-center pt-1 font-medium">
            Senhas oficiais: <strong>Senha123</strong> (Regionais) • <strong>Solutions123</strong> (Administrador)
          </p>
        </div>
      </div>
    </div>
  );
};

