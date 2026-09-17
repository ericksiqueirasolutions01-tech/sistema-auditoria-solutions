import React, { useEffect } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../../db/storage';

export interface ModalImportacaoRapidaProps {
  isOpen: boolean;
  onClose: () => void;
  modeloAtivo: string;
  eanAtivo: string;
  caixaAtiva: string;
  filtroCaixa: string;
  getDataAtualFormatada: () => string;
  recarregarDados: (filtro: string) => void;
}

export const ModalImportacaoRapida: React.FC<ModalImportacaoRapidaProps> = ({
  isOpen,
  onClose,
  modeloAtivo,
  eanAtivo,
  caixaAtiva,
  filtroCaixa,
  getDataAtualFormatada,
  recarregarDados,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-importar-planilha"
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 id="titulo-importar-planilha" className="text-base font-black text-slate-800 uppercase flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            Importar Planilha de Auditoria
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de importação de planilha"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Selecione um arquivo Excel (.xlsx, .xls ou .csv) contendo as colunas: <strong>Modelo</strong>,{' '}
          <strong>EAN</strong>, <strong>IMEI</strong>, <strong>Caixa</strong> e <strong>Data</strong>.
        </p>

        <div className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-2xl p-8 text-center bg-slate-50 transition-colors">
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <label className="inline-flex items-center justify-center min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl cursor-pointer shadow-xs transition-transform active:scale-95">
            Selecionar Planilha Excel
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              aria-label="Upload de arquivo de planilha Excel"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const bstr = evt.target?.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const raw = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws);
                    const normalizado = raw.map((r) => ({
                      modelo: String(r['Modelo'] || r['modelo'] || modeloAtivo),
                      ean: String(r['EAN'] || r['ean'] || eanAtivo),
                      serial: String(r['IMEI'] || r['imei'] || r['Serial'] || r['serial'] || ''),
                      caixa: String(r['Caixa'] || r['caixa'] || caixaAtiva),
                      data: String(r['Data'] || r['data'] || getDataAtualFormatada()),
                      lacrado: String(r['Lacrado'] || r['lacrado'] || 'SIM'),
                    }));
                    const res = db.importarPlanilha(normalizado);
                    alert(
                      `Importação concluída!\nProcessados: ${res.totalProcessado}\nGravados: ${res.sucessoCount}\nDuplicados: ${res.duplicadosCount}`
                    );
                    recarregarDados(filtroCaixa);
                    onClose();
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    alert('Erro ao importar planilha: ' + message);
                  }
                };
                reader.readAsBinaryString(file);
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
