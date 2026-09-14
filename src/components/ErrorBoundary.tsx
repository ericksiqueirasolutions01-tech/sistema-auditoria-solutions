import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut, Trash2 } from 'lucide-react';
import { SolutionsLogo } from './SolutionsLogo';
import { SamsungLogo } from './SamsungLogo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro não tratado:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleLimparCacheERecarregar = () => {
    try {
      sessionStorage.clear();
      // Remove chaves de sessão e mantém dados operacionais se possível
      localStorage.removeItem('solutions_auditoria_sessao');
      localStorage.removeItem('solutions_auditoria_usuario_atual_v1');
    } catch {}
    window.location.href = '/';
  };

  private handleResetCompleto = () => {
    if (window.confirm('Deseja limpar todo o armazenamento local do navegador e recarregar?')) {
      try {
        localStorage.clear();
        sessionStorage.clear();
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      } catch {}
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="bg-white text-slate-900 rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-4">
                <SolutionsLogo height={38} showText={false} />
                <div className="h-7 w-px bg-slate-200" />
                <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <SamsungLogo height={16} variant="blue" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-rose-600 font-black text-xs uppercase tracking-wider">
                <AlertTriangle className="w-5 h-5" />
                <span>Recuperação do Sistema de Auditoria</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                Falha Temporária na Exibição do Painel
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Ocorreu uma divergência de cache ou renderização dos dados consolidados no seu navegador.
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-mono text-rose-900 overflow-x-auto max-h-40">
              <p className="font-bold text-rose-950 font-sans mb-1">Detalhes técnicos do erro:</p>
              <p className="break-all whitespace-pre-wrap">{this.state.error?.message || 'Erro desconhecido'}</p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleLimparCacheERecarregar}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar Tela Inicial / Fazer Novo Login</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCompleto}
                className="w-full bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-slate-500" />
                <span>Limpar Cache Antigo do Navegador e Resetar</span>
              </button>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100">
              Grupo Solutions • Sistema de Auditoria Samsung • Servidor Central
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

