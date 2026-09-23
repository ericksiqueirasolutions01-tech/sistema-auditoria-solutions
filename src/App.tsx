import React, { useState, useEffect, Suspense, lazy } from 'react';
import { db, isDesktopApp } from './db/storage';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { LoginModal } from './components/LoginModal';
import { BipagemRapida } from './pages/BipagemRapida';
import { SamsungLogo } from './components/SamsungLogo';
import { SolutionsLogo } from './components/SolutionsLogo';
import { ModalPrimeiraSincronizacao } from './components/ModalPrimeiraSincronizacao';
import { ModalAtualizacaoObrigatoria } from './components/ModalAtualizacaoObrigatoria';
import { iniciarMonitoramentoCicloVida } from './services/systemLifecycle';
import { updateService, StatusAtualizacao } from './services/updateService';

// Lazy loading de módulos e páginas secundárias para minimizar o chunk inicial
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const PainelAdmin = lazy(() => import('./pages/PainelAdmin').then((m) => ({ default: m.PainelAdmin })));
const ConsultaProdutos = lazy(() => import('./pages/ConsultaProdutos').then((m) => ({ default: m.ConsultaProdutos })));
const GeradorEspelhos = lazy(() => import('./pages/GeradorEspelhos').then((m) => ({ default: m.GeradorEspelhos })));
const ImportacaoExcel = lazy(() => import('./pages/ImportacaoExcel').then((m) => ({ default: m.ImportacaoExcel })));
const BackupSistema = lazy(() => import('./pages/BackupSistema').then((m) => ({ default: m.BackupSistema })));
const GestaoUsuarios = lazy(() => import('./pages/GestaoUsuarios').then((m) => ({ default: m.GestaoUsuarios })));
const HistoricoEnvios = lazy(() => import('./pages/HistoricoEnvios').then((m) => ({ default: m.HistoricoEnvios })));

const LoadingModuloFallback = () => (
  <div className="flex flex-col items-center justify-center p-16 text-slate-500 text-xs font-bold gap-3">
    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    <span className="uppercase tracking-wider">Carregando módulo...</span>
  </div>
);

export const App: React.FC = () => {
  const [usuario, setUsuario] = useState(() => db.getUsuarioAtual());
  const [precisaSincronizacaoInicial, setPrecisaSincronizacaoInicial] = useState(
    () => !db.isConfiguracaoInicialConcluida()
  );
  const [statusAtualizacao, setStatusAtualizacao] = useState<StatusAtualizacao>({
    verificando: false,
    temAtualizacao: false,
    atualizando: false,
  });
  const [activeTab, setActiveTab] = useState(() =>
    usuario?.perfil === 'ADMINISTRADOR' ? 'admin-regionais' : 'bipagem'
  );

  // Monitoramento de atualizações obrigatórias do sistema
  useEffect(() => {
    const unsub = updateService.subscrever((st) => setStatusAtualizacao(st));
    return () => unsub();
  }, []);

  // Monitoramento de ciclo de vida (heartbeat e shutdown ao fechar)
  useEffect(() => {
    iniciarMonitoramentoCicloVida();
  }, []);

  // Route Guard: impedir acesso a áreas administrativas no aplicativo desktop ou por operador
  useEffect(() => {
    if (!usuario) {
      return;
    }
    if (isDesktopApp() || usuario.perfil === 'OPERADOR') {
      const forbiddenForOperator = [
        'admin-regionais',
        'relatorios',
        'graficos',
        'exportacoes',
        'usuarios',
        'backup',
        'importar',
      ];
      if (forbiddenForOperator.includes(activeTab)) {
        setActiveTab('bipagem');
      }
    }
  }, [usuario, activeTab]);

  // Keyboard navigation shortcuts for factory/industrial operators
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      const target = e.target as HTMLElement;
      if (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) &&
        e.key !== 'F1' &&
        e.key !== 'F2' &&
        e.key !== 'F3' &&
        e.key !== 'F4'
      ) {
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('bipagem');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('consulta');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('espelhos');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab(usuario?.perfil === 'ADMINISTRADOR' ? 'admin-regionais' : 'dashboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [usuario]);

  const handleLogout = () => {
    db.setUsuarioAtual(null);
    setUsuario(null);
    setActiveTab('bipagem');
  };

  const handleLoginSucesso = () => {
    const u = db.getUsuarioAtual();
    setUsuario(u);
    // CORREÇÃO 1 — Sincronização central compulsória após login
    db.puxarAtualizacoesServidor().catch(() => {});
    if (u?.perfil === 'ADMINISTRADOR') {
      setActiveTab('admin-regionais');
    } else {
      setActiveTab('bipagem');
    }
  };

  // REGRA FUNDAMENTAL: BLOQUEIO TOTAL POR ATUALIZAÇÃO OBRIGATÓRIA PENDENTE
  // O sistema não deixa o colaborador acessar enquanto ele não atualizar!
  if (statusAtualizacao.temAtualizacao) {
    return <ModalAtualizacaoObrigatoria status={statusAtualizacao} />;
  }

  if (!usuario) {
    return <LoginModal onLoginSucesso={handleLoginSucesso} />;
  }

  // REQUISITO 4: PRIMEIRA INSTALAÇÃO E SINCRONIZAÇÃO INICIAL OBRIGATÓRIA
  // Apenas no aplicativo instalado no computador (desktop app) para operadores.
  // Nunca deve ser exibido para o Administrador nem na versão web online!
  if (isDesktopApp() && usuario?.perfil !== 'ADMINISTRADOR' && precisaSincronizacaoInicial) {
    return (
      <ModalPrimeiraSincronizacao
        onConcluido={() => setPrecisaSincronizacaoInicial(false)}
      />
    );
  }

  return (

    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {/* Official Header */}
      <Header onLogout={handleLogout} activeTab={activeTab} />

      {/* Navigation Bar */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area (100% da Largura do Monitor - Modo Excel Completo) */}
      <main className="flex-1 w-full px-1 sm:px-2 py-1">
        <Suspense fallback={<LoadingModuloFallback />}>
          {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === 'admin-regionais' && <PainelAdmin />}
          {activeTab === 'relatorios' && <ConsultaProdutos />}
          {activeTab === 'graficos' && <PainelAdmin />}
          {activeTab === 'exportacoes' && <BackupSistema />}
          {activeTab === 'bipagem' && <BipagemRapida />}
          {activeTab === 'sincronizacao' && <HistoricoEnvios />}
          {activeTab === 'historico-envios' && <HistoricoEnvios />}
          {activeTab === 'consulta' && <ConsultaProdutos />}
          {activeTab === 'espelhos' && <GeradorEspelhos />}
          {activeTab === 'importar' && <ImportacaoExcel />}
          {activeTab === 'backup' && <BackupSistema />}
          {activeTab === 'usuarios' && <GestaoUsuarios />}
        </Suspense>
      </main>

      {/* Corporate Footer (No Print) */}
      <footer className="no-print bg-white border-t border-slate-200 py-3 mt-4 text-xs text-slate-500">
        <div className="w-full px-2 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <SolutionsLogo height={22} showText={false} />
            <span className="font-bold text-slate-700">GRUPO SOLUTIONS</span>
            <span>•</span>
            <span>Sistema de Auditoria e Qualidade Samsung</span>
            <span>•</span>
            <span className="text-emerald-600 font-bold">100% Offline (SQLite Engine)</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span>Atalhos: [F1] Bipagem | [F2] Consulta | [F3] Espelhos | [F4] Dashboard</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

