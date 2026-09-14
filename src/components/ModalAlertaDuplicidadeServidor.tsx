import React, { useState, useEffect } from 'react';
import { db } from '../db/storage';
import { DetalheImeiDuplicado } from '../types';
import { sounds } from '../utils/audio';
import {
  ShieldAlert,
  X,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Calendar,
  User,
  Monitor,
  CheckSquare,
  Square,
  Smartphone,
} from 'lucide-react';

interface ModalAlertaDuplicidadeServidorProps {
  isOpen: boolean;
  duplicados: DetalheImeiDuplicado[];
  totalSincronizados?: number;
  onClose: () => void;
  onItensRemovidos?: () => void;
  onContinuarEnvio?: () => void;
}

export const ModalAlertaDuplicidadeServidor: React.FC<ModalAlertaDuplicidadeServidorProps> = ({
  isOpen,
  duplicados,
  totalSincronizados = 0,
  onClose,
  onItensRemovidos,
  onContinuarEnvio,
}) => {
  const [listaDuplicados, setListaDuplicados] = useState<DetalheImeiDuplicado[]>(duplicados);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [mensagemSucessoRemocao, setMensagemSucessoRemocao] = useState<string | null>(null);

  useEffect(() => {
    setListaDuplicados(duplicados);
    // Por padrão, já deixa todos os duplicados selecionados para facilitar a exclusão
    const todosSeriais = new Set(duplicados.map((d) => (d.serial || d.imei).trim().toUpperCase()));
    setSelecionados(todosSeriais);
    setMensagemSucessoRemocao(null);

    if (isOpen && duplicados.length > 0) {
      try {
        sounds.playError();
      } catch {}
    }
  }, [isOpen, duplicados]);

  if (!isOpen || listaDuplicados.length === 0) return null;

  const toggleSelecionar = (serial: string) => {
    const norm = serial.trim().toUpperCase();
    const novo = new Set(selecionados);
    if (novo.has(norm)) {
      novo.delete(norm);
    } else {
      novo.add(norm);
    }
    setSelecionados(novo);
  };

  const selecionarTodos = () => {
    if (selecionados.size === listaDuplicados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(listaDuplicados.map((d) => (d.serial || d.imei).trim().toUpperCase())));
    }
  };

  const handleExcluirSelecionados = () => {
    if (selecionados.size === 0) return;

    const seriaisParaRemover = Array.from(selecionados);
    const res = db.removerItensDuplicadosFila(seriaisParaRemover);

    const restante = listaDuplicados.filter(
      (d) => !selecionados.has((d.serial || d.imei).trim().toUpperCase())
    );
    setListaDuplicados(restante);
    setSelecionados(new Set(restante.map((d) => (d.serial || d.imei).trim().toUpperCase())));

    setMensagemSucessoRemocao(
      `${res.removidos} IMEI(s) duplicado(s) removido(s) com sucesso da fila local deste dispositivo.`
    );

    if (onItensRemovidos) {
      onItensRemovidos();
    }
  };

  const handleRemoverUnitario = (serial: string) => {
    const norm = serial.trim().toUpperCase();
    db.removerItensDuplicadosFila([norm]);
    const restante = listaDuplicados.filter(
      (d) => (d.serial || d.imei).trim().toUpperCase() !== norm
    );
    setListaDuplicados(restante);
    const novoSel = new Set(selecionados);
    novoSel.delete(norm);
    setSelecionados(novoSel);

    setMensagemSucessoRemocao(`IMEI ${norm} removido da fila local.`);
    if (onItensRemovidos) {
      onItensRemovidos();
    }
  };

  const pendentesRestantes = db.listarProdutosPendentes().length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div
        className="bg-white rounded-3xl shadow-2xl border-2 border-red-500 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO ALERTA CRÍTICO */}
        <div className="bg-gradient-to-r from-red-600 via-rose-700 to-red-800 text-white px-6 py-5 shrink-0 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 text-white shadow-inner">
                <ShieldAlert className="w-7 h-7 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 bg-white/20 text-white border border-white/30 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                  Bloqueio de Duplicidade no Servidor Online
                </div>
                <h2 className="text-base sm:text-xl font-black uppercase tracking-tight leading-tight">
                  IMEI NÃO FOI ENVIADO, POIS JÁ SE ENCONTRA CADASTRADO NA BASE DO SERVIDOR.
                </h2>
                <p className="text-xs sm:text-sm text-red-100 font-medium">
                  Este equipamento já foi enviado anteriormente por outro usuário ou equipamento. Remova este IMEI da fila de envio antes de continuar.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FEEDBACK DE ITENS VÁLIDOS ENVIADOS */}
        {totalSincronizados > 0 && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 text-xs font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              ✓ <strong>{totalSincronizados}</strong> outro(s) registro(s) válido(s) deste lote foram enviados com sucesso para o servidor online!
            </span>
          </div>
        )}

        {/* FEEDBACK DE EXCLUSÃO REALIZADA */}
        {mensagemSucessoRemocao && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 text-xs font-bold text-blue-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{mensagemSucessoRemocao}</span>
          </div>
        )}

        {/* CORPO: LISTAGEM DETALHADA DOS IMEIS DUPLICADOS */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="text-xs font-black text-slate-700 uppercase">
                Equipamentos Bloqueados ({listaDuplicados.length})
              </span>
              <p className="text-[11px] text-slate-500">
                Selecione os IMEIs abaixo e clique em remover para limpá-los da fila local:
              </p>
            </div>

            <button
              onClick={selecionarTodos}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
            >
              {selecionados.size === listaDuplicados.length ? (
                <>
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  <span>Desmarcar Todos</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-500" />
                  <span>Selecionar Todos ({listaDuplicados.length})</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {listaDuplicados.map((item, idx) => {
              const serialNorm = (item.serial || item.imei).trim().toUpperCase();
              const isChecked = selecionados.has(serialNorm);

              return (
                <div
                  key={`${serialNorm}-${idx}`}
                  onClick={() => toggleSelecionar(serialNorm)}
                  className={`border-2 rounded-2xl p-4 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isChecked
                      ? 'bg-rose-50/70 border-rose-400 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-500">IMEI / Serial:</span>
                        <span className="font-mono text-base font-black text-rose-700 bg-rose-100/80 px-2.5 py-0.5 rounded-md border border-rose-300">
                          {serialNorm}
                        </span>
                        <span className="bg-red-600 text-white font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full tracking-wide shadow-2xs">
                          STATUS: {item.status || 'DUPLICADO NO SERVIDOR'}
                        </span>
                      </div>

                      {item.modelo_produto && (
                        <div className="flex items-center gap-2 text-xs text-slate-700 font-bold">
                          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.modelo_produto}</span>
                          {item.numero_caixa && (
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded border font-mono text-slate-600">
                              Caixa Local: {item.numero_caixa}
                            </span>
                          )}
                        </div>
                      )}

                      {/* DETALHAMENTO DO CADASTRO ANTERIOR NO SERVIDOR */}
                      <div className="bg-white/80 border border-slate-200 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-600 mt-1 shadow-2xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>
                            <strong>Data Cadastro:</strong>{' '}
                            {item.data_cadastro_existente || 'Disponível no servidor'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>
                            <strong>Responsável Anterior:</strong>{' '}
                            {item.usuario_existente || 'Outro Colaborador'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:col-span-2 md:col-span-1">
                          <Monitor className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span>
                            <strong>Estação:</strong>{' '}
                            {item.computador_existente || item.regional_existente || 'Servidor Central'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoverUnitario(serialNorm);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-100 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Excluir este IMEI da fila local"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remover</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RODAPÉ COM AÇÕES DO COLABORADOR */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            {selecionados.size > 0 ? (
              <span>
                <strong>{selecionados.size}</strong> de {listaDuplicados.length} selecionado(s) para remoção.
              </span>
            ) : (
              <span>Nenhum item selecionado.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Fechar
            </button>

            {selecionados.size > 0 && (
              <button
                type="button"
                onClick={handleExcluirSelecionados}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Selecionados da Fila ({selecionados.size})</span>
              </button>
            )}

            {pendentesRestantes > 0 && onContinuarEnvio && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onContinuarEnvio();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Continuar Enviando Válidos ({pendentesRestantes})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

