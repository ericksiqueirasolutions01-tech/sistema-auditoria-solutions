import React from 'react';
import { ProdutoAuditoria } from '../types';
import { X, Smartphone, Building2, MapPin, Layers, Boxes, Lock, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ModalDetalhesProdutoProps {
  produto: ProdutoAuditoria | null;
  onFechar: () => void;
}

export const ModalDetalhesProduto: React.FC<ModalDetalhesProdutoProps> = ({ produto, onFechar }) => {
  const [copiado, setCopiado] = useState(false);

  if (!produto) return null;

  const imei = produto.imei || produto.serial;

  const copiarImei = () => {
    if (!imei) return;
    navigator.clipboard.writeText(imei);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 block">
                Detalhes da Auditoria
              </span>
              <h2 className="text-base sm:text-lg font-black text-white truncate max-w-[280px]">
                {produto.modelo_produto}
              </h2>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Card IMEI */}
          <div className="bg-blue-50/80 border-2 border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">IMEI do Produto (15 Dígitos)</span>
              <span className="text-xl font-black font-mono text-blue-950 tracking-wider block mt-0.5">{imei}</span>
            </div>
            <button
              onClick={copiarImei}
              className="bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          {/* Grid de Informações */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Modelo</span>
              <span className="font-black text-slate-900 block mt-0.5">{produto.modelo_produto}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">SKU / EAN</span>
              <span className="font-mono font-black text-slate-900 block mt-0.5">{produto.sku || produto.ean || '-'}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">NF Origem Samsung</span>
              <span className="font-black text-blue-900 block mt-0.5">
                {produto.nf_origem_samsung || produto.origin_invoice || produto.numero_nf || 'Não localizada'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Regional de Origem (Planilha)</span>
              <span className="font-black text-amber-700 uppercase block mt-0.5">
                {produto.regional_produto || produto.regional}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Regional da Estação</span>
              <span className="font-black text-slate-900 uppercase block mt-0.5">
                {produto.regional_usuario || produto.regional}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Caixa e Lote</span>
              <span className="font-black text-slate-900 block mt-0.5">
                {produto.numero_caixa} • {produto.numero_lote || 'LOTE 01'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Lacre de Segurança</span>
              <span className="font-mono font-black text-slate-900 block mt-0.5">
                {produto.lacre_seguranca || 'Não informado'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Condição / Lacre</span>
              <span className={`font-black block mt-0.5 ${produto.produto_lacrado === 'SIM' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {produto.produto_lacrado === 'SIM' ? '🔒 Lacrado (SIM)' : '🔓 Aberto (NÃO)'}
              </span>
            </div>
          </div>

          {/* Classificação e Status */}
          <div className="bg-slate-100 rounded-2xl p-3.5 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Classificação</span>
              <span className="bg-blue-600 text-white font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full">
                {produto.classificacao_produto || 'PADRÃO'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Sincronização Online</span>
              <span className={`font-black text-[10px] uppercase px-2 py-0.5 rounded-full ${
                produto.status_sincronizacao === 'ENVIADO'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {produto.status_sincronizacao || 'PENDENTE'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200">
              <span>Auditor: <strong className="text-slate-900">{produto.usuario_cadastro}</strong></span>
              <span>Data: <strong className="text-slate-900">{produto.data_auditoria}</strong></span>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end">
          <button
            onClick={onFechar}
            className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
