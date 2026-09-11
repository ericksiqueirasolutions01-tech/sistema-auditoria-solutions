import React from 'react';
import { db } from '../db/storage';
import {
  LayoutDashboard,
  Barcode,
  Search,
  FileText,
  FileSpreadsheet,
  HardDrive,
  Users,
  ShieldAlert,
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const usuario = db.getUsuarioAtual();
  const isAdmin = usuario?.perfil === 'ADMINISTRADOR';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bipagem', label: 'Bipagem Rápida', icon: Barcode, badge: 'Principal' },
    { id: 'consulta', label: 'Consulta & Filtros', icon: Search },
    { id: 'espelhos', label: 'Gerador de Espelhos', icon: FileText },
    { id: 'importar', label: 'Importar Planilha', icon: FileSpreadsheet },
    { id: 'backup', label: 'Backup do Sistema', icon: HardDrive },
    ...(isAdmin ? [{ id: 'usuarios', label: 'Usuários & Logs', icon: Users }] : []),
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-20 z-30 shadow-2xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

