import React from 'react';
import { Camera, Folder, FolderOpen, Boxes, ZoomIn, Clock } from 'lucide-react';
import { FotoGrupoAuditoria } from '../../../types';

export interface CaixaArvoreItem {
  caixa: string;
  totalProdutos: number;
  fotos: FotoGrupoAuditoria[];
}

export interface RegionalArvoreItem {
  regional: string;
  caixas: CaixaArvoreItem[];
}

export interface AbaGaleriaFotosProps {
  totalFotosGerais: number;
  arvoreFotos: RegionalArvoreItem[];
  pastaRegionalAberta: Record<string, boolean>;
  setPastaRegionalAberta: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  pastaCaixaAberta: Record<string, boolean>;
  setPastaCaixaAberta: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setFotoAmpliada: (foto: FotoGrupoAuditoria) => void;
  formatarDataHora: (iso: string) => string;
}

export const AbaGaleriaFotos: React.FC<AbaGaleriaFotosProps> = ({
  totalFotosGerais,
  arvoreFotos,
  pastaRegionalAberta,
  setPastaRegionalAberta,
  pastaCaixaAberta,
  setPastaCaixaAberta,
  setFotoAmpliada,
  formatarDataHora,
}) => {
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            Consulta de Evidências Fotográficas dos Produtos
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Organização em pastas: <strong>Regional → Caixa → Fotos de 10 em 10 produtos</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-black bg-blue-50 text-blue-900 px-3.5 py-2 rounded-xl border border-blue-200">
          <Camera className="w-4 h-4 text-blue-600" />
          <span>Total na Central:</span>
          <strong className="text-sm">{totalFotosGerais} fotos</strong>
        </div>
      </div>

      <div className="space-y-4">
        {arvoreFotos.map((regItem) => {
          const regAberta = pastaRegionalAberta[regItem.regional] ?? true;
          const totalFotosReg = regItem.caixas.reduce((acc, c) => acc + c.fotos.length, 0);

          return (
            <div key={regItem.regional} className="border-2 border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              {/* Pasta Regional */}
              <div
                onClick={() =>
                  setPastaRegionalAberta((prev) => ({
                    ...prev,
                    [regItem.regional]: !regAberta,
                  }))
                }
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  {regAberta ? (
                    <FolderOpen className="w-5 h-5 text-amber-400 shrink-0" />
                  ) : (
                    <Folder className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <span className="text-sm font-black uppercase tracking-wide">
                      📁 {regItem.regional}
                    </span>
                    <span className="text-xs text-slate-400 block font-normal">
                      {regItem.caixas.length} caixa(s) registrada(s) • {totalFotosReg} foto(s) anexada(s)
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black bg-blue-600/50 border border-blue-400/40 text-blue-200 px-2.5 py-1 rounded-lg">
                  {totalFotosReg} fotos
                </span>
              </div>

              {regAberta && (
                <div className="p-4 bg-slate-50 space-y-4">
                  {regItem.caixas.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2 pl-2">
                      Nenhuma caixa com produtos nesta regional.
                    </p>
                  ) : (
                    regItem.caixas.map((cxItem) => {
                      const chaveCx = `${regItem.regional}:::${cxItem.caixa}`;
                      const cxAberta = pastaCaixaAberta[chaveCx] ?? true;

                      return (
                        <div
                          key={cxItem.caixa}
                          className="border border-slate-300 rounded-xl bg-white overflow-hidden shadow-xs"
                        >
                          {/* Subpasta Caixa */}
                          <div
                            onClick={() =>
                              setPastaCaixaAberta((prev) => ({
                                ...prev,
                                [chaveCx]: !cxAberta,
                              }))
                            }
                            className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 flex items-center justify-between cursor-pointer border-b border-slate-200"
                          >
                            <div className="flex items-center gap-2">
                              <Boxes className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="text-xs font-black uppercase text-slate-800">
                                📁 {cxItem.caixa}
                              </span>
                              <span className="text-[11px] text-slate-500 font-bold">
                                ({cxItem.totalProdutos} aparelhos auditados)
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                cxItem.fotos.length > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {cxItem.fotos.length} foto(s) anexada(s)
                            </span>
                          </div>

                          {cxAberta && (
                            <div className="p-3">
                              {cxItem.fotos.length === 0 ? (
                                <p className="text-xs text-amber-700 italic py-1 pl-2">
                                  Nenhuma evidência fotográfica registrada para esta caixa.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {cxItem.fotos.map((foto) => (
                                    <div
                                      key={foto.id}
                                      className="border-2 border-slate-200 hover:border-blue-500 rounded-xl overflow-hidden bg-slate-50 transition-all group"
                                    >
                                      {/* Imagem Thumbnail */}
                                      <div
                                        onClick={() => setFotoAmpliada(foto)}
                                        className="relative aspect-video bg-black flex items-center justify-center cursor-pointer overflow-hidden"
                                      >
                                        <img
                                          src={foto.fotoDataUri}
                                          alt={foto.grupoRotulo}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <span className="bg-white text-slate-900 font-black text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md">
                                            <ZoomIn className="w-3.5 h-3.5" /> Ampliar Foto
                                          </span>
                                        </div>
                                        <span className="absolute bottom-1 right-1 bg-black/75 text-white font-mono text-[9px] px-1.5 py-0.5 rounded font-bold">
                                          {foto.totalNoGrupo} prods
                                        </span>
                                      </div>

                                      {/* Detalhes da Foto */}
                                      <div className="p-2.5 space-y-1 text-xs">
                                        <div className="font-black text-slate-900 uppercase truncate">
                                          📷 {foto.grupoRotulo}
                                        </div>
                                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                                          <span>Qtd Registrada:</span>
                                          <strong className="text-slate-800">
                                            {foto.totalNoGrupo} aparelhos
                                          </strong>
                                        </div>
                                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-slate-400" />
                                          {formatarDataHora(foto.dataCriacao)}
                                        </div>
                                        <div className="text-[10px] text-indigo-700 font-bold truncate">
                                          {foto.computador_id || 'PC-001'} • {foto.usuario || 'Operador'}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
