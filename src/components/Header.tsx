import React, { useState, useEffect } from 'react';
import { SamsungLogo } from './SamsungLogo';
import { SolutionsLogo } from './SolutionsLogo';
import { db, isDesktopApp } from '../db/storage';
import { fecharSistemaCompleto } from '../services/systemLifecycle';
import { ModalIdentificacaoComputador } from './ModalIdentificacaoComputador';
import { ModalItensPendentes } from './ModalItensPendentes';
import { ModalAlertaDuplicidadeServidor } from './ModalAlertaDuplicidadeServidor';
import { ComputadorInfo, DetalheImeiDuplicado } from '../types';
import {
  LogOut,
  ShieldCheck,
  User as UserIcon,
  WifiOff,
  CloudUpload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Monitor,
  Layers,
  Globe,
  X,
  Power,
} from 'lucide-react';
import { PainelStatusSistema } from './PainelStatusSistema';

interface HeaderProps {
  onLogout: () => void;
  activeTab?: string;
}


export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const [usuario] = useState(() => db.getUsuarioAtual());
  const [colaboradorAtivo, setColaboradorAtivo] = useState(() => db.obterColaboradorAtivo());
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ texto: string; sucesso: boolean } | null>(null);
  const [mostrarModalComputador, setMostrarModalComputador] = useState(false);
  const [mostrarModalPendentes, setMostrarModalPendentes] = useState(false);
  const [duplicadosAlerta, setDuplicadosAlerta] = useState<DetalheImeiDuplicado[] | null>(null);
  const [totalEnviadosAlerta, setTotalEnviadosAlerta] = useState<number>(0);
  const [mostrarPainelStatusModal, setMostrarPainelStatusModal] = useState(false);
  const [computadorAtual, setComputadorAtual] = useState<ComputadorInfo>(() =>
    db.obterComputadorAtual(usuario?.regional || undefined)
  );


  const [statusSync, setStatusSync] = useState(() => db.obterStatusSincronizacao());
  const [statusEstacao, setStatusEstacao] = useState(() => db.obterStatusEstacao());

  useEffect(() => {
    const atualizar = () => {
      setStatusSync(db.obterStatusSincronizacao());
      setStatusEstacao(db.obterStatusEstacao());
      setColaboradorAtivo(db.obterColaboradorAtivo());
    };
    const unsub = db.onMudanca(atualizar);
    window.addEventListener('online', atualizar);
    window.addEventListener('offline', atualizar);
    const interval = setInterval(atualizar, 3000);
    return () => {
      unsub();
      window.removeEventListener('online', atualizar);
      window.removeEventListener('offline', atualizar);
      clearInterval(interval);
    };
  }, []);

  const handleSincronizar = async () => {
    setSyncLoading(true);
    try {
      const res = await db.sincronizarOnline();
      if (res.itensDuplicados && res.itensDuplicados.length > 0) {
        setDuplicadosAlerta(res.itensDuplicados);
        setTotalEnviadosAlerta(res.totalSincronizados);
        setSyncFeedback({
          texto: `Bloqueio: ${res.itensDuplicados.length} IMEI(s) já existem no servidor central.`,
          sucesso: false,
        });
      } else {
        setSyncFeedback({
          texto: res.mensagem,
          sucesso: res.sucesso,
        });
      }
    } catch {
      setSyncFeedback({
        texto: 'Erro ao conectar com o servidor central.',
        sucesso: false,
      });
    } finally {
      setSyncLoading(false);
      setStatusSync(db.obterStatusSincronizacao());
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  const formatarHora = (isoStr?: string | null) => {
    if (!isoStr) return '--:--';
    try {
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? isoStr : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40 no-print">
      <div className="w-full px-2 sm:px-3">
        {/* DESKTOP HEADER (MD e superior) */}
        <div className="hidden md:flex items-center justify-between h-20 gap-4">
          {/* Brand Logos Duo */}
          <div className="flex items-center gap-5 shrink-0">
            <SolutionsLogo height={40} />
            <div className="h-9 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Parceiro Oficial:
              </span>
              <div className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center">
                <SamsungLogo height={18} variant="blue" />
              </div>
            </div>
          </div>

          {/* Regional & Computador Indicators (Enquadrados) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Regional Card */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0 h-10 shadow-2xs">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase leading-none">
                  {usuario?.perfil === 'ADMINISTRADOR' ? 'Escopo' : 'Regional'}
                </span>
                <span className="text-xs font-black text-slate-900 uppercase tracking-tight whitespace-nowrap">
                  {usuario?.regional || 'TODAS (ADMIN)'}
                </span>
              </div>
            </div>

            {/* Workstation (Computador) Card para Operador OU Badge Servidor Central para Administrador */}
            {usuario?.perfil === 'ADMINISTRADOR' ? (
              <div className="flex items-center gap-2 bg-purple-950 text-white px-3 py-1.5 rounded-xl border border-purple-800 shrink-0 h-10 shadow-xs">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-black text-purple-300 uppercase leading-none">Servidor</span>
                  <span className="text-xs font-mono font-black text-white tracking-wide whitespace-nowrap">
                    CENTRAL ONLINE
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setMostrarModalComputador(true)}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border border-slate-800 shrink-0 h-10 shadow-xs transition-all cursor-pointer"
                title="Identificação única desta máquina (Clique para alterar o computador/estação)"
              >
                <Monitor className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-black text-slate-400 uppercase leading-none">Estação</span>
                  <span className="text-xs font-mono font-black text-amber-300 tracking-wide whitespace-nowrap">
                    {computadorAtual.id}
                  </span>
                </div>
              </button>
            )}

            {/* Colaborador Identificado Card */}
            {colaboradorAtivo && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl shrink-0 h-10 shadow-2xs">
                <UserIcon className="w-4 h-4 text-blue-700 shrink-0" />
                <div className="flex flex-col text-left max-w-[170px]">
                  <span className="text-[9px] font-black text-blue-500 uppercase leading-none">
                    Colaborador
                  </span>
                  <span className="text-xs font-black text-blue-950 uppercase tracking-tight truncate" title={colaboradorAtivo}>
                    {colaboradorAtivo}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Status, Sync Engine & User Actions */}
          <div className="flex items-center gap-2 py-1 shrink-0">
            {usuario?.perfil === 'ADMINISTRADOR' ? (
              <button
                onClick={async () => {
                  setSyncLoading(true);
                  await db.puxarAtualizacoesServidor();
                  setSyncLoading(false);
                  setSyncFeedback({ texto: 'Dados do servidor central atualizados com sucesso.', sucesso: true });
                  setTimeout(() => setSyncFeedback(null), 3000);
                }}
                disabled={syncLoading}
                className="bg-purple-700 hover:bg-purple-800 active:scale-95 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 h-10 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                title="Sincronizar e consultar os lançamentos mais recentes das bancadas no servidor central"
              >
                <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar Servidor</span>
              </button>
            ) : (
              <>
                {/* Sync Status Button (Clicável com modal de pendências) */}
                <button
                  onClick={() => setMostrarModalPendentes(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border shrink-0 h-10 shadow-2xs whitespace-nowrap transition-all cursor-pointer hover:shadow-sm active:scale-95 ${
                    statusSync.pendentes === 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/70'
                      : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70 ring-1 ring-amber-300 animate-subtle-pulse'
                  }`}
                  title="Clique para ver os detalhes dos itens pendentes de sincronização"
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusSync.pendentes === 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-black text-slate-500 uppercase leading-none">Status</span>
                    <span className="text-xs font-black uppercase tracking-tight flex items-center gap-1">
                      {statusSync.pendentes === 0 ? 'Enviado para Online' : `${statusSync.pendentes} Aguardando Envio`}
                      {statusSync.pendentes > 0 && (
                        <span className="text-[9px] underline font-bold text-amber-700 ml-0.5">(Ver)</span>
                      )}
                    </span>
                  </div>
                </button>

                {/* Botão ENVIAR PARA ONLINE */}
                <button
                  onClick={handleSincronizar}
                  disabled={syncLoading}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-60 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 h-10 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  title="Enviar novos registros deste computador para a base online central"
                >
                  {syncLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <CloudUpload className="w-4 h-4 shrink-0" />
                  )}
                  <span>Enviar para Online</span>
                </button>
              </>
            )}

            {/* Indicador de Status da Estação Windows (FASE 6) */}
            <button
              onClick={() => setMostrarPainelStatusModal(true)}
              className={`flex items-center gap-2 px-3 py-1 rounded-xl border shrink-0 h-10 text-xs shadow-2xs whitespace-nowrap cursor-pointer transition-all hover:shadow-sm active:scale-95 ${
                statusEstacao.cor === 'verde'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100/70'
                  : statusEstacao.cor === 'azul'
                  ? 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100/70'
                  : statusEstacao.cor === 'amarelo'
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70 ring-1 ring-amber-300'
                  : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100/70'
              }`}
              title={`Status Estação: ${statusEstacao.rotulo} (${statusEstacao.descricao})\nÚltima Sincronização: ${statusEstacao.ultimaSincronizacao ? new Date(statusEstacao.ultimaSincronizacao).toLocaleString('pt-BR') : 'Nenhuma'}\nÚltima Comunicação: ${statusEstacao.ultimaComunicacao ? new Date(statusEstacao.ultimaComunicacao).toLocaleString('pt-BR') : 'Nenhuma'}\nPendências: ${statusEstacao.pendentes}`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    statusEstacao.cor === 'verde'
                      ? 'bg-emerald-500'
                      : statusEstacao.cor === 'azul'
                      ? 'bg-blue-500 animate-spin'
                      : statusEstacao.cor === 'amarelo'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {statusEstacao.rotulo}
                    </span>
                    {statusEstacao.pendentes > 0 && (
                      <span className="px-1 py-0.2 bg-amber-200 text-amber-900 rounded text-[9px] font-black">
                        {statusEstacao.pendentes} pend
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 leading-none">
                    Sync: {formatarHora(statusEstacao.ultimaSincronizacao)} | Com: {formatarHora(statusEstacao.ultimaComunicacao)}
                  </span>
                </div>
              </div>
            </button>


            {/* User Info Box */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 pl-2.5 pr-1 py-1 rounded-xl shrink-0 h-10 shadow-2xs">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                {usuario?.perfil === 'ADMINISTRADOR' ? (
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                ) : (
                  <UserIcon className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div className="flex flex-col text-left pr-1">
                <span className="text-xs font-black text-slate-900 leading-none whitespace-nowrap">
                  {usuario?.nome || 'Operador'}
                </span>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider leading-none mt-0.5 whitespace-nowrap ${
                    usuario?.perfil === 'ADMINISTRADOR' ? 'text-purple-600' : 'text-blue-600'
                  }`}
                >
                  {usuario?.regional || usuario?.perfil || 'OPERADOR'}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Sair / Trocar de Regional"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Botão Fechar Sistema no Aplicativo Instalado (Desktop) */}
            {isDesktopApp() && (
              <button
                type="button"
                onClick={fecharSistemaCompleto}
                title="Encerrar completamente o sistema e liberar memória e conexões"
                className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 h-10 shadow-xs transition-all cursor-pointer"
              >
                <Power className="w-4 h-4 shrink-0" />
                <span>Fechar Sistema</span>
              </button>
            )}
          </div>
        </div>

        {/* MOBILE HEADER (Totalmente responsivo para celulares e coletores) */}
        <div className="flex md:hidden flex-col py-2.5 space-y-2.5">
          {/* Linha Superior: Logos + Estação + Usuário/Sair */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <SolutionsLogo height={28} />
              <div className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                <SamsungLogo height={14} variant="blue" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Estação Badge ou Badge Servidor Central no Mobile */}
              {usuario?.perfil === 'ADMINISTRADOR' ? (
                <div className="bg-purple-950 text-emerald-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border border-purple-800">
                  <Globe className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>CENTRAL</span>
                </div>
              ) : (
                <button
                  onClick={() => setMostrarModalComputador(true)}
                  className="bg-slate-900 text-amber-300 text-[10px] font-mono font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                >
                  <Monitor className="w-3 h-3" />
                  {typeof computadorAtual?.id === 'string'
                    ? computadorAtual.id.split('-').slice(-2).join('-')
                    : 'PC-001'}
                </button>
              )}

              <button
                onClick={onLogout}
                title="Sair"
                className="p-1 text-slate-500 hover:text-red-600 rounded"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {isDesktopApp() && (
                <button
                  type="button"
                  onClick={fecharSistemaCompleto}
                  title="Fechar Sistema"
                  className="p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 border border-rose-200 cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Fechar</span>
                </button>
              )}
            </div>
          </div>

          {/* Tag de Colaborador Identificado (Mobile) */}
          {colaboradorAtivo && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs shadow-2xs">
              <UserIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[9px] text-blue-500 font-black uppercase">Colaborador:</span>
              <span className="truncate uppercase font-black">{colaboradorAtivo}</span>
            </div>
          )}

          {/* Linha Inferior Mobile: Status + Botão Ação */}
          {usuario?.perfil === 'ADMINISTRADOR' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setSyncLoading(true);
                  await db.puxarAtualizacoesServidor();
                  setSyncLoading(false);
                  setSyncFeedback({ texto: 'Dados do servidor central atualizados.', sucesso: true });
                  setTimeout(() => setSyncFeedback(null), 3000);
                }}
                disabled={syncLoading}
                className="w-full bg-purple-700 active:bg-purple-900 disabled:opacity-60 text-white py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar Servidor Central</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-2 items-center">
              <button
                onClick={() => setMostrarModalPendentes(true)}
                className={`col-span-4 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-[11px] font-bold cursor-pointer active:scale-95 transition-all shadow-2xs ${
                  statusSync.pendentes === 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-300'
                }`}
                title="Clique para ver os itens pendentes"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusSync.pendentes === 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className="truncate">
                  {statusSync.pendentes === 0 ? 'Enviado Online' : `${statusSync.pendentes} Aguardando`}
                </span>
              </button>

              <button
                onClick={handleSincronizar}
                disabled={syncLoading}
                className="col-span-8 bg-blue-600 active:bg-blue-800 disabled:opacity-60 text-white py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {syncLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                <span>Enviar para Online</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div
          className={`${
            syncFeedback.sucesso ? 'bg-emerald-600' : 'bg-rose-600'
          } text-white py-2 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-inner transition-all animate-fadeIn`}
        >
          {syncFeedback.sucesso ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{syncFeedback.texto}</span>
        </div>
      )}

      {/* Modal de Identificação do Computador */}
      {mostrarModalComputador && (
        <ModalIdentificacaoComputador
          onClose={() => setMostrarModalComputador(false)}
          onSalvar={(c) => {
            setComputadorAtual(c);
            setMostrarModalComputador(false);
          }}
        />
      )}

      {/* Modal de Itens Pendentes (Inspeciona seriais e permite envio imediato) */}
      <ModalItensPendentes
        isOpen={mostrarModalPendentes}
        onClose={() => setMostrarModalPendentes(false)}
        onSyncConcluido={() => {
          setStatusSync(db.obterStatusSincronizacao());
        }}
      />

      {/* Modal de Alerta de Bloqueio por Duplicidade no Servidor */}
      {duplicadosAlerta && (
        <ModalAlertaDuplicidadeServidor
          isOpen={!!duplicadosAlerta}
          duplicados={duplicadosAlerta}
          totalSincronizados={totalEnviadosAlerta}
          onClose={() => setDuplicadosAlerta(null)}
          onItensRemovidos={() => {
            setStatusSync(db.obterStatusSincronizacao());
          }}
          onContinuarEnvio={() => {
            setDuplicadosAlerta(null);
            handleSincronizar();
          }}
        />
      )}

      {/* Modal do Painel de Status do Sistema (Requisito 11) */}
      {mostrarPainelStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Painel Geral de Status do Sistema
              </h3>
              <button
                onClick={() => setMostrarPainelStatusModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <PainelStatusSistema
              compacto={false}
              onAbrirPendentes={() => {
                setMostrarPainelStatusModal(false);
                setMostrarModalPendentes(true);
              }}
            />
          </div>
        </div>
      )}
    </header>
  );

};

