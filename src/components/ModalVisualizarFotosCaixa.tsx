import React, { useState } from 'react';
import { db } from '../db/storage';
import { GrupoFotosInfo, FotoGrupoAuditoria } from '../types';
import {
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  Layers,
  Download,
  Calendar,
  Monitor,
  User,
} from 'lucide-react';

interface ModalVisualizarFotosCaixaProps {
  isOpen: boolean;
  onClose: () => void;
  caixa: string;
  regional?: string;
  onAbrirCapturaGrupo?: (grupo: GrupoFotosInfo) => void;
}

export const ModalVisualizarFotosCaixa: React.FC<ModalVisualizarFotosCaixaProps> = ({
  isOpen,
  onClose,
  caixa,
  regional,
  onAbrirCapturaGrupo,
}) => {
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoGrupoAuditoria | null>(null);

  if (!isOpen) return null;

  const grupos = db.obterGruposFotosCaixa(caixa, regional);
  const totalProdutos = grupos.reduce((acc, g) => acc + g.totalNoGrupo, 0);
  const totalFotos = grupos.filter((g) => g.temFoto).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Evidências Fotográficas da Caixa</h3>
                <span className="bg-blue-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full">
                  {caixa}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {regional || 'Regional Atual'} • {totalProdutos} produtos auditados • {totalFotos} de {grupos.length} grupos com foto
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

        {/* Resumo de Conformidade das Fotos */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-600">Total de Grupos (10 em 10):</span>
              <strong className="text-slate-900 font-mono">{grupos.length}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-600">Fotos Registradas:</span>
              <strong className={totalFotos === grupos.length && grupos.length > 0 ? 'text-emerald-600 font-mono font-black' : 'text-amber-600 font-mono font-black'}>
                {totalFotos} / {grupos.length}
              </strong>
            </div>
          </div>

          {totalFotos === grupos.length && grupos.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-black text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              100% DAS FOTOS OBRIGATÓRIAS ANEXADAS
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1 rounded-full font-black text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              {grupos.length - totalFotos} GRUPO(S) SEM FOTO (OBRIGATÓRIO PARA TROCA DE CAIXA)
            </span>
          )}
        </div>

        {/* Grade de Grupos e Fotos */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {grupos.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Camera className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Nenhum produto cadastrado nesta caixa ainda</p>
              <p className="text-xs text-slate-400">Bipe os produtos para gerar os grupos de fotos automaticamente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {grupos.map((grp) => (
                <div
                  key={grp.grupoNumero}
                  className={`rounded-2xl border transition-all overflow-hidden flex flex-col ${
                    grp.temFoto
                      ? 'border-slate-200 bg-white shadow-2xs hover:shadow-md'
                      : 'border-amber-300 bg-amber-50/40 shadow-xs'
                  }`}
                >
                  {/* Cabeçalho do Card do Grupo */}
                  <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-mono font-black text-xs flex items-center justify-center">
                        {grp.grupoNumero}
                      </span>
                      <div className="font-bold text-slate-900 text-xs">{grp.grupoRotulo}</div>
                    </div>
                    {grp.temFoto ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">
                        <CheckCircle2 className="w-3 h-3" />
                        Anexada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full uppercase">
                        <AlertTriangle className="w-3 h-3" />
                        Pendente
                      </span>
                    )}
                  </div>

                  {/* Foto ou Placeholder */}
                  <div className="p-3 flex-1 flex flex-col justify-center">
                    {grp.temFoto && grp.foto ? (
                      <div
                        onClick={() => setFotoAmpliada(grp.foto!)}
                        className="relative group rounded-xl overflow-hidden bg-slate-900 aspect-4/3 flex items-center justify-center cursor-pointer shadow-inner"
                      >
                        <img
                          src={grp.foto.fotoDataUri}
                          alt={grp.grupoRotulo}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 font-bold text-xs">
                          <ZoomIn className="w-4 h-4" />
                          <span>Clique para Ampliar</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-amber-300 bg-white/60 aspect-4/3 flex flex-col items-center justify-center p-4 text-center space-y-2">
                        <Camera className="w-8 h-8 text-amber-500" />
                        <span className="text-xs font-bold text-amber-900">
                          Foto pendente deste grupo
                        </span>
                        {onAbrirCapturaGrupo && (
                          <button
                            onClick={() => onAbrirCapturaGrupo(grp)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Tirar Foto Agora
                          </button>
                        )}
                      </div>
                    )}

                    {/* Metadados da Foto */}
                    {grp.temFoto && grp.foto && (
                      <div className="mt-2 text-[10px] text-slate-500 space-y-0.5 border-t border-slate-100 pt-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(grp.foto.dataCriacao).toLocaleString('pt-BR')}
                          </span>
                          <span className="flex items-center gap-1 font-mono font-bold text-slate-700">
                            <Monitor className="w-3 h-3" />
                            {grp.foto.computador_id}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Lista dos Seriais deste Grupo */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px]">
                      <span className="font-bold text-slate-600 block mb-1">
                        {grp.totalNoGrupo} aparelhos no grupo:
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {grp.seriais.map((sn) => (
                          <span
                            key={sn}
                            className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800"
                          >
                            {sn}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Ação de Substituição de Foto */}
                  {onAbrirCapturaGrupo && grp.temFoto && (
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                      <button
                        onClick={() => onAbrirCapturaGrupo(grp)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        Substituir Foto deste Grupo
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {caixa} • Grupo Solutions Auditoria & Qualidade Samsung
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Fechar Visualização
          </button>
        </div>
      </div>

      {/* Modal de Foto Ampliada (Full Resolution Zoom) */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 animate-fadeIn"
          onClick={() => setFotoAmpliada(null)}
        >
          <div className="relative max-w-5xl max-h-[85vh] w-full flex flex-col items-center">
            <button
              onClick={() => setFotoAmpliada(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={fotoAmpliada.fotoDataUri}
              alt={fotoAmpliada.grupoRotulo}
              className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-3 text-white text-center text-xs font-bold bg-black/60 px-4 py-2 rounded-xl backdrop-blur-xs flex items-center gap-4">
              <span>{fotoAmpliada.caixa} • {fotoAmpliada.grupoRotulo}</span>
              <span>{fotoAmpliada.regional}</span>
              <span>{new Date(fotoAmpliada.dataCriacao).toLocaleString('pt-BR')}</span>
              <a
                href={fotoAmpliada.fotoDataUri}
                download={`Foto_${fotoAmpliada.caixa}_${fotoAmpliada.grupoRotulo}.jpg`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded flex items-center gap-1 ml-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-3 h-3" />
                Baixar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
