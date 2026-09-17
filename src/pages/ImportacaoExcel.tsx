import React, { useState } from 'react';
import { db } from '../db/storage';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Check,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const ImportacaoExcel: React.FC = () => {
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<{
    totalProcessado: number;
    sucessoCount: number;
    duplicadosCount: number;
    errosCount: number;
    detalhes: string[];
  } | null>(null);

  const baixarModeloExemplo = () => {
    const modelo = [
      {
        Modelo: 'Galaxy A55 5G',
        EAN: '7892509134125',
        IMEI: '357847400282342',
        Caixa: 'CAIXA 01',
        Data: new Date().toISOString().split('T')[0],
        Lacrado: 'SIM',
      },
      {
        Modelo: 'Galaxy S24 Ultra',
        EAN: '7892509133456',
        IMEI: '357847400282343',
        Caixa: 'CAIXA 01',
        Data: new Date().toISOString().split('T')[0],
        Lacrado: 'SIM',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(modelo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Importacao');
    XLSX.writeFile(wb, 'Modelo_Auditoria_Samsung.xlsx');
  };

  const handleArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setCarregando(true);
    setResultado(null);

    const leitor = new FileReader();
    leitor.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws);

        const normalizado = rawData.map((row) => {
          // Normalize column names
          const modelo = String(row['Modelo'] || row['modelo'] || row['MODELO'] || '');
          const ean = String(row['EAN'] || row['ean'] || row['Ean'] || '');
          const serial = String(row['IMEI'] || row['imei'] || row['Serial'] || row['serial'] || row['SERIAL'] || row['Número de Série'] || '');
          const caixa = String(row['Caixa'] || row['caixa'] || row['CAIXA'] || row['Numero_Caixa'] || '');
          const data = String(row['Data'] || row['data'] || row['DATA'] || '');
          const lacrado = String(row['Lacrado'] || row['lacrado'] || row['LACRADO'] || 'SIM');
          const numero_nf = String(row['NF'] || row['nf'] || row['Nota Fiscal'] || row['Nota_Fiscal'] || row['numero_nf'] || '');
          const nfConferidaRaw = row['NF Conferida'] || row['nf_conferida'] || row['NF_Conferida'] || row['Conferida'];
          let nf_conferida: 'SIM' | 'NÃO' | null = null;
          if (nfConferidaRaw) {
            const val = String(nfConferidaRaw).trim().toUpperCase();
            if (val === 'SIM' || val === 'S') nf_conferida = 'SIM';
            else if (val === 'NÃO' || val === 'NAO' || val === 'N') nf_conferida = 'NÃO';
          }

          return { modelo, ean, serial, caixa, data, lacrado, numero_nf, nf_conferida };
        });

        const res = db.importarPlanilha(normalizado);
        setResultado(res);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Erro ao ler arquivo: ${message}`);
      } finally {
        setCarregando(false);
      }
    };

    leitor.readAsBinaryString(arquivo);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
              Importação de Planilha Excel
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Importe lotes de produtos com validação automática de duplicidade
            </p>
          </div>

          <button
            onClick={baixarModeloExemplo}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-300 flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar Planilha Modelo
          </button>
        </div>

        {/* Upload Box */}
        <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-10 text-center transition-colors bg-slate-50">
          <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-black text-slate-800 uppercase mb-1">
            Selecione ou Arraste o Arquivo Excel (.xlsx, .xls ou .csv)
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 font-medium">
            A planilha deve conter as colunas: <strong>Modelo</strong>, <strong>EAN</strong>,{' '}
            <strong>IMEI</strong>, <strong>Caixa</strong> e <strong>Data</strong>.
          </p>

          <label className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl cursor-pointer shadow-sm transition-transform active:scale-95">
            {carregando ? 'Processando Arquivo...' : 'Selecionar Arquivo'}
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleArquivo}
              disabled={carregando}
              className="hidden"
            />
          </label>
        </div>

        {/* Import Results Summary */}
        {resultado && (
          <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in">
            <h4 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Resultado do Processamento
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">Total Lidas</span>
                <span className="text-xl font-black text-slate-800">{resultado.totalProcessado}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-600 uppercase block">Importados</span>
                <span className="text-xl font-black text-emerald-600">{resultado.sucessoCount}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-rose-200">
                <span className="text-[11px] font-bold text-rose-600 uppercase block">Duplicados</span>
                <span className="text-xl font-black text-rose-600">{resultado.duplicadosCount}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-amber-200">
                <span className="text-[11px] font-bold text-amber-600 uppercase block">Erros/Inválidos</span>
                <span className="text-xl font-black text-amber-600">{resultado.errosCount}</span>
              </div>
            </div>

            {resultado.detalhes.length > 0 && (
              <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200 max-h-48 overflow-y-auto text-xs font-mono">
                <span className="font-bold text-slate-700 block mb-1">Ocorrências:</span>
                {resultado.detalhes.map((det, idx) => (
                  <div key={idx} className="text-slate-600 py-0.5 border-b border-slate-100 last:border-0">
                    {det}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

