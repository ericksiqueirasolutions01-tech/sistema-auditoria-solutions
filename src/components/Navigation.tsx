import React from 'react';
import { db } from '../db/storage';
import {
  LayoutDashboard,
  Barcode,
  Search,
  FileText,
  HardDrive,
  Users,
  Building2,
  BarChart3,
  SendHorizontal,
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const usuario = db.getUsuarioAtual();
  const isAdmin = usuario?.perfil === 'ADMINISTRADOR';

  // 6. MENU DINÂMICO POR PERFIL CONFORME ESPECIFICAÇÃO
  const menuItems = isAdmin
    ? [
        { id: 'admin-regionais', label: 'Servidor Central', icon: Building2, badge: 'Nuvem' },
        { id: 'dashboard', label: 'Dashboard Geral', icon: LayoutDashboard },
        { id: 'relatorios', label: 'Consulta & Seriais', icon: Search },
        { id: 'graficos', label: 'Estatísticas & Fotos', icon: BarChart3 },
        { id: 'historico-envios', label: 'Histórico de Envios', icon: SendHorizontal, badge: 'Estações' },
        { id: 'usuarios', label: 'Usuários & Operadores', icon: Users },
        { id: 'exportacoes', label: 'Backup & Limpeza', icon: HardDrive },
      ]
    : [
        { id: 'bipagem', label: 'Bipagem / Auditoria', icon: Barcode, badge: 'Planilha' },
        { id: 'dashboard', label: 'Dashboard Regional', icon: LayoutDashboard },
        { id: 'consulta', label: 'Consulta Local', icon: Search },
        { id: 'espelhos', label: 'Espelhos de Caixas', icon: FileText },
        { id: 'sincronizacao', label: 'Sincronização', icon: SendHorizontal, badge: 'Online' },
      ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-24 md:top-20 z-30 shadow-2xs no-print">
      <div className="w-full px-2 sm:px-3">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar touch-scroll py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
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

