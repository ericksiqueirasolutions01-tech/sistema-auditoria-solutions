import React, { useState, useEffect } from 'react';
import { db } from './db/storage';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { LoginModal } from './components/LoginModal';
import { Dashboard } from './pages/Dashboard';
import { BipagemRapida } from './pages/BipagemRapida';
import { ConsultaProdutos } from './pages/ConsultaProdutos';
import { GeradorEspelhos } from './pages/GeradorEspelhos';
import { ImportacaoExcel } from './pages/ImportacaoExcel';
import { BackupSistema } from './pages/BackupSistema';
import { GestaoUsuarios } from './pages/GestaoUsuarios';
import { PainelAdmin } from './pages/PainelAdmin';
import { HistoricoEnvios } from './pages/HistoricoEnvios';
import { SamsungLogo } from './components/SamsungLogo';
import { SolutionsLogo } from './components/SolutionsLogo';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('bipagem'); // Core screen first
  const [usuario, setUsuario] = useState(() => db.getUsuarioAtual());
  const [mostrarLogin, setMostrarLogin] = useState(false);

  // Keyboard navigation shortcuts for factory/industrial operators
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      const target = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) && e.key !== 'F1' && e.key !== 'F2' && e.key !== 'F3' && e.key !== 'F4') {
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
        setActiveTab('dashboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    setMostrarLogin(true);
  };

  const handleLoginSucesso = () => {
    setUsuario(db.getUsuarioAtual());
    setMostrarLogin(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {/* Official Header */}
      <Header onLogout={handleLogout} activeTab={activeTab} />

      {/* Navigation Bar */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
        {activeTab === 'admin-regionais' && <PainelAdmin />}
        {activeTab === 'bipagem' && <BipagemRapida />}
        {activeTab === 'historico-envios' && <HistoricoEnvios />}
        {activeTab === 'consulta' && <ConsultaProdutos />}
        {activeTab === 'espelhos' && <GeradorEspelhos />}
        {activeTab === 'importar' && <ImportacaoExcel />}
        {activeTab === 'backup' && <BackupSistema />}
        {activeTab === 'usuarios' && <GestaoUsuarios />}
      </main>

      {/* Corporate Footer (No Print) */}
      <footer className="no-print bg-white border-t border-slate-200 py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SolutionsLogo height={24} showText={false} />
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

      {/* Login Dialog */}
      {mostrarLogin && <LoginModal onLoginSucesso={handleLoginSucesso} />}
    </div>
  );
};

export default App;

