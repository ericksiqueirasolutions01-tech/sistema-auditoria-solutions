import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db/storage';
import { ItemPendenciaDetalhada } from '../types';
import {
  X,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  CheckSquare,
  Square,
  ShieldAlert,
  Smartphone,
  Layers,
  Calendar,
} from 'lucide-react';

interface ModalGerenciarPendenciasProps {
  isOpen: boolean;
  regional: string;
  onClose: () => void;
  onPendenciasExcluidas?: (removidos: number) => void;
}

export const ModalGerenciarPendencias: React.FC<ModalGerenciarPendenciasProps> = ({
  isOpen,
  regional,
  onClose,
  onPendenciasExcluidas,
}) => {
  const [pendencias, setPendencias] = useState<ItemPendenciaDetalhada[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  const carregarLista = () => {
    const lista = db.listarPendenciasDetalhadas(regional);
    setPendencias(lista);
    // Por padrão seleciona todos os itens para agilizar a exclusão
    setSelecionados(new Set(lista.map((item) => String(item.id || item.imei))));
  };

  useEffect(() => {
    if (isOpen) {
      carregarLista();
      setFeedback(null);
      setBusca('');
    }
  }, [isOpen, regional]);

  // Listener para atualizações em tempo real
  useEffect(() => {
    if (!isOpen) return;
    return db.onMudanca(() => {
      carregarLista();
    });
  }, [isOpen, regional]);

  if (!isOpen) return null;

  const pendenciasFiltradas = pendencias.filter((item) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase().trim();
    return (
      item.imei.toLowerCase().includes(termo) ||
      item.serial.toLowerCase().includes(termo) ||
      item.modelo_produto.toLowerCase().includes(termo) ||
      item.numero_caixa.toLowerCase().includes(termo) ||
      (item.motivo && item.motivo.toLowerCase().includes(termo))
    );
  });

  const toggleSelecionar = (idOrImei: string) => {
    const novo = new Set(selecionados);
    if (novo.has(idOrImei)) {
      novo.delete(idOrImei);
    } else {
      novo.add(idOrImei);
    }
    setSelecionados(novo);
  };

  const toggleSelecionarTodos = () => {
    if (selecionados.size === pendenciasFiltradas.length && pendenciasFiltradas.length > 0) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(pendenciasFiltradas.map((item) => String(item.id || item.imei))));
    }
  };

  const handleExcluirSelecionados = () => {
    if (selecionados.size === 0) return;
    const qtd = selecionados.size;
    if (
      !confirm(
        `Tem certeza que deseja excluir ${qtd} pendência(s) selecionada(s)?\nEssa ação deve ser realizada caso os itens já tenham sido conferidos e ajustados no estoque físico.`
      )
    ) {
      return;
    }

    setExcluindo(true);
    try {
      const targets = Array.from(selecionados);
      const res = db.excluirProdutosPendentes(targets, regional);
      setFeedback({
        tipo: 'sucesso',
        msg: `${res.removidos} pendência(s) excluída(s) com sucesso! A base física está ajustada.`,
      });
      carregarLista();
      if (onPendenciasExcluidas) {
        onPendenciasExcluidas(res.removidos);
      }
    } catch (e: any) {
      setFeedback({
        tipo: 'erro',
        msg: e?.message || 'Falha ao excluir pendências.',
      });
    } finally {
      setExcluindo(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleExcluirTodas = () => {
    if (pendencias.length === 0) return;
    if (
      !confirm(
        `Deseja excluir TODAS as ${pendencias.length} pendências da regional ${regional}?\nConfirme apenas se todos os itens inconformes foram ajustados no estoque físico.`
      )
    ) {
      return;
    }

    setExcluindo(true);
    try {
      const res = db.excluirTodasPendencias(regional);
      setFeedback({
        tipo: 'sucesso',
        msg: `${res.removidos} pendência(s) excluída(s) com sucesso! Nenhuma pendência restante.`,
      });
      carregarLista();
      if (onPendenciasExcluidas) {
        onPendenciasExcluidas(res.removidos);
      }
    } catch (e: any) {
      setFeedback({
        tipo: 'erro',
        msg: e?.message || 'Falha ao excluir pendências.',
      });
    } finally {
      setExcluindo(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleExcluirUnitario = (item: ItemPendenciaDetalhada) => {
    if (
      !confirm(
        `Excluir pendência do IMEI ${item.imei} (${item.modelo_produto})?\nItem ajustado no físico.`
      )
    ) {
      return;
    }

    const res = db.excluirProdutosPendentes([item.id || item.imei], regional);
    setFeedback({
      tipo: 'sucesso',
      msg: `IMEI ${item.imei} excluído das pendências.`,
    });
    carregarLista();
    if (onPendenciasExcluidas) {
      onPendenciasExcluidas(res.removidos);
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div
        className="bg-white rounded-3xl shadow-2xl border-2 border-rose-300 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b border-rose-800/40">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border-2 border-rose-400/40 flex items-center justify-center text-rose-300 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                  Gestão & Exclusão de Pendências
                </h3>
                <span className="bg-rose-500 text-white font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs">
                  {pendencias.length} {pendencias.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-xs text-rose-200/80 font-medium mt-0.5">
                Regional ativa: <strong className="text-white font-black">{regional}</strong> • Itens inconformes que já foram ajustados no físico podem ser excluídos definitivamente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Banner Informativo & Ações Rápidas */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 shrink-0 space-y-3">
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold shadow-xs animate-fadeIn ${
                feedback.tipo === 'sucesso'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                  : 'bg-rose-50 text-rose-900 border border-rose-300'
              }`}
            >
              {feedback.tipo === 'sucesso' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{feedback.msg}</span>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por IMEI, Serial, Modelo ou Caixa..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Ações em Massa */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleSelecionarTodos}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                {selecionados.size === pendenciasFiltradas.length && pendenciasFiltradas.length > 0 ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-rose-600" />
                    <span>Desmarcar Todos</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-slate-400" />
                    <span>Marcar Todos ({pendenciasFiltradas.length})</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExcluirSelecionados}
                disabled={excluindo || selecionados.size === 0}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-2 shadow-xs cursor-pointer transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Selecionados ({selecionados.size})</span>
              </button>

              {pendencias.length > 0 && (
                <button
                  type="button"
                  onClick={handleExcluirTodas}
                  disabled={excluindo}
                  className="px-4 py-2 rounded-xl bg-rose-800 hover:bg-rose-900 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-2 shadow-xs cursor-pointer transition-all"
                  title="Excluir todas as pendências da regional de uma vez"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Todas ({pendencias.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabela de Pendências */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5">
          {pendenciasFiltradas.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-slate-800 uppercase">
                Nenhuma pendência encontrada!
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Todos os produtos auditados para esta regional estão 100% conferidos, sincronizados e sem divergências.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={selecionados.size === pendenciasFiltradas.length && pendenciasFiltradas.length > 0}
                        onChange={toggleSelecionarTodos}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 text-center w-12">Nº</th>
                    <th className="py-3 px-3 font-mono">IMEI / Serial</th>
                    <th className="py-3 px-3">Modelo</th>
                    <th className="py-3 px-3">Caixa / Lote</th>
                    <th className="py-3 px-3">Data</th>
                    <th className="py-3 px-3">Origem / Status</th>
                    <th className="py-3 px-3">Motivo da Inconformidade</th>
                    <th className="py-3 px-3 text-center w-16">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {pendenciasFiltradas.map((item, idx) => {
                    const idKey = String(item.id || item.imei);
                    const isSelected = selecionados.has(idKey);

                    return (
                      <tr
                        key={idKey}
                        onClick={() => toggleSelecionar(idKey)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected ? 'bg-rose-50/70 hover:bg-rose-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelecionar(idKey)}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-black text-rose-900 tracking-wider">
                          <span className="bg-rose-100 text-rose-950 px-2 py-0.5 rounded border border-rose-300">
                            {item.imei}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{item.modelo_produto}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-indigo-700 uppercase bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[10px]">
                            {item.numero_caixa} (Lote {item.numero_lote})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                          {item.data_auditoria || '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                            {item.origem === 'LOTE_PENDENTE' ? 'Inconforme Lote' : 'Pendente de Envio'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-rose-700 font-medium text-[11px]">
                          {item.motivo || 'Ajustado no físico / Não enviado'}
                        </td>
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleExcluirUnitario(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="Excluir esta pendência"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="bg-slate-100 p-4 px-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Total exibido: <strong className="text-slate-800">{pendenciasFiltradas.length}</strong> pendência(s) • Selecionadas para exclusão: <strong className="text-rose-700">{selecionados.size}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Fechar
            </button>
            {selecionados.size > 0 && (
              <button
                type="button"
                onClick={handleExcluirSelecionados}
                disabled={excluindo}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black uppercase shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Selecionadas ({selecionados.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
