import React, { useState, useRef, useEffect } from 'react';
import { db, SAMSUNG_MODELOS_PRESET } from '../db/storage';
import { ProdutoAuditoria, SimNao } from '../types';
import { sounds } from '../utils/audio';
import { SamsungLogo } from '../components/SamsungLogo';
import {
  Barcode,
  Box,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldAlert,
  HelpCircle,
  Hash,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';

export const BipagemRapida: React.FC = () => {
  // Form Header State (Sticky Box Context)
  const [caixa, setCaixa] = useState('CAIXA 01');
  const [modelo, setModelo] = useState(SAMSUNG_MODELOS_PRESET[0].modelo);
  const [ean, setEan] = useState(SAMSUNG_MODELOS_PRESET[0].ean);
  const [dataAuditoria, setDataAuditoria] = useState(
    () => new Date().toISOString().split('T')[0]
  );

  // Serial input & focus
  const [serial, setSerial] = useState('');
  const [produtoLacrado, setProdutoLacrado] = useState<SimNao>('SIM');
  const [kitCompleto, setKitCompleto] = useState<SimNao | ''>('');
  const [marcasUso, setMarcasUso] = useState<SimNao | ''>('');
  const [observacao, setObservacao] = useState('');

  // Status & Feedback alerts
  const [alertaDuplicado, setAlertaDuplicado] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  // Counters
  const [contadores, setContadores] = useState(() => db.obterContadoresCaixa('CAIXA 01'));

  // Live stream of recent items in this session
  const [ultimosAuditados, setUltimosAuditados] = useState<ProdutoAuditoria[]>(() =>
    db.listarProdutos({ caixa: 'CAIXA 01' }).slice(0, 8)
  );

  const serialInputRef = useRef<HTMLInputElement>(null);

  // Auto focus serial on mount and keep it focused
  useEffect(() => {
    serialInputRef.current?.focus();
  }, []);

  // Update counters whenever caixa changes
  useEffect(() => {
    atualizarContadoresECaixa(caixa);
  }, [caixa]);

  const atualizarContadoresECaixa = (nomeCaixa: string) => {
    const c = db.obterContadoresCaixa(nomeCaixa);
    setContadores(c);
    setUltimosAuditados(db.listarProdutos({ caixa: nomeCaixa }).slice(0, 8));
  };

  // When model changes, auto-suggest official EAN
  const handleModeloChange = (novoModelo: string) => {
    setModelo(novoModelo);
    const encontrado = SAMSUNG_MODELOS_PRESET.find((m) => m.modelo === novoModelo);
    if (encontrado) {
      setEan(encontrado.ean);
    }
  };

  // Main Bipagem Trigger
  const processarBipagem = () => {
    const serialLimpo = serial.trim().toUpperCase();

    // Reset previous messages
    setAlertaDuplicado(null);
    setErroValidacao(null);
    setMensagemSucesso(null);

    if (!serialLimpo) {
      setErroValidacao('Por favor, bipe ou digite o número de série.');
      sounds.playError();
      serialInputRef.current?.focus();
      return;
    }

    // 1. DUPLICATE SERIAL CHECK
    const validacao = db.validarDuplicidade(serialLimpo);
    if (validacao.duplicado && validacao.produto) {
      sounds.playError();
      setAlertaDuplicado(
        `Este número de série já foi auditado!\nCaixa: ${validacao.produto.numero_caixa} | Data: ${validacao.produto.data_auditoria} | Auditor: ${validacao.produto.usuario_cadastro}`
      );
      // Keep serial in input for operator verification and select it
      serialInputRef.current?.select();
      return;
    }

    // 2. UNSEALED MANDATORY FIELDS CHECK
    if (produtoLacrado === 'NÃO') {
      if (!kitCompleto) {
        sounds.playError();
        setErroValidacao('Atenção: Para produtos NÃO lacrados, é OBRIGATÓRIO informar se o Kit está Completo.');
        return;
      }
      if (!marcasUso) {
        sounds.playError();
        setErroValidacao('Atenção: Para produtos NÃO lacrados, é OBRIGATÓRIO informar se há Marcas de Uso.');
        return;
      }
    }

    // 3. EXECUTE INSERT
    const res = db.inserirProduto({
      modelo_produto: modelo,
      ean,
      serial: serialLimpo,
      data_auditoria: dataAuditoria,
      numero_caixa: caixa,
      produto_lacrado: produtoLacrado,
      kit_completo: produtoLacrado === 'SIM' ? 'SIM' : (kitCompleto as SimNao),
      aparelho_marcas_uso: produtoLacrado === 'SIM' ? 'NÃO' : (marcasUso as SimNao),
      observacao,
    });

    if (res.sucesso && res.produto) {
      // Audio confirmation
      sounds.playSuccess();

      // Visual flash
      setMensagemSucesso(`Serial ${res.produto.serial} registrado com sucesso!`);
      setTimeout(() => setMensagemSucesso(null), 2500);

      // Reset serial and non-sealed form
      setSerial('');
      if (produtoLacrado === 'NÃO') {
        // Reset analysis fields for next unsealed or leave ready
        setKitCompleto('');
        setMarcasUso('');
        setObservacao('');
      }

      // Update counters & recent feed
      atualizarContadoresECaixa(caixa);

      // Return focus automatically for continuous scanning
      serialInputRef.current?.focus();
    } else {
      sounds.playError();
      setErroValidacao(res.erro || 'Falha ao gravar produto.');
    }
  };

  // Enter key handler for barcode scanner
  const handleKeyDownSerial = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If product is sealed, auto-save instantly!
      // If unsealed and missing fields, warn operator
      processarBipagem();
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Box Counter Top Banner (Requisito 13) */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-5 shadow-xl border border-blue-900/50">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Box className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-blue-300 font-bold">
                Controle em Tempo Real da Caixa
              </span>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="text"
                  value={caixa}
                  onChange={(e) => setCaixa(e.target.value.toUpperCase())}
                  className="text-2xl font-black bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 rounded-lg px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-44 tracking-wider"
                  title="Clique para renomear ou trocar de caixa"
                />
                <span className="text-xs text-slate-300 font-medium hidden sm:inline">
                  (digite para alterar a caixa ativa)
                </span>
              </div>
            </div>
          </div>

          {/* Metric Cards in Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <div className="bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-center min-w-[120px]">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Auditados
              </span>
              <span className="text-2xl font-black text-white">{contadores.totalAuditados}</span>
            </div>
            <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-4 py-2.5 text-center min-w-[120px]">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
                Lacrados
              </span>
              <span className="text-2xl font-black text-emerald-400">
                {contadores.produtosLacrados}
              </span>
            </div>
            <div className="bg-amber-500/15 border border-amber-400/30 rounded-xl px-4 py-2.5 text-center min-w-[120px]">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
                Não Lacrados
              </span>
              <span className="text-2xl font-black text-amber-400">
                {contadores.produtosNaoLacrados}
              </span>
            </div>
            <div className="bg-rose-500/15 border border-rose-400/30 rounded-xl px-4 py-2.5 text-center min-w-[120px]">
              <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">
                Pendências / Uso
              </span>
              <span className="text-2xl font-black text-rose-400">{contadores.pendencias}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Barcode Audit Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Continuous Scanning Station */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                <Barcode className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">
                  Bipagem Rápida Contínua
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Modo contínuo ultra-rápido: bipe o serial para gravação automática instantânea
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-200">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Auto-Save Ativo</span>
            </div>
          </div>

          {/* Feedback Alerts */}
          {alertaDuplicado && (
            <div className="bg-rose-50 border-2 border-rose-500 text-rose-900 rounded-xl p-4 flex items-start gap-3.5 shadow-sm animate-pulse">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-black uppercase tracking-wide text-rose-700">
                  BLOQUEIO: ESTE NÚMERO DE SÉRIE JÁ FOI AUDITADO!
                </h4>
                <p className="text-xs font-semibold whitespace-pre-line text-rose-800">
                  {alertaDuplicado}
                </p>
              </div>
            </div>
          )}

          {erroValidacao && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="text-xs font-bold">{erroValidacao}</span>
            </div>
          )}

          {mensagemSucesso && (
            <div className="bg-emerald-50 border border-emerald-400 text-emerald-900 rounded-xl p-3.5 flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold">{mensagemSucesso}</span>
            </div>
          )}

          {/* Configuration Grid (Manufacturer, Model, EAN, Date) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            {/* 1. Fabricante Fixo Samsung */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Fabricante (Fixo)
              </label>
              <div className="flex items-center justify-between bg-slate-200/80 border border-slate-300 rounded-lg px-3 py-2 text-slate-700 font-bold text-sm cursor-not-allowed">
                <span>SAMSUNG</span>
                <SamsungLogo height={14} variant="blue" />
              </div>
            </div>

            {/* 2. Modelo do Produto */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Modelo do Produto <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="modelos-samsung"
                  value={modelo}
                  onChange={(e) => handleModeloChange(e.target.value)}
                  placeholder="Ex: Galaxy A55 5G"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="modelos-samsung">
                  {SAMSUNG_MODELOS_PRESET.map((m) => (
                    <option key={m.modelo} value={m.modelo}>
                      {m.modelo} (EAN: {m.ean})
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            {/* 3. EAN */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                EAN (Código de Barras) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                placeholder="789..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* 4. Data da Auditoria */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Data da Auditoria
              </label>
              <input
                type="date"
                value={dataAuditoria}
                onChange={(e) => setDataAuditoria(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 5. Caixa */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Número da Caixa Atual <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={caixa}
                  onChange={(e) => setCaixa(e.target.value.toUpperCase())}
                  placeholder="Ex: CAIXA 01"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const match = caixa.match(/(\d+)/);
                    if (match) {
                      const num = parseInt(match[1], 10) + 1;
                      const novo = `CAIXA ${num < 10 ? '0' + num : num}`;
                      setCaixa(novo);
                    } else {
                      setCaixa(`${caixa} (NOVA)`);
                    }
                  }}
                  className="shrink-0 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
                  title="Criar próxima caixa sequencial"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Próxima Caixa
                </button>
              </div>
            </div>
          </div>

          {/* Core Serial Bipagem Zone */}
          <div className="p-6 bg-blue-50/70 border-2 border-blue-400 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <label
                htmlFor="serial-input"
                className="text-sm font-black text-blue-950 uppercase tracking-wide flex items-center gap-2"
              >
                <Barcode className="w-5 h-5 text-blue-700" />
                SERIAL DO PRODUTO (BIPAR AQUI)
                <span className="text-rose-600">*</span>
              </label>
              <span className="text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200">
                Pressione ENTER ou use Leitor USB
              </span>
            </div>

            <div className="relative">
              <input
                id="serial-input"
                ref={serialInputRef}
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDownSerial}
                placeholder="Aguardando bipagem do leitor ou digitação..."
                className="w-full bg-white border-2 border-blue-500 focus:border-blue-700 rounded-xl px-4 py-4 text-2xl font-mono font-black text-slate-900 tracking-widest placeholder:text-slate-400 placeholder:text-base placeholder:font-sans focus:outline-none focus:ring-4 focus:ring-blue-300/40 shadow-inner uppercase"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="absolute right-3.5 top-3.5">
                <button
                  type="button"
                  onClick={processarBipagem}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-lg shadow-sm transition-transform active:scale-95 flex items-center gap-1.5"
                >
                  <Flame className="w-4 h-4 text-amber-300" />
                  Salvar
                </button>
              </div>
            </div>
            <p className="text-[11px] text-blue-800 font-medium">
              💡 Dica: Se o produto estiver marcado como <strong>LACRADO = SIM</strong>, a bipagem
              salva instantaneamente e limpa o campo para a próxima leitura.
            </p>
          </div>

          {/* Lacre & Integrity Analysis Fields (Requisitos 7 e 8) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
            {/* Produto Lacrado Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                  PRODUTO LACRADO? <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-semibold text-slate-500">
                  {produtoLacrado === 'SIM'
                    ? 'Salvamento automático ativo (sem exigências adicionais)'
                    : 'Atenção: Exige preenchimento de Kit e Marcas de Uso'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setProdutoLacrado('SIM');
                    serialInputRef.current?.focus();
                  }}
                  className={`py-3 px-4 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 border-2 transition-all ${
                    produtoLacrado === 'SIM'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  (SIM) - PRODUTO LACRADO
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProdutoLacrado('NÃO');
                    serialInputRef.current?.focus();
                  }}
                  className={`py-3 px-4 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 border-2 transition-all ${
                    produtoLacrado === 'NÃO'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                  (NÃO) - PRODUTO ABERTO / NÃO LACRADO
                </button>
              </div>
            </div>

            {/* If NÃO Lacrado -> Mandatory Inspection Fields */}
            {produtoLacrado === 'NÃO' && (
              <div className="p-4 bg-amber-50/80 border-2 border-amber-300 rounded-xl space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-amber-900">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Campos Obrigatórios de Análise Física (Produto Não Lacrado)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Kit Completo */}
                  <div className="bg-white p-3.5 rounded-lg border border-amber-200">
                    <label className="block text-xs font-black text-slate-800 uppercase mb-2">
                      Kit Completo? (Acessórios originais) <span className="text-rose-600">*</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setKitCompleto('SIM')}
                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs uppercase border ${
                          kitCompleto === 'SIM'
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        SIM (Completo)
                      </button>
                      <button
                        type="button"
                        onClick={() => setKitCompleto('NÃO')}
                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs uppercase border ${
                          kitCompleto === 'NÃO'
                            ? 'bg-rose-600 text-white border-rose-700'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        NÃO (Falta item)
                      </button>
                    </div>
                  </div>

                  {/* Aparelho com Marcas de Uso */}
                  <div className="bg-white p-3.5 rounded-lg border border-amber-200">
                    <label className="block text-xs font-black text-slate-800 uppercase mb-2">
                      Aparelho com Marcas de Uso? (Riscos/Danos){' '}
                      <span className="text-rose-600">*</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMarcasUso('NÃO')}
                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs uppercase border ${
                          marcasUso === 'NÃO'
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        NÃO (Sem marcas)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarcasUso('SIM')}
                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs uppercase border ${
                          marcasUso === 'SIM'
                            ? 'bg-rose-600 text-white border-rose-700'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        SIM (Com avarias)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Campo Observação Livre */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Observação da Auditoria (Opcional)
              </label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Caixa danificada, falta cabo USB, divergência de cor, etc."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action Button: Bipar Próximo Produto */}
          <div className="pt-2">
            <button
              type="button"
              onClick={processarBipagem}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Barcode className="w-5 h-5 text-blue-400" />
              [BIPAR PRÓXIMO PRODUTO] (SALVAR E LIMPAR)
            </button>
          </div>
        </div>

        {/* Right Side: Recent Scans Roll & Quick Verification */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-600" />
                Últimos Bipados ({caixa})
              </h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {ultimosAuditados.length} recentes
              </span>
            </div>

            {ultimosAuditados.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Barcode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">Nenhum produto auditado nesta caixa ainda.</p>
                <p className="text-[11px] text-slate-400 mt-1">Bipe um código para começar.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {ultimosAuditados.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-slate-900 text-xs tracking-wider">
                        {item.serial}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          item.produto_lacrado === 'SIM'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.produto_lacrado === 'SIM' ? 'Lacrado' : 'Aberto'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-medium truncate max-w-[170px]">
                        {item.modelo_produto}
                      </span>
                      <span>{new Date(item.data_cadastro).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>

                    {item.produto_lacrado === 'NÃO' && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 text-[10px] font-semibold">
                        <span className={item.kit_completo === 'SIM' ? 'text-emerald-700' : 'text-rose-700'}>
                          Kit: {item.kit_completo}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className={item.aparelho_marcas_uso === 'SIM' ? 'text-rose-700 font-bold' : 'text-emerald-700'}>
                          Marcas: {item.aparelho_marcas_uso}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

