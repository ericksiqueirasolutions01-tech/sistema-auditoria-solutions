import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { db, REGIONAIS_PADRAO, extrairCodigoRegional, normalizeDealer, normalizeImei, inferirFabricante } from '../../../db/storage';
import { isAdminOuSuper } from '../../../domain';
import type { MetricasValidacaoPlanilha } from '../../../types';

interface ModalImportarPlanilhaRegionalProps {
  regionalInicial?: string;
  onFechar: () => void;
  onSucesso: (resultado: { batchId: string; total: number; regional: string }) => void;
}

interface ItemTriagemPlanilha {
  imei: string;
  sku: string;
  model_description: string;
  brand?: string;
  origin_invoice?: string | null;
  dealer?: string | null;
  source_row: number;
}

export const ModalImportarPlanilhaRegional: React.FC<ModalImportarPlanilhaRegionalProps> = ({
  regionalInicial,
  onFechar,
  onSucesso,
}) => {
  const usuario = db.getUsuarioAtual();
  const isAdmin = isAdminOuSuper(usuario?.perfil);

  const [regional, setRegional] = useState<string>(() => {
    if (regionalInicial && regionalInicial !== 'CONSOLIDADO') return regionalInicial;
    return REGIONAIS_PADRAO[0];
  });

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Prévia após parsing
  const [itensExtraidos, setItensExtraidos] = useState<ItemTriagemPlanilha[]>([]);
  const [metricas, setMetricas] = useState<MetricasValidacaoPlanilha | null>(null);
  const [dealersDetectados, setDealersDetectados] = useState<string[]>([]);
  const [nomeAbaUtilizada, setNomeAbaUtilizada] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bloqueio estrito de acesso para não-administradores (RBAC)
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-100 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Acesso Negado (403)</h3>
          <p className="text-sm text-slate-600">
            Apenas Administradores têm permissão para importar planilhas e gerenciar listas de referência de inventário regional.
          </p>
          <button
            onClick={onFechar}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const processarArquivoPlanilha = async (file: File) => {
    setLendoArquivo(true);
    setErro(null);
    setItensExtraidos([]);
    setMetricas(null);
    setDealersDetectados([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('O arquivo enviado não contém nenhuma planilha legível.');
      }

      // Priorizar aba com nome 'IMEI' (ex: arquivo Inventário Samsung Camaçari para Solutions.xlsm)
      let sheetName = workbook.SheetNames.find((s) => s.trim().toUpperCase() === 'IMEI');
      if (!sheetName) {
        sheetName = workbook.SheetNames[0];
      }
      setNomeAbaUtilizada(sheetName);

      // Mapeamento SKU -> Marca a partir de qualquer aba de apoio (ex: 'sistema', 'marcas', 'produtos')
      const skuToBrandMap = new Map<string, string>();
      for (const sName of workbook.SheetNames) {
        if (sName.trim().toUpperCase() === sheetName.trim().toUpperCase()) continue;
        const sWorksheet = workbook.Sheets[sName];
        if (!sWorksheet) continue;
        const sData: any[][] = XLSX.utils.sheet_to_json(sWorksheet, { header: 1, defval: '' });
        if (sData.length < 2) continue;

        let sSkuCol = -1;
        let sMarcaCol = -1;
        for (let r = 0; r < Math.min(10, sData.length); r++) {
          const row = sData[r] || [];
          for (let c = 0; c < row.length; c++) {
            const val = String(row[c] || '').trim().toUpperCase();
            if (val === 'SKU' || val.includes('SKU') || val === 'CODIGO' || val === 'CÓDIGO') {
              sSkuCol = c;
            }
            if (val === 'MARCA' || val === 'FABRICANTE' || val.includes('MARCA') || val.includes('FABRICANTE')) {
              sMarcaCol = c;
            }
          }
          if (sSkuCol !== -1 && sMarcaCol !== -1) {
            for (let rowIdx = r + 1; rowIdx < sData.length; rowIdx++) {
              const dataRow = sData[rowIdx];
              if (!dataRow) continue;
              const sSku = String(dataRow[sSkuCol] || '').trim();
              const sMarca = String(dataRow[sMarcaCol] || '').trim().toUpperCase();
              if (sSku && sMarca) {
                skuToBrandMap.set(sSku, sMarca);
                skuToBrandMap.set(sSku.replace(/^0+/, ''), sMarca);
              }
            }
            break;
          }
        }
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (rawData.length <= 1) {
        throw new Error('A planilha está vazia ou contém apenas cabeçalho.');
      }

      // Detectar cabeçalho na linha 0 ou encontrar linha com 'IMEI'
      let headerRowIndex = 0;
      for (let r = 0; r < Math.min(10, rawData.length); r++) {
        const row = rawData[r] || [];
        const hasImei = row.some((cell: any) => String(cell).toUpperCase().includes('IMEI'));
        if (hasImei) {
          headerRowIndex = r;
          break;
        }
      }

      const headers = (rawData[headerRowIndex] || []).map((h: any) => String(h).trim().toUpperCase());

      // Mapeamento de Colunas por Nome ou Posição (Col C=2, Col D=3, Col E=4, Col H=7, Col J=9)
      // REGRA CRÍTICA: Col I (Data da NF) JAMAIS é mapeada ou lida!
      let idxImei = headers.findIndex((h) => h === 'IMEI' || h.startsWith('IMEI'));
      let idxSku = headers.findIndex((h) => h === 'SKU' || h === 'CÓDIGO' || h === 'CODIGO');
      let idxModelo = headers.findIndex((h) => h.includes('MODELO') || h.includes('DESCRIÇÃO') || h.includes('DESCRICAO'));
      let idxNfOrigem = headers.findIndex(
        (h) => (h.includes('NF') || h.includes('NFO') || h.includes('NOTA')) && h.includes('ORIGEM')
      );
      let idxDealer = headers.findIndex(
        (h) => h.includes('DEALER') || h.includes('VENDIDO PARA OUTRO') || h.includes('QUAL ?')
      );

      // Fallbacks posicionais caso os nomes não coincidam exatamente:
      if (idxImei === -1) idxImei = 2; // Coluna C
      if (idxSku === -1) idxSku = 3; // Coluna D
      if (idxModelo === -1) idxModelo = 4; // Coluna E
      if (idxNfOrigem === -1) idxNfOrigem = 7; // Coluna H
      if (idxDealer === -1) idxDealer = 9; // Coluna J

      const itensTriados: ItemTriagemPlanilha[] = [];
      const seenImeis = new Set<string>();
      const dealersSet = new Set<string>();

      let imeisValidos = 0;
      let imeisInvalidos = 0;
      let duplicadosPlanilha = 0;
      let linhasSkuVazio = 0;
      let linhasModeloVazio = 0;
      let linhasDealerVazio = 0;
      const exemplosInvalidos: { linha: number; imei: string; motivo: string }[] = [];

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) {
          continue; // Linha vazia
        }

        const rawImei = row[idxImei];
        const imeiNorm = normalizeImei(rawImei);
        const sourceRow = i + 1;

        if (!imeiNorm || !/^\d{15}$/.test(imeiNorm)) {
          imeisInvalidos++;
          if (exemplosInvalidos.length < 5) {
            exemplosInvalidos.push({
              linha: sourceRow,
              imei: String(rawImei || ''),
              motivo: 'IMEI não contém exatamente 15 dígitos numéricos.',
            });
          }
          continue;
        }

        if (seenImeis.has(imeiNorm)) {
          duplicadosPlanilha++;
          if (exemplosInvalidos.length < 5) {
            exemplosInvalidos.push({
              linha: sourceRow,
              imei: imeiNorm,
              motivo: 'IMEI duplicado nesta mesma planilha.',
            });
          }
          continue;
        }
        seenImeis.add(imeiNorm);

        const sku = String(row[idxSku] || '').trim();
        if (!sku) linhasSkuVazio++;

        const modelDesc = String(row[idxModelo] || '').trim();
        if (!modelDesc) linhasModeloVazio++;

        const rawDealer = row[idxDealer] !== undefined && row[idxDealer] !== null ? String(row[idxDealer]).trim() : '';
        if (!rawDealer) linhasDealerVazio++;
        const dealerNorm = normalizeDealer(rawDealer);
        dealersSet.add(dealerNorm);

        // Coluna H: Nota Fiscal Origem (preservar valor original, string limpa)
        // Coluna I: JAMAIS LIDA
        const rawNfOrigem = row[idxNfOrigem] !== undefined && row[idxNfOrigem] !== null ? String(row[idxNfOrigem]).trim() : null;

        const rawBrand = skuToBrandMap.get(sku) || skuToBrandMap.get(sku.replace(/^0+/, '')) || null;
        const brandResolvida = inferirFabricante(modelDesc, rawBrand);

        imeisValidos++;
        itensTriados.push({
          imei: imeiNorm,
          sku: sku || 'SEM SKU',
          model_description: modelDesc || 'MODELO NÃO ESPECIFICADO',
          brand: brandResolvida,
          origin_invoice: rawNfOrigem || null,
          dealer: dealerNorm,
          source_row: sourceRow,
        });
      }

      if (itensTriados.length === 0) {
        throw new Error('Nenhum IMEI válido com 15 dígitos foi encontrado na planilha analisada.');
      }

      setItensExtraidos(itensTriados);
      setDealersDetectados(Array.from(dealersSet));
      setMetricas({
        nomeArquivo: file.name,
        regional,
        totalLinhas: rawData.length - (headerRowIndex + 1),
        imeisValidos,
        imeisInvalidos,
        duplicadosPlanilha,
        linhasSkuVazio,
        linhasModeloVazio,
        linhasDealerVazio,
        exemplosInvalidos,
      });
    } catch (err: any) {
      console.error('Erro ao processar arquivo de planilha:', err);
      setErro(err.message || 'Erro ao ler arquivo da planilha.');
    } finally {
      setLendoArquivo(false);
    }
  };

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    processarArquivoPlanilha(file);
  };

  const handleConfirmarImportacao = async () => {
    if (!arquivo || itensExtraidos.length === 0 || !metricas) {
      setErro('Nenhum dado válido para importar.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const res = await db.importarListaReferenciaRegional({
        regional,
        fileName: arquivo.name,
        importedBy: usuario?.nome || usuario?.login || 'ADMINISTRADOR',
        itens: itensExtraidos,
      });

      onSucesso({
        batchId: res.batch.id,
        total: res.totalImportados,
        regional,
      });
      onFechar();
    } catch (err: any) {
      console.error('Erro ao salvar lote de importação:', err);
      setErro(err.message || 'Falha ao salvar e ativar lista de referência regional.');
    } finally {
      setSalvando(false);
    }
  };

  const codigoReg = extrairCodigoRegional(regional);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-500/30 text-blue-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Admin Master
                </span>
                <span className="text-xs text-slate-300">Inventário Regional</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                Importar Planilha de Referência IMEI
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

        {/* Corpo com Scroll */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Seletor de Regional */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Regional de Destino
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {REGIONAIS_PADRAO.map((reg) => {
                const isSelected = regional === reg;
                return (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => {
                      setRegional(reg);
                      if (arquivo) processarArquivoPlanilha(arquivo);
                    }}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-black uppercase transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-900 text-white border-blue-900 shadow-md scale-[1.02]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {reg.replace('VIA VAREJO ', '')}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Cada regional mantém sua própria lista ativa isolada. Ao ativar uma nova versão, a anterior é arquivada automaticamente.
            </p>
          </div>

          {/* Área de Upload de Arquivo */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Upload className="w-4 h-4 text-blue-600" />
              Arquivo (.xlsx / .xlsm / .csv)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv"
              onChange={handleSelecionarArquivo}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
                arquivo
                  ? 'border-blue-400 bg-blue-50/50 hover:bg-blue-50'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              {lendoArquivo ? (
                <div className="py-4 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <span className="text-sm font-bold text-slate-700">Lendo e validando planilha...</span>
                </div>
              ) : arquivo ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-slate-800 block">{arquivo.name}</span>
                    <span className="text-xs text-slate-500 block">
                      {(arquivo.size / 1024).toFixed(1)} KB • Aba: {nomeAbaUtilizada || 'Principal'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-blue-700 hover:underline pt-1">
                    Clique para trocar de arquivo
                  </span>
                </div>
              ) : (
                <div className="py-4 flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-700 block">
                      Clique para selecionar ou arraste o arquivo aqui
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Compatível com planilhas Samsung Camaçari (.xlsm/.xlsx) com abas de IMEI
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Erro na importação</span>
                <span>{erro}</span>
              </div>
            </div>
          )}

          {/* Prévia e Métricas de Validação */}
          {metricas && (
            <div className="space-y-4 pt-1 animate-fade-in">
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Validação da Planilha
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    {metricas.imeisValidos} Válidos
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Linhas</span>
                    <span className="text-lg font-black text-slate-800">{metricas.totalLinhas}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase block">IMEIs Válidos</span>
                    <span className="text-lg font-black text-emerald-600">{metricas.imeisValidos}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Inválidos / Desc.</span>
                    <span className="text-lg font-black text-slate-700">{metricas.imeisInvalidos}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Duplicados</span>
                    <span className="text-lg font-black text-slate-700">{metricas.duplicadosPlanilha}</span>
                  </div>
                </div>

                {/* Aviso sobre Coluna I estritamente omitida */}
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Conformidade Estrita:</strong> A coluna de Data da NF (Coluna I) foi estritamente ignorada conforme especificação. Os números da NF de Origem (Coluna H) foram preservados.
                  </span>
                </div>
              </div>

              {/* Lotes Dinâmicos Que Serão Gerados */}
              <div className="border border-indigo-100 bg-indigo-50/50 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Lotes Automáticos Gerados ({codigoReg})
                  </span>
                  <span className="text-[10px] text-indigo-700 font-bold">
                    {dealersDetectados.length + 2} lotes configurados
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {dealersDetectados.map((d) => (
                    <span
                      key={d}
                      className="bg-white border border-indigo-200 text-indigo-900 text-xs font-black uppercase px-2.5 py-1 rounded-xl shadow-2xs flex items-center gap-1"
                    >
                      <span>🏷️</span>
                      {codigoReg} - LISTA - {d}
                    </span>
                  ))}
                  <span className="bg-white/80 border border-slate-200 text-slate-700 text-xs font-bold uppercase px-2.5 py-1 rounded-xl">
                    {codigoReg} - FORA DA LISTA - SAMSUNG
                  </span>
                  <span className="bg-white/80 border border-slate-200 text-slate-700 text-xs font-bold uppercase px-2.5 py-1 rounded-xl">
                    {codigoReg} - FORA DA LISTA - OUTRA MARCA
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Botões */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold uppercase hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmarImportacao}
            disabled={!arquivo || itensExtraidos.length === 0 || salvando || lendoArquivo}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase shadow-md flex items-center gap-2 transition-all cursor-pointer ${
              !arquivo || itensExtraidos.length === 0 || salvando || lendoArquivo
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.02]'
            }`}
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando Versão...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar e Ativar Lista
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

