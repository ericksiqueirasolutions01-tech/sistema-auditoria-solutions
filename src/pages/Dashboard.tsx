import React from 'react';
import { db } from '../db/storage';
import { SamsungLogo } from '../components/SamsungLogo';
import {
  Boxes,
  Barcode,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  ArrowUpRight,
  CloudUpload,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const metricas = db.obterMetricasDashboard();
  const usuario = db.getUsuarioAtual();

  const percentLacrado =
    metricas.totalAuditados > 0
      ? Math.round((metricas.produtosLacrados / metricas.totalAuditados) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Welcome & Quick Action Hero */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[11px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
                Auditoria Oficial Samsung
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Olá, {usuario?.nome || 'Operador'}!
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl font-medium">
              Painel de controle, conferência e rastreabilidade de produtos Samsung no Grupo Solutions.
              Pronto para iniciar a bipagem contínua ou emitir espelhos de caixas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('bipagem')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-blue-500/25 flex items-center gap-2 transition-all active:scale-95"
            >
              <Barcode className="w-4 h-4" />
              Iniciar Bipagem Rápida
            </button>
            <button
              onClick={() => onNavigate('espelhos')}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              Gerar Espelhos
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid (Requisito 17) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Auditados */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Auditados</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Barcode className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {metricas.totalAuditados}
          </div>
          <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
            Produtos conferidos
          </span>
        </div>

        {/* Total Caixas */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Caixas</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {metricas.totalCaixas}
          </div>
          <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
            Lotes identificados
          </span>
        </div>

        {/* Produtos Lacrados */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Lacrados</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 tracking-tight">
            {metricas.produtosLacrados}
          </div>
          <span className="text-[11px] text-emerald-700 font-bold mt-1 block">
            {percentLacrado}% do total
          </span>
        </div>

        {/* Produtos Não Lacrados */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Não Lacrados</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 tracking-tight">
            {metricas.produtosNaoLacrados}
          </div>
          <span className="text-[11px] text-amber-700 font-bold mt-1 block">
            Abertos para análise
          </span>
        </div>

        {/* Pendentes de Envio Online */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pendentes de Envio</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CloudUpload className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 tracking-tight">
            {metricas.pendencias}
          </div>
          <span className="text-[11px] text-amber-700 font-bold mt-1 block">
            {metricas.pendencias === 0 ? 'Base sincronizada com a nuvem' : 'Aguardando envio online'}
          </span>
        </div>

        {/* Última Auditoria */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-400 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Última Bipagem</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-black text-slate-800 tracking-tight mt-1 truncate">
            {metricas.ultimaAuditoria
              ? new Date(metricas.ultimaAuditoria).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : 'Sem registros'}
          </div>
          <span className="text-[11px] text-slate-400 font-semibold mt-2 block truncate">
            {metricas.ultimaAuditoria
              ? new Date(metricas.ultimaAuditoria).toLocaleDateString('pt-BR')
              : 'Aguardando início'}
          </span>
        </div>
      </div>

      {/* Visual Charts & Breakdown (Requisito 17) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Volume por Caixa */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Boxes className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                Produtos por Caixa
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400">Top 10 Caixas</span>
          </div>

          {metricas.produtosPorCaixa.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              Nenhuma caixa registrada ainda.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {metricas.produtosPorCaixa.map((item) => {
                const max = metricas.produtosPorCaixa[0].total || 1;
                const pct = Math.round((item.total / max) * 100);

                return (
                  <div key={item.caixa} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800">{item.caixa}</span>
                      <span className="text-slate-600">{item.total} produtos</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chart 2: Volume por Modelo Samsung */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                Distribuição por Modelo Samsung
              </h3>
            </div>
            <SamsungLogo height={14} variant="blue" />
          </div>

          {metricas.produtosPorModelo.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              Nenhum produto auditado ainda.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {metricas.produtosPorModelo.map((item) => {
                const max = metricas.produtosPorModelo[0].total || 1;
                const pct = Math.round((item.total / max) * 100);

                return (
                  <div key={item.modelo} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800">{item.modelo}</span>
                      <span className="text-indigo-600">{item.total} un.</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

