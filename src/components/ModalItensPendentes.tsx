import React, { useState } from 'react';
import { db } from '../db/storage';
import { ProdutoAuditoria, DetalheImeiDuplicado } from '../types';
import { ModalAlertaDuplicidadeServidor } from './ModalAlertaDuplicidadeServidor';
import {
  X,
  CloudUpload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  ShieldAlert,
} from 'lucide-react';

interface ModalItensPendentesProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncConcluido?: () => void;
}

export const ModalItensPendentes: React.FC<ModalItensPendentesProps> = ({
  isOpen,
  onClose,
  onSyncConcluido,
}) => {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);
  const [duplicadosAlerta, setDuplicadosAlerta] = useState<DetalheImeiDuplicado[] | null>(null);
  const [totalEnviadosAlerta, setTotalEnviadosAlerta] = useState<number>(0);

  if (!isOpen) return null;

  const pendentes: ProdutoAuditoria[] = db.listarProdutosPendentes();

  const handleEnviarOnline = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await db.sincronizarOnline();
      if (res.itensDuplicados && res.itensDuplicados.length > 0) {
        setDuplicadosAlerta(res.itensDuplicados);
        setTotalEnviadosAlerta(res.totalSincronizados);
        if (res.totalSincronizados > 0) {
          setFeedback({
            tipo: 'erro',
            msg: `${res.totalSincronizados} serial(is) enviado(s), mas ${res.itensDuplicados.length} IMEI(s) já existem no servidor e foram bloqueados.`,
          });
        } else {
          setFeedback({
            tipo: 'erro',
            msg: `Bloqueio: ${res.itensDuplicados.length} IMEI(s) rejeitado(s) pois já constam cadastrados no servidor.`,
          });
        }
      } else if (res.sucesso) {
        setFeedback({
          tipo: 'sucesso',
          msg: `${res.totalSincronizados} registro(s) sincronizado(s) com sucesso na base central online!`,
        });
        if (onSyncConcluido) onSyncConcluido();
      } else {
        setFeedback({
          tipo: 'erro',
          msg: res.mensagem || 'Falha ao sincronizar com o servidor.',
        });
      }
    } catch {
      setFeedback({
        tipo: 'erro',
        msg: 'Não foi possível conectar ao servidor central no momento.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho do Modal */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Itens Pendentes de Envio Online</h3>
                <span className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full">
                  {pendentes.length} {pendentes.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Produtos bipados e salvos localmente aguardando envio para a base central
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b shrink-0 ${
              feedback.tipo === 'sucesso'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {feedback.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Corpo do Modal: Lista de Itens */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {pendentes.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">Tudo Sincronizado!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Não há nenhum registro pendente neste computador/celular. Todos os produtos bipados já foram confirmados na nuvem online.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Atenção Operacional: </span>
                  Os {pendentes.length} seriais abaixo já estão seguros no armazenamento local deste dispositivo. Clique no botão azul abaixo para consolidar na base central do Administrador.
                </div>
              </div>

              {/* Tabela de Produtos Pendentes */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
                      <tr>
                        <th className="px-3 py-2.5">Serial (SN)</th>
                        <th className="px-3 py-2.5">Modelo / EAN</th>
                        <th className="px-3 py-2.5">Caixa</th>
                        <th className="px-3 py-2.5">Regional</th>
                        <th className="px-3 py-2.5">Estação / PC</th>
                        <th className="px-3 py-2.5">Horário Bipado</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                        <th className="px-3 py-2.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendentes.map((prod) => {
                        const isDuplicado = prod.status_sincronizacao === 'ERRO_DUPLICADO';
                        return (
                          <tr
                            key={prod.id || prod.serial}
                            className={`transition-colors ${
                              isDuplicado ? 'bg-rose-50/70 hover:bg-rose-100/70' : 'hover:bg-amber-50/40'
                            }`}
                          >
                            <td className="px-3 py-2.5 font-mono font-black text-slate-900">
                              <div className="flex items-center gap-1.5">
                                {isDuplicado && (
                                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                )}
                                <span>{prod.serial}</span>
                              </div>
                              {isDuplicado && prod.duplicado_servidor_info && (
                                <div className="text-[10px] text-rose-700 font-sans font-medium mt-0.5">
                                  Cadastrado anteriormente por:{' '}
                                  <strong>{prod.duplicado_servidor_info.usuario_existente || 'Outro usuário'}</strong>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-slate-800">{prod.modelo_produto}</div>
                              <div className="text-[10px] font-mono text-slate-400">{prod.ean}</div>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-slate-700">
                              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                                {prod.numero_caixa}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {prod.regional || 'VIA VAREJO RJ'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                {prod.computador_id || 'PC-001'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 text-[11px]">
                              {prod.data_cadastro ? new Date(prod.data_cadastro).toLocaleTimeString('pt-BR') : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {isDuplicado ? (
                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-900 border border-red-300 px-2 py-0.5 rounded-md font-black text-[10px] uppercase">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                                  DUPLICADO NO SERVIDOR
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-black text-[10px] uppercase">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  db.excluirProduto(prod.id);
                                  if (onSyncConcluido) onSyncConcluido();
                                }}
                                className="p-1 rounded text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                                title="Remover este equipamento da fila local"
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
              </div>
            </div>
          )}
        </div>

        {/* Rodape com Acoes */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Total pendente neste dispositivo:{' '}
            <strong className="text-slate-900 font-mono">{pendentes.length}</strong>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Fechar
            </button>
            {pendentes.length > 0 && (
              <button
                onClick={handleEnviarOnline}
                disabled={loading}
                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                <span>Enviar para o Online Agora</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Alerta de Duplicidade no Servidor */}
      {duplicadosAlerta && (
        <ModalAlertaDuplicidadeServidor
          isOpen={!!duplicadosAlerta}
          duplicados={duplicadosAlerta}
          totalSincronizados={totalEnviadosAlerta}
          onClose={() => setDuplicadosAlerta(null)}
          onItensRemovidos={() => {
            if (onSyncConcluido) onSyncConcluido();
          }}
          onContinuarEnvio={() => {
            setDuplicadosAlerta(null);
            handleEnviarOnline();
          }}
        />
      )}
    </div>
  );
};
