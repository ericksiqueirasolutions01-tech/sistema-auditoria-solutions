import React, { useState } from 'react';
import { db } from '../db/storage';
import { ComputadorInfo } from '../types';
import { Monitor, X, Check, Laptop, Plus, Calendar, ShieldCheck, RefreshCw } from 'lucide-react';

interface ModalIdentificacaoComputadorProps {
  onClose: () => void;
  onSalvar: (comp: ComputadorInfo) => void;
}

export const ModalIdentificacaoComputador: React.FC<ModalIdentificacaoComputadorProps> = ({
  onClose,
  onSalvar,
}) => {
  const usuario = db.getUsuarioAtual();
  const regionalAtiva = usuario?.regional || 'VIA VAREJO RJ';
  const computadorAtual = db.obterComputadorAtual(regionalAtiva);

  const [idInput, setIdInput] = useState(computadorAtual.id);
  const [nomeInput, setNomeInput] = useState(computadorAtual.nome);
  const computadoresConhecidos = db.listarComputadoresCadastrados(regionalAtiva);

  const statusSync = db.obterStatusSincronizacao();
  const produtosDestePC = db.listarProdutos({ regional: regionalAtiva }).filter(
    (p) => p.computador_id === computadorAtual.id
  );

  const handleSalvar = () => {
    if (!idInput.trim()) {
      alert('Informe a identificação do computador (Ex: PC-RJ-001).');
      return;
    }
    const atualizado: ComputadorInfo = {
      id: idInput.trim().toUpperCase(),
      nome: nomeInput.trim() || `Estação ${idInput.trim().toUpperCase()}`,
      regional: regionalAtiva,
      data_primeiro_uso: computadorAtual.data_primeiro_uso || new Date().toISOString(),
    };
    db.definirComputadorAtual(atualizado);
    onSalvar(atualizado);
    onClose();
  };

  const selecionarComputadorExistente = (c: ComputadorInfo) => {
    setIdInput(c.id);
    setNomeInput(c.nome);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                Identificação do Computador
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {regionalAtiva} • Controle Multi-Máquinas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card do Computador Ativo Atual */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
              Máquina Ativa Nesta Sessão
            </span>
            <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-full">
              ID Único Local
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-black tracking-tight text-white uppercase">
                💻 {computadorAtual.id}
              </div>
              <div className="text-xs text-slate-300 font-semibold">{computadorAtual.nome}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-amber-300">{produtosDestePC.length}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Auditados neste PC</div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-slate-300">
            <span>
              1º Uso: {new Date(computadorAtual.data_primeiro_uso).toLocaleDateString('pt-BR')}
            </span>
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <ShieldCheck className="w-3 h-3" /> Offline-First Ativo
            </span>
          </div>
        </div>

        {/* Formulário de Identificação */}
        <div className="space-y-3">
          <label className="block text-xs font-black uppercase text-slate-700 tracking-wide">
            Configurar / Alternar Estação de Trabalho:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                ID do Computador
              </label>
              <input
                type="text"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value.toUpperCase())}
                placeholder="Ex: PC-RJ-001"
                className="w-full text-xs font-black text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 uppercase focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                Nome da Estação
              </label>
              <input
                type="text"
                value={nomeInput}
                onChange={(e) => setNomeInput(e.target.value)}
                placeholder="Ex: Bancada 01"
                className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Atalhos Rápidos para Máquinas Conhecidas */}
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
            Alternar Rápido (Simular ou Selecionar Estação da Regional):
          </span>
          <div className="flex flex-wrap gap-2">
            {computadoresConhecidos.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selecionarComputadorExistente(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                  idInput === c.id
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                {c.id}
              </button>
            ))}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Salvar Identificação
          </button>
        </div>
      </div>
    </div>
  );
};

