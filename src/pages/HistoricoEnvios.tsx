import React, { useState, useEffect } from 'react';
import { db } from '../db/storage';
import { RegistroSincronizacaoEnvio, DetalheImeiDuplicado, LogTentativaDuplicado } from '../types';
import { ModalAlertaDuplicidadeServidor } from '../components/ModalAlertaDuplicidadeServidor';
import {
  SendHorizontal,
  CloudUpload,
  RefreshCw,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Monitor,
  Building2,
  Calendar,
  Layers,
  ArrowUpDown,
  Filter,
  Clock,
  Barcode,
  ShieldAlert,
  User,
  Trash2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const HistoricoEnvios: React.FC = () => {
  const usuario = db.getUsuarioAtual();
  const isAdmin = usuario?.perfil === 'ADMINISTRADOR';

  const [regionalFiltro, setRegionalFiltro] = useState(
    isAdmin ? 'TODAS' : usuario?.regional || 'VIA VAREJO RJ'
  );
  const [busca, setBusca] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [notificacao, setNotificacao] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [duplicadosAlerta, setDuplicadosAlerta] = useState<DetalheImeiDuplicado[] | null>(null);
  const [totalEnviadosAlerta, setTotalEnviadosAlerta] = useState<number>(0);

  useEffect(() => {
    return db.onMudanca(() => {
      setRefreshKey((k) => k + 1);
    });
  }, []);

  const historicoEnvios = db.listarHistoricoEnvios(regionalFiltro);
  const computadores = db.listarComputadoresCadastrados(regionalFiltro);
  const statusSync = db.obterStatusSincronizacao();

  const produtosEnviados = db.listarProdutos({
    regional: regionalFiltro !== 'TODAS' ? regionalFiltro : undefined,
    status_sincronizacao: 'ENVIADO',
  });

  // Filtragem
  const enviosFiltrados = historicoEnvios.filter((e) => {
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      const match =
        e.computador_id.toLowerCase().includes(termo) ||
        e.computador_nome.toLowerCase().includes(termo) ||
        e.regional.toLowerCase().includes(termo) ||
        e.data_envio.toLowerCase().includes(termo) ||
        (e.detalhes && e.detalhes.toLowerCase().includes(termo));
      if (!match) return false;
    }
    return true;
  });

  // Métricas
  const totalEnvios = enviosFiltrados.length;
  const totalProdutosSincronizados = enviosFiltrados.reduce(
    (acc, curr) => acc + curr.quantidade_enviada,
    0
  );
  const pcsDistintos = new Set(enviosFiltrados.map((e) => e.computador_id)).size;

  const tentativasDuplicadas = db.listarTentativasDuplicadas();

  const handleSincronizarAgora = async () => {
    setSyncLoading(true);
    try {
      const res = await db.sincronizarOnline();
      if (res.itensDuplicados && res.itensDuplicados.length > 0) {
        setDuplicadosAlerta(res.itensDuplicados);
        setTotalEnviadosAlerta(res.totalSincronizados);
        setNotificacao(
          `Bloqueio de Duplicidade: ${res.itensDuplicados.length} IMEI(s) já existem no servidor central.`
        );
      } else {
        setNotificacao(res.mensagem);
      }
    } catch {
      setNotificacao('Erro ao conectar ao servidor central.');
    } finally {
      setSyncLoading(false);
      setTimeout(() => setNotificacao(null), 4000);
    }
  };

  const exportarTentativasExcel = () => {
    const dados = tentativasDuplicadas.map((t, idx) => ({
      'Nº': idx + 1,
      'Data / Hora': t.data_hora,
      'Usuário Tentativa': t.usuario,
      'IMEI Bloqueado': t.imei,
      'Estação / Computador': t.computador,
      'Resultado Validação': t.resultado,
      'Data Cadastro Anterior': t.data_cadastro_existente || '-',
      'Usuário Anterior': t.usuario_existente || '-',
      Regional: t.regional || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tentativas_Duplicadas');
    XLSX.writeFile(
      wb,
      `Tentativas_Envio_Duplicado_IMEI_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`
    );
  };

  const exportarExcel = () => {
    const dados = enviosFiltrados.map((e, idx) => ({
      'Nº': idx + 1,
      'Data / Hora': e.data_envio,
      Regional: e.regional,
      'ID Computador': e.computador_id,
      'Nome Computador': e.computador_nome,
      'Quantidade Enviada': e.quantidade_enviada,
      Status: e.status,
      Detalhes: e.detalhes || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historico_Envios');
    XLSX.writeFile(
      wb,
      `Historico_Envios_Online_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Sincronização Offline-First
              </span>
              <span className="text-xs text-slate-300 font-medium">Controle Multi-Máquinas</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5">
              <SendHorizontal className="w-7 h-7 text-blue-400" />
              Histórico de Envios Online
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl">
              Rastreabilidade de lotes incrementais enviados ao servidor online. Cada computador opera de forma autônoma e envia apenas registros novos sem duplicidade.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSincronizarAgora}
              disabled={syncLoading}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-60 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              {syncLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4" />
              )}
              <span>ENVIAR PARA ONLINE</span>
            </button>

            <button
              onClick={exportarExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Notificação / Feedback Toast */}
        {notificacao && (
          <div className="mt-4 p-3 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-100 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notificacao}</span>
          </div>
        )}

        {/* KPIs Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-white/10">
          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] font-bold text-slate-300 uppercase block">Total de Envios</span>
            <span className="text-xl font-black text-white">{totalEnvios}</span>
            <span className="text-[9px] text-blue-300 block font-semibold">lotes registrados</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] font-bold text-emerald-300 uppercase block">Total Sincronizado</span>
            <span className="text-xl font-black text-emerald-400">{totalProdutosSincronizados}</span>
            <span className="text-[9px] text-emerald-200 block font-semibold">aparelhos conferidos</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] font-bold text-indigo-300 uppercase block">Computadores Ativos</span>
            <span className="text-xl font-black text-indigo-300">{pcsDistintos}</span>
            <span className="text-[9px] text-indigo-200 block font-semibold">estações com envio</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] font-bold text-amber-300 uppercase block">Pendentes Agora</span>
            <span className="text-xl font-black text-amber-300">{statusSync.pendentes}</span>
            <span className="text-[9px] text-amber-200 block font-semibold">aguardando próximo envio</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por Computador (ex: PC-RJ-001), Regional ou Data..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <select
                value={regionalFiltro}
                onChange={(e) => setRegionalFiltro(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black uppercase text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="TODAS">★ Todas as Regionais</option>
                {db.listarRegionais().map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Histórico de Envios */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[11px] font-black tracking-wider">
              <tr>
                <th className="py-3.5 px-4 text-center">Nº</th>
                <th className="py-3.5 px-4">Data / Hora Envio</th>
                <th className="py-3.5 px-4">Regional</th>
                <th className="py-3.5 px-4">Computador (ID)</th>
                <th className="py-3.5 px-4">Estação / Nome</th>
                <th className="py-3.5 px-4 text-center">Qtd Enviada</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Detalhes do Lote</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {enviosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    Nenhum envio registrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                enviosFiltrados.map((envio, idx) => (
                  <tr key={envio.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                      {envio.data_envio}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-[11px] text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase">
                        {envio.regional}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-slate-900 whitespace-nowrap">
                      <span className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                        💻 {envio.computador_id}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {envio.computador_nome}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-black text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full text-xs">
                        +{envio.quantidade_enviada} produtos
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-black text-emerald-700 bg-emerald-100 border border-emerald-400 px-2 py-0.5 rounded text-[10px] uppercase flex items-center justify-center gap-1 w-20 mx-auto">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {envio.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] italic">
                      {envio.detalhes || 'Sincronização incremental concluída sem erros.'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela de Produtos Enviados com Horário Individual */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                Produtos Sincronizados com Horário Individual
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Lista de aparelhos gravados no servidor com carimbo exato de data e hora do envio
              </p>
            </div>
          </div>
          <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            {produtosEnviados.length} seriais confirmados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="py-2.5 px-3 text-center w-12">Nº</th>
                <th className="py-2.5 px-3 font-mono">IMEI</th>
                <th className="py-2.5 px-3">Modelo</th>
                <th className="py-2.5 px-3">Caixa</th>
                <th className="py-2.5 px-3">Regional</th>
                <th className="py-2.5 px-3">Computador</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center min-w-[140px]">Horário de Envio 🕒</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {produtosEnviados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    Nenhum produto sincronizado ainda nesta regional.
                  </td>
                </tr>
              ) : (
                produtosEnviados.slice(0, 100).map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-center text-slate-400 font-sans">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-black text-slate-900 tracking-wider">
                      {p.imei || p.serial}
                    </td>
                    <td className="py-2 px-3 font-sans font-bold text-slate-800">
                      {p.modelo_produto}
                    </td>
                    <td className="py-2 px-3 font-sans font-bold text-blue-700 uppercase">
                      {p.numero_caixa}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <span className="font-bold text-[10px] text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {p.regional}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">
                        💻 {p.computador_id || 'PC-01'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-sans">
                      <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded text-[10px] uppercase">
                        🟢 Enviado
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-sans whitespace-nowrap">
                      {p.data_sincronizacao ? (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>
                            {new Date(p.data_sincronizacao).toLocaleString('pt-BR')}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela de Tentativas de Envio Duplicado (IMEI Bloqueado no Servidor Online) */}
      <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-xs overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-rose-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-rose-950 uppercase tracking-wide">
                  Logs de Tentativas de Envio Duplicado (IMEIs Bloqueados)
                </h3>
                <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-300 uppercase">
                  {tentativasDuplicadas.length} {tentativasDuplicadas.length === 1 ? 'tentativa' : 'tentativas'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Auditoria de seriais que tentaram ser enviados mas já existiam na base oficial do servidor online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {tentativasDuplicadas.length > 0 && (
              <button
                type="button"
                onClick={exportarTentativasExcel}
                className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Exportar log de duplicidades para Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Exportar Excel</span>
              </button>
            )}
            {isAdmin && tentativasDuplicadas.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Deseja limpar o histórico de tentativas duplicadas locais?')) {
                    db.limparTentativasDuplicadas();
                  }
                }}
                className="p-1.5 rounded-xl border border-slate-300 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Limpar histórico de tentativas"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="py-2.5 px-3 text-center w-12">Nº</th>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Usuário Tentativa</th>
                <th className="py-2.5 px-3 font-mono">IMEI Bloqueado</th>
                <th className="py-2.5 px-3">Estação / PC</th>
                <th className="py-2.5 px-3 text-center">Resultado</th>
                <th className="py-2.5 px-3">Cadastro Anterior Existente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {tentativasDuplicadas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    Nenhuma tentativa de envio de IMEI duplicado registrada. Integridade 100% preservada.
                  </td>
                </tr>
              ) : (
                tentativasDuplicadas.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-rose-50/50 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-sans">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-bold font-sans whitespace-nowrap">
                      {t.data_hora}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.usuario}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-black text-rose-700 tracking-wider">
                      <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
                        {t.imei}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-700">
                      💻 {t.computador}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className="bg-red-600 text-white font-black text-[9px] uppercase px-2 py-0.5 rounded-full tracking-wide">
                        DUPLICADO NO SERVIDOR
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 text-[11px]">
                      Cadastrado por <strong>{t.usuario_existente || 'Outro Colaborador'}</strong> em{' '}
                      <strong>{t.data_cadastro_existente || 'Data anterior'}</strong>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Alerta de Duplicidade */}
      {duplicadosAlerta && (
        <ModalAlertaDuplicidadeServidor
          isOpen={!!duplicadosAlerta}
          duplicados={duplicadosAlerta}
          totalSincronizados={totalEnviadosAlerta}
          onClose={() => setDuplicadosAlerta(null)}
          onItensRemovidos={() => {
            setRefreshKey((k) => k + 1);
          }}
          onContinuarEnvio={() => {
            setDuplicadosAlerta(null);
            handleSincronizarAgora();
          }}
        />
      )}
    </div>
  );
};

