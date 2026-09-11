import React, { useState } from 'react';
import { db } from '../db/storage';
import { SamsungLogo } from './SamsungLogo';
import { SolutionsLogo } from './SolutionsLogo';
import { Lock, User, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';

interface LoginModalProps {
  onLoginSucesso: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSucesso }) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const res = db.autenticar(login, senha);
    if (res.sucesso) {
      onLoginSucesso();
    } else {
      setErro(res.erro || 'Credenciais inválidas.');
    }
  };

  const loginRapido = (tipo: 'admin' | 'operador') => {
    if (tipo === 'admin') {
      db.autenticar('admin', 'admin123');
    } else {
      db.autenticar('operador', 'operador123');
    }
    onLoginSucesso();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 space-y-6">
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
              SISTEMA DE AUDITORIA
            </h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Grupo Solutions • Samsung
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
            <label className="block font-bold text-slate-700 uppercase mb-1">Usuário / Login</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Ex: admin ou operador"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            Acessar Sistema
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo/Factory Access Buttons */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
            Acesso Rápido de Demonstração / Turno
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => loginRapido('operador')}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
            >
              Entrar como <strong>Operador</strong>
            </button>
            <button
              type="button"
              onClick={() => loginRapido('admin')}
              className="py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition-colors"
            >
              Entrar como <strong>Admin</strong>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

