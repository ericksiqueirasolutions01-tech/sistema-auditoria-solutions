import React, { useState, useEffect } from 'react';
import { db } from '../db/storage';
import { ProdutoAuditoria, SimNao } from '../types';
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  X,
  Check,
  RotateCcw,
  Clock,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const ConsultaProdutos: React.FC = () => {
  const usuario = db.getUsuarioAtual();
  const isAdmin = usuario?.perfil === 'ADMINISTRADOR';

  // Filters
  const [termo, setTermo] = useState('');
  const [modeloFiltro, setModeloFiltro] = useState('TODOS');
  const [caixaFiltro, setCaixaFiltro] = useState('TODOS');
  const [lacradoFiltro, setLacradoFiltro] = useState<'TODOS' | SimNao>('TODOS');
  const [regionalFiltro, setRegionalFiltro] = useState('TODAS');
  const [computadorFiltro, setComputadorFiltro] = useState('TODOS');
  const [statusSyncFiltro, setStatusSyncFiltro] = useState<'TODOS' | 'PENDENTE' | 'ENVIADO'>('TODOS');
  const [dataFiltro, setDataFiltro] = useState('');

  // Editing state (Admin)
  const [editando, setEditando] = useState<ProdutoAuditoria | null>(null);
  const [editCaixa, setEditCaixa] = useState('');
  const [editNf, setEditNf] = useState('');
  const [editNfConferida, setEditNfConferida] = useState<SimNao>('SIM');
  const [editObservacao, setEditObservacao] = useState('');
  const [editLacrado, setEditLacrado] = useState<SimNao>('SIM');
  const [editKit, setEditKit] = useState<SimNao | null>('SIM');
  const [editMarcas, setEditMarcas] = useState<SimNao | null>('NÃO');

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    return db.onMudanca(() => {
      setRefreshKey((k) => k + 1);
    });
  }, []);

  const regionais = db.listarRegionais();
  const computadores = db.listarComputadoresCadastrados(
    isAdmin && regionalFiltro !== 'TODAS' ? regionalFiltro : usuario?.regional || undefined
  );

  // Query products
  const produtos = db.listarProdutos({
    termoBusca: termo,
    modelo: modeloFiltro,
    caixa: caixaFiltro,
    produtoLacrado: lacradoFiltro,
    data: dataFiltro,
    regional: isAdmin && regionalFiltro !== 'TODAS' ? regionalFiltro : undefined,
    computador_id: computadorFiltro !== 'TODOS' ? computadorFiltro : undefined,
    status_sincronizacao: statusSyncFiltro !== 'TODOS' ? statusSyncFiltro : undefined,
  });

  const caixas = db.listarCaixas();

  const handleExcluir = (id: number, serial: string) => {
    if (!isAdmin) return;
    if (window.confirm(`Tem certeza que deseja excluir o IMEI ${serial}? Esta ação será registrada no histórico de auditoria.`)) {
      db.excluirProduto(id);
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleAbrirEdicao = (p: ProdutoAuditoria) => {
    if (!isAdmin) return;
    setEditando(p);
    setEditCaixa(p.numero_caixa);
    setEditNf(p.numero_nf || 'NF 001');
    setEditNfConferida(p.nf_conferida || 'SIM');
    setEditObservacao(p.observacao || '');
    setEditLacrado(p.produto_lacrado);
    setEditKit(p.kit_completo);
    setEditMarcas(p.aparelho_marcas_uso);
  };

  const handleSalvarEdicao = () => {
    if (!editando) return;
    db.atualizarProduto(editando.id, {
      numero_caixa: editCaixa.toUpperCase(),
      numero_nf: editNf.trim() || 'NF 001',
      nf_conferida: editNfConferida,
      observacao: editObservacao,
      produto_lacrado: editLacrado,
      kit_completo: editLacrado === 'SIM' ? 'SIM' : editKit,
      aparelho_marcas_uso: editLacrado === 'SIM' ? 'NÃO' : editMarcas,
    });
    setEditando(null);
    setRefreshKey((prev) => prev + 1);
  };

  const exportarPlanilha = () => {
    const data = produtos.map((p, i) => ({
      'Nº': i + 1,
      Regional: p.regional,
      'Computador ID': p.computador_id || 'PC-01',
      'Nome Estação': p.computador_nome || 'Estação 01',
      Fabricante: p.fabricante,
      Modelo: p.modelo_produto,
      EAN: p.ean,
      IMEI: p.imei || p.serial,
      Caixa: p.numero_caixa,
      'Nota Fiscal': p.numero_nf || 'NF 001',
      'NF foi conferida?': p.nf_conferida || 'SIM',
      'Data Auditoria': p.data_auditoria,
      Lacrado: p.produto_lacrado,
      'Kit Completo': p.kit_completo || '-',
      'Marcas de Uso': p.aparelho_marcas_uso || '-',
      Observação: p.observacao,
      Auditor: p.usuario_cadastro,
      'Status Sincronização':
        p.status_sincronizacao === 'ENVIADO'
          ? 'Enviado para Online'
          : p.status_sincronizacao === 'ERRO_DUPLICADO'
          ? 'Duplicado Servidor'
          : 'Aguardando envio para Online',
      'Data Envio Online': p.data_sincronizacao ? new Date(p.data_sincronizacao).toLocaleDateString('pt-BR') : '-',
      'Horário Envio Online': p.data_sincronizacao ? new Date(p.data_sincronizacao).toLocaleTimeString('pt-BR') : '-',
      'Data Cadastro': p.data_cadastro,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria_Samsung');
    XLSX.writeFile(wb, `Consulta_Auditoria_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const limparFiltros = () => {
    setTermo('');
    setModeloFiltro('TODOS');
    setCaixaFiltro('TODOS');
    setLacradoFiltro('TODOS');
    setRegionalFiltro('TODAS');
    setComputadorFiltro('TODOS');
    setStatusSyncFiltro('TODOS');
    setDataFiltro('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
              <Search className="w-6 h-6 text-blue-600" />
              Consulta e Rastreabilidade de Produtos
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Busca avançada por IMEI, modelo, caixa, data ou status de lacre
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportarPlanilha}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar para Excel ({produtos.length})
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 pt-2">
          {/* Quick text search */}
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar IMEI, Modelo, EAN..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Regional Filter */}
          {isAdmin ? (
            <div>
              <select
                value={regionalFiltro}
                onChange={(e) => setRegionalFiltro(e.target.value)}
                className="w-full py-2 px-3 bg-blue-50 border border-blue-300 rounded-xl text-xs font-black text-blue-900 focus:outline-none uppercase cursor-pointer"
                title="Filtrar por Regional"
              >
                <option value="TODAS">★ Regionais</option>
                {regionais.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
              <span className="text-[10px] text-slate-400 uppercase mr-1">Reg:</span>
              <span className="truncate">{usuario?.regional || 'GERAL'}</span>
            </div>
          )}

          {/* Computador / Estação Filter */}
          <div>
            <select
              value={computadorFiltro}
              onChange={(e) => setComputadorFiltro(e.target.value)}
              className="w-full py-2 px-3 bg-indigo-50 border border-indigo-300 rounded-xl text-xs font-black text-indigo-900 focus:outline-none cursor-pointer"
              title="Filtrar por Computador / Estação"
            >
              <option value="TODOS">💻 Todos PCs</option>
              {computadores.map((pc) => (
                <option key={pc.id} value={pc.id}>
                  {pc.id}
                </option>
              ))}
            </select>
          </div>

          {/* Caixa */}
          <div>
            <select
              value={caixaFiltro}
              onChange={(e) => setCaixaFiltro(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none uppercase"
            >
              <option value="TODOS">Todas Caixas</option>
              {caixas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Lacrado */}
          <div>
            <select
              value={lacradoFiltro}
              onChange={(e) => setLacradoFiltro(e.target.value as 'TODOS' | SimNao)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="TODOS">Lacre: Todos</option>
              <option value="SIM">Lacrados</option>
              <option value="NÃO">Não Lacrados</option>
            </select>
          </div>

          {/* Status Sincronização */}
          <div>
            <select
              value={statusSyncFiltro}
              onChange={(e) => setStatusSyncFiltro(e.target.value as 'TODOS' | 'PENDENTE' | 'ENVIADO')}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              title="Status de sincronização online"
            >
              <option value="TODOS">Sync: Todos</option>
              <option value="ENVIADO">🟢 Enviados para Online</option>
              <option value="PENDENTE">🟡 Aguardando envio para Online</option>
            </select>
          </div>

          {/* Data ou Limpar */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="w-full py-2 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            />
            <button
              onClick={limparFiltros}
              title="Limpar filtros"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[11px] font-black tracking-wider">
              <tr>
                <th className="py-3.5 px-4">IMEI</th>
                <th className="py-3.5 px-3 min-w-[100px]">Computador 💻</th>
                <th className="py-3.5 px-4">Regional</th>
                <th className="py-3.5 px-4">Modelo</th>
                <th className="py-3.5 px-4">EAN</th>
                <th className="py-3.5 px-4">Caixa</th>
                <th className="py-3.5 px-4">Nota Fiscal</th>
                <th className="py-3.5 px-3 text-center">NF Conferida?</th>
                <th className="py-3.5 px-3 text-center">Data</th>
                <th className="py-3.5 px-3 text-center">Lacrado</th>
                <th className="py-3.5 px-3 text-center">Kit Completo</th>
                <th className="py-3.5 px-3 text-center">Marcas de Uso</th>
                <th className="py-3.5 px-4">Observações</th>
                <th className="py-3.5 px-3 text-center min-w-[95px]">Status Sync</th>
                <th className="py-3.5 px-3 text-center min-w-[130px]">Horário Envio 🕒</th>
                {isAdmin && <th className="py-3.5 px-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {produtos.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 16 : 15} className="py-12 text-center text-slate-400 font-bold">
                    Nenhum produto encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                produtos.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-black text-slate-900 tracking-wider">
                      {p.imei || p.serial}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-[10px] text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 block">
                        💻 {p.computador_id || 'PC-01'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-[11px] text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {p.regional || 'GERAL'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.modelo_produto}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{p.ean}</td>
                    <td className="py-3 px-4">
                      <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase">
                        {p.numero_caixa}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {p.numero_nf || 'NF 001'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-black px-2 py-0.5 rounded text-[10px] ${
                          p.nf_conferida === 'NÃO'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {p.nf_conferida || 'SIM'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-medium">
                      {p.data_auditoria}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-black px-2 py-0.5 rounded text-[10px] ${
                          p.produto_lacrado === 'SIM'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.produto_lacrado}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      {p.kit_completo || '-'}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {p.aparelho_marcas_uso === 'SIM' ? (
                        <span className="text-rose-600 font-black">SIM</span>
                      ) : (
                        <span className="text-slate-500">{p.aparelho_marcas_uso || '-'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate italic">
                      {p.observacao || '-'}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                          p.status_sincronizacao === 'ENVIADO'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : p.status_sincronizacao === 'ERRO_DUPLICADO'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.status_sincronizacao === 'ENVIADO'
                              ? 'bg-emerald-600'
                              : 'bg-amber-600 animate-pulse'
                          }`}
                        />
                        {p.status_sincronizacao === 'ENVIADO'
                          ? 'Enviado para Online'
                          : p.status_sincronizacao === 'ERRO_DUPLICADO'
                          ? 'Duplicado Servidor'
                          : 'Aguardando envio para Online'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {p.status_sincronizacao === 'ENVIADO' && p.data_sincronizacao ? (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>
                            {new Date(p.data_sincronizacao).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300 font-bold text-xs">-</span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleAbrirEdicao(p)}
                            title="Editar registro"
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleExcluir(p.id, p.serial)}
                            title="Excluir registro"
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
          <span>Total de itens listados: {produtos.length}</span>
          <span>{isAdmin ? 'Modo Administrador: Edição e Exclusão liberadas' : 'Modo Operador: Somente visualização'}</span>
        </div>
      </div>

      {/* Edit Modal (Admin Only) */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 uppercase">
                Editar Registro - IMEI: {editando.imei || editando.serial}
              </h3>
              <button
                onClick={() => setEditando(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Caixa</label>
                  <input
                    type="text"
                    value={editCaixa}
                    onChange={(e) => setEditCaixa(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Nota Fiscal</label>
                  <input
                    type="text"
                    value={editNf}
                    onChange={(e) => setEditNf(e.target.value)}
                    placeholder="Ex: NF 001"
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">NF foi conferida?</label>
                <select
                  value={editNfConferida}
                  onChange={(e) => setEditNfConferida(e.target.value as SimNao)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="SIM">SIM</option>
                  <option value="NÃO">NÃO</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Produto Lacrado?</label>
                <select
                  value={editLacrado}
                  onChange={(e) => setEditLacrado(e.target.value as SimNao)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="SIM">SIM (Lacrado)</option>
                  <option value="NÃO">NÃO (Aberto)</option>
                </select>
              </div>

              {editLacrado === 'NÃO' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Kit Completo?</label>
                    <select
                      value={editKit || 'SIM'}
                      onChange={(e) => setEditKit(e.target.value as SimNao)}
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NÃO">NÃO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Marcas de Uso?</label>
                    <select
                      value={editMarcas || 'NÃO'}
                      onChange={(e) => setEditMarcas(e.target.value as SimNao)}
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    >
                      <option value="NÃO">NÃO</option>
                      <option value="SIM">SIM</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Observações</label>
                <input
                  type="text"
                  value={editObservacao}
                  onChange={(e) => setEditObservacao(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarEdicao}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

