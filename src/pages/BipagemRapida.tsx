import React, { useState, useRef, useEffect } from 'react';
import { db, SAMSUNG_MODELOS_PRESET, normalizeImei, normalizeDealer, calcularLoteAutomatico, calcularClassificacaoProduto, inferirFabricante } from '../db/storage';
import { ProdutoAuditoria, SimNao, GrupoFotosInfo, ROTULOS_10_FOTOS_CAIXA, ROTULOS_2_FOTOS_CAIXA, DetalheImeiDuplicado, RegistroLoteFinalizado, RegionalInventoryReference } from '../types';
import { sounds } from '../utils/audio';
import { SamsungLogo } from '../components/SamsungLogo';
import { SolutionsLogo } from '../components/SolutionsLogo';
import { LOGO_SAMSUNG_BASE64, LOGO_SOLUTIONS_BASE64 } from '../assets/logosDataUri';
import { ModalCaptura10FotosCaixa } from '../components/ModalCaptura10FotosCaixa';
import { ModalAlertaDuplicidadeServidor } from '../components/ModalAlertaDuplicidadeServidor';
import { ModalFechamentoLote } from '../components/ModalFechamentoLote';
import {
  ModalEspelhoCaixa,
  ModalNovaCaixa,
  ModalImportacaoRapida,
  ModalAlterarCaixa,
  ModalConfirmacaoTrocaCaixa,
  ModalLimparRegistros,
} from '../features/audit-products/components';
import {
  FileSpreadsheet,
  Plus,
  Printer,
  Download,
  FileText,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  ShieldAlert,
  Trash2,
  X,
  Check,
  Edit2,
  CornerDownLeft,
  ShieldCheck,
  HardDrive,
  Files,
  Building2,
  MapPin,
  Laptop,
  Smartphone,
  RefreshCw,
  Camera,
  Image as ImageIcon,
  Lock,
  Unlock,
  Eye,
  PackageCheck,
  Layers,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const BipagemRapida: React.FC = () => {
  const usuarioAtual = db.getUsuarioAtual();
  const regionalAtiva = usuarioAtual?.regional || (usuarioAtual?.perfil === 'ADMINISTRADOR' ? 'TODAS AS REGIONAIS (ADMIN)' : 'VIA VAREJO RJ');
  const regBusca = regionalAtiva.includes('ADMIN') || regionalAtiva === 'TODAS' ? undefined : regionalAtiva;
  const computadorAtual = db.obterComputadorAtual(usuarioAtual?.regional || undefined);
  const caixasExistentes = db.listarCaixas();

  // Format today's date DD/MM/AAAA
  const getDataAtualFormatada = (): string => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  // State for active row inputs (Excel current active line)
  // All columns requested by user are directly editable: Modelo, EAN, Serial, Data, Caixa, Lacre, Kit, Marcas, Obs
  const [caixaAtiva, setCaixaAtiva] = useState(
    caixasExistentes.length > 0 ? caixasExistentes[0] : 'Caixa 01'
  );
  const [filtroCaixa, setFiltroCaixa] = useState<string>(
    caixasExistentes.length > 0 ? caixasExistentes[0] : 'Caixa 01'
  );

  const configCaixaAtiva = db.obterConfiguracaoCaixa(caixaAtiva, regBusca);

  const [modeloAtivo, setModeloAtivo] = useState(SAMSUNG_MODELOS_PRESET[2].modelo); // Galaxy S24
  const [eanAtivo, setEanAtivo] = useState(SAMSUNG_MODELOS_PRESET[2].ean);
  const [serialInput, setSerialInput] = useState('');
  const [dataAtiva, setDataAtiva] = useState(getDataAtualFormatada());
  const [lacreAtivo, setLacreAtivo] = useState<SimNao>('SIM');
  const [classificacaoAtiva, setClassificacaoAtiva] = useState<string>('');
  const [kitAtivo, setKitAtivo] = useState<SimNao | ''>('');
  const [marcasAtivo, setMarcasAtivo] = useState<SimNao | ''>('');
  const [obsAtivo, setObsAtivo] = useState('');

  // Estados de Referência Regional Ativa & Fabricante Dinâmico
  const [referenciaDetectada, setReferenciaDetectada] = useState<RegionalInventoryReference | null>(null);
  const [fabricanteAtivo, setFabricanteAtivo] = useState<string>(() =>
    inferirFabricante(SAMSUNG_MODELOS_PRESET[2].modelo, null, SAMSUNG_MODELOS_PRESET[2].ean)
  );
  const [statusReferencia, setStatusReferencia] = useState<'IDLE' | 'LISTED' | 'OUT_OF_LIST'>('IDLE');

  // Estado para Bloqueio de Caixa Homogênea (Incompatibilidade)
  const [incompatibilidadeCaixa, setIncompatibilidadeCaixa] = useState<{
    caixa: string;
    classificacaoCaixa: string;
    condicaoCaixa: string;
    classificacaoProduto: string;
    condicaoProduto: string;
    motivo: 'CLASSIFICACAO' | 'CONDICAO' | 'AMBOS';
    detalhes: string;
  } | null>(null);

  // Estado do Número do Lote (Informado e Mantido pelo Colaborador, ex: LOTE 1)
  const [loteAtivo, setLoteAtivo] = useState<string>(() => {
    return db.obterUltimoLote() || 'LOTE 1';
  });

  // Consulta automática de IMEI em tempo real ao bipar ou colar 15 dígitos
  useEffect(() => {
    const imeiLimpo = normalizeImei(serialInput);
    if (imeiLimpo.length === 15) {
      const ref = db.consultarImeiReferencia(imeiLimpo, regBusca);
      if (ref) {
        setReferenciaDetectada(ref);
        setStatusReferencia('LISTED');
        setModeloAtivo(ref.model_description);
        setEanAtivo(ref.sku);
        const fabResolvido = inferirFabricante(ref.model_description, ref.brand, ref.sku);
        setFabricanteAtivo(fabResolvido);
        const classif = calcularClassificacaoProduto({
          sourceType: 'LISTED',
          dealer: ref.dealer_normalized,
          fabricante: fabResolvido,
        });
        setClassificacaoAtiva(classif);
      } else {
        setReferenciaDetectada(null);
        setStatusReferencia('OUT_OF_LIST');
        const fabResolvido = inferirFabricante(modeloAtivo, null, eanAtivo);
        setFabricanteAtivo(fabResolvido);
        const classif = calcularClassificacaoProduto({
          sourceType: 'OUT_OF_LIST',
          fabricante: fabResolvido,
        });
        setClassificacaoAtiva(classif);
      }
    } else {
      setReferenciaDetectada(null);
      setStatusReferencia('IDLE');
      setClassificacaoAtiva('');
    }
  }, [serialInput, regBusca]);

  const isLoteAtualFinalizado = Boolean(loteAtivo.trim()) && db.isLoteFinalizado(loteAtivo.trim(), regBusca);

  const handleMudarLoteAtivo = (novoLote: string) => {
    setLoteAtivo(novoLote);
    db.salvarUltimoLote(novoLote);
  };

  // Se o lote atual estiver finalizado e for operador, avançar para o próximo lote aberto
  useEffect(() => {
    if (usuarioAtual?.perfil === 'OPERADOR' && loteAtivo && db.isLoteFinalizado(loteAtivo, regBusca)) {
      const lotesAbertos = db.listarLotes(regBusca);
      if (lotesAbertos.length > 0) {
        handleMudarLoteAtivo(lotesAbertos[0]);
      } else {
        const num = parseInt(loteAtivo.replace(/\D/g, ''), 10);
        const prox = isNaN(num) ? '02' : String(num + 1).padStart(2, '0');
        handleMudarLoteAtivo(prox);
      }
    }
  }, [regionalAtiva]);

  // Editing state for previously recorded rows (full inline editing of any cell)
  const [linhaEditandoId, setLinhaEditandoId] = useState<number | null>(null);
  const [editModelo, setEditModelo] = useState('');
  const [editEan, setEditEan] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editData, setEditData] = useState('');
  const [editCaixa, setEditCaixa] = useState('');
  const [editLote, setEditLote] = useState('');
  const [editLacre, setEditLacre] = useState<SimNao>('SIM');
  const [editKit, setEditKit] = useState<SimNao | ''>('');
  const [editMarcas, setEditMarcas] = useState<SimNao | ''>('');
  const [editObs, setEditObs] = useState('');

  // UI Modals
  const [mostrarEspelhoModal, setMostrarEspelhoModal] = useState(false);
  const [incluirSeriaisEspelho, setIncluirSeriaisEspelho] = useState(false);
  const [tipoEspelhoVisualizacao, setTipoEspelhoVisualizacao] = useState<'completo' | 'transporte'>('completo');
  const [mostrarImportModal, setMostrarImportModal] = useState(false);
  const [mostrarNovaCaixaModal, setMostrarNovaCaixaModal] = useState(false);
  const [novaCaixaNome, setNovaCaixaNome] = useState('');
  const [mostrarModalFechamentoLote, setMostrarModalFechamentoLote] = useState(false);

  // Estados para Fotos de Evidência dos Grupos (10 em 10)
  const [modalFotoGrupoAberto, setModalFotoGrupoAberto] = useState(false);
  const [grupoFotoAtivo, setGrupoFotoAtivo] = useState<GrupoFotosInfo | null>(null);
  const [modalVisualizarFotosAberto, setModalVisualizarFotosAberto] = useState(false);

  // Estados para as 10 Fotos Obrigatórias da Caixa (Requisitos 4 e 5)
  const [modal10FotosAberto, setModal10FotosAberto] = useState(false);
  const [caixaPara10Fotos, setCaixaPara10Fotos] = useState(caixaAtiva);
  const [acaoApos10Fotos, setAcaoApos10Fotos] = useState<{
    tipo: 'mudar_caixa' | 'nova_caixa';
    caixaDestino?: string;
  } | null>(null);

  // Modal Limpar Registros Não Enviados
  const [mostrarModalLimparRegistros, setMostrarModalLimparRegistros] = useState(false);
  const [limpandoRegistros, setLimpandoRegistros] = useState(false);

  // Estados para Mudança de Caixa com Confirmação de Fotos (Pergunta e Motivo)
  const [mostrarModalConfirmacaoFotos, setMostrarModalConfirmacaoFotos] = useState(false);
  const [exibirCampoMotivoSemFotos, setExibirCampoMotivoSemFotos] = useState(false);
  const [motivoSemFotosInput, setMotivoSemFotosInput] = useState('');
  const [slotFotoSelecionado, setSlotFotoSelecionado] = useState(1);
  const [acaoPendenteTrocaCaixa, setAcaoPendenteTrocaCaixa] = useState<{
    tipo: 'mudar_caixa' | 'abrir_modal_alterar' | 'nova_caixa';
    caixaDestino?: string;
  } | null>(null);

  // Estados de Troca de Caixa
  const [bloqueioTrocaModalAberto, setBloqueioTrocaModalAberto] = useState(false);
  const [gruposFaltantesBloqueio, setGruposFaltantesBloqueio] = useState<GrupoFotosInfo[]>([]);
  const [caixaDestinoTentativa, setCaixaDestinoTentativa] = useState<string | null>(null);

  // Modal Alterar Caixa
  const [mostrarAlterarCaixaModal, setMostrarAlterarCaixaModal] = useState(false);
  const [caixaParaMudarInput, setCaixaParaMudarInput] = useState('');

  // Feedback notifications
  const [erroDuplicado, setErroDuplicado] = useState<string | null>(null);
  const [alertaValidacao, setAlertaValidacao] = useState<string | null>(null);
  const [sucessoNotif, setSucessoNotif] = useState<string | null>(null);

  // Data
  const [produtos, setProdutos] = useState<ProdutoAuditoria[]>(() =>
    db.listarProdutos(filtroCaixa === 'TODAS' ? undefined : { caixa: filtroCaixa })
  );
  const [contadores, setContadores] = useState(() =>
    db.obterContadoresCaixa(caixaAtiva)
  );

  // Responsividade: modo celular ou planilha Excel
  const [modoVisualizacao, setModoVisualizacao] = useState<'celular' | 'excel'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'celular';
    }
    return 'excel';
  });
  const [syncMobileLoading, setSyncMobileLoading] = useState(false);
  const [duplicadosAlerta, setDuplicadosAlerta] = useState<DetalheImeiDuplicado[] | null>(null);
  const [totalEnviadosAlerta, setTotalEnviadosAlerta] = useState<number>(0);

  const handleSyncMobile = async () => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    setSyncMobileLoading(true);
    try {
      const res = await db.sincronizarOnline();
      recarregarDados(filtroCaixa);
      if (res.itensDuplicados && res.itensDuplicados.length > 0) {
        setDuplicadosAlerta(res.itensDuplicados);
        setTotalEnviadosAlerta(res.totalSincronizados);
        setAlertaValidacao(
          `Bloqueio de Envio: ${res.itensDuplicados.length} IMEI(s) já cadastrado(s) no servidor central online.`
        );
      } else if (res.sucesso) {
        setSucessoNotif(res.mensagem);
      } else {
        setAlertaValidacao(res.mensagem);
      }
    } catch {
      setAlertaValidacao('Erro ao sincronizar com o servidor central.');
    } finally {
      setSyncMobileLoading(false);
      setTimeout(() => setSucessoNotif(null), 4000);
    }
  };

  const serialInputRef = useRef<HTMLInputElement>(null);
  const serialMobileInputRef = useRef<HTMLInputElement>(null);
  const tableBottomRef = useRef<HTMLDivElement>(null);
  const kitSelectRef = useRef<HTMLSelectElement>(null);
  const marcasSelectRef = useRef<HTMLSelectElement>(null);
  const isProcessingScanRef = useRef(false);

  const focarInputSerial = () => {
    if (modoVisualizacao === 'celular') {
      serialMobileInputRef.current?.focus();
    } else {
      serialInputRef.current?.focus();
    }
  };

  const selecionarInputSerial = () => {
    if (modoVisualizacao === 'celular') {
      serialMobileInputRef.current?.select();
    } else {
      serialInputRef.current?.select();
    }
  };

  // Auto-focus on the Serial input cell
  useEffect(() => {
    focarInputSerial();
  }, [caixaAtiva, produtos.length, lacreAtivo, modoVisualizacao]);

  const [contadorAtualizacao, setContadorAtualizacao] = useState(0);

  const recarregarDados = (filtro: string) => {
    setProdutos(db.listarProdutos(filtro === 'TODAS' ? undefined : { caixa: filtro }));
    setContadores(db.obterContadoresCaixa(caixaAtiva));
    setContadorAtualizacao((prev) => prev + 1);
  };

  // Refresh when box or filter changes
  useEffect(() => {
    recarregarDados(filtroCaixa);
  }, [filtroCaixa, caixaAtiva]);

  // Listener reativo em tempo real para sincronização e novos dados: atualiza imediatamente sem F5
  useEffect(() => {
    return db.onMudanca(() => {
      recarregarDados(filtroCaixa);
    });
  }, [filtroCaixa, caixaAtiva]);

  // When user changes the model input, try to auto-fill EAN if it matches a Samsung preset, but keep it editable!
  const handleModeloChange = (novoModelo: string) => {
    setModeloAtivo(novoModelo);
    const encontrado = SAMSUNG_MODELOS_PRESET.find(
      (m) => m.modelo.toLowerCase() === novoModelo.toLowerCase().trim()
    );
    const skuPreenchido = encontrado ? encontrado.ean : eanAtivo;
    if (encontrado) {
      setEanAtivo(encontrado.ean);
    }
    const fabResolvido = inferirFabricante(novoModelo, null, skuPreenchido);
    setFabricanteAtivo(fabResolvido);
  };

  // Main Bipagem Process (Excel Row Enter)
  const processarBipagemLinha = () => {
    // Trava de concorrência / debounce para leitores de código de barras laser rápidos (Gate 6)
    if (isProcessingScanRef.current) return;
    isProcessingScanRef.current = true;

    try {
      const serialLimpo = normalizeImei(serialInput);
      const eanLimpo = eanAtivo.trim();
      const modeloLimpo = modeloAtivo.trim();
      const caixaLimpa = caixaAtiva.trim();
      const dataLimpa = dataAtiva.trim() || getDataAtualFormatada();

      setErroDuplicado(null);
      setAlertaValidacao(null);
      setSucessoNotif(null);

      // Validação IMEI (15 dígitos numéricos)
      if (!serialLimpo) {
        setAlertaValidacao('Posicione o cursor na coluna IMEI e bipe o produto.');
        sounds.playError();
        focarInputSerial();
        return;
      }

      if (!/^\d{15}$/.test(serialLimpo)) {
        setAlertaValidacao(
          'IMEI INVÁLIDO: O IMEI deve conter exatamente 15 dígitos numéricos (ex: 357847400282342).'
        );
        sounds.playError();
        selecionarInputSerial();
        return;
      }

      // Validação Caixa
      if (!caixaLimpa) {
        setAlertaValidacao('Informe a Caixa (ex: Caixa 01).');
        sounds.playError();
        return;
      }

      // 0. REGRA DE NEGÓCIO: LIMITE MÁXIMO DE 20 PRODUTOS POR CAIXA
      const totalAtualNaCaixa = db.listarProdutos({ caixa: caixaLimpa }).length;
      if (totalAtualNaCaixa >= 20) {
        sounds.playError();
        setAlertaValidacao(
          'Limite de produtos por caixa atingido. Por favor, lance os próximos produtos em outra caixa.'
        );
        return;
      }

      // 1. VALIDAR DUPLICIDADE EM TEMPO REAL
      const check = db.validarDuplicidade(serialLimpo);
      if (check.duplicado && check.produto) {
        sounds.playError();
        setErroDuplicado(
          `IMEI DUPLICADO: O IMEI ${serialLimpo} já foi auditado na ${check.produto.numero_caixa} em ${check.produto.data_auditoria}.`
        );
        selecionarInputSerial();
        return;
      }

      // 2. CONSULTA DE REFERÊNCIA REGIONAL ATIVA & RESOLUÇÃO DE DADOS
      const refLookup = db.consultarImeiReferencia(serialLimpo, regBusca);
      const sourceType: 'LISTED' | 'OUT_OF_LIST' = refLookup ? 'LISTED' : 'OUT_OF_LIST';
      const dealerResolvido = refLookup?.dealer_normalized || null;
      const modeloResolvido = (refLookup?.model_description || modeloLimpo).trim();
      const skuResolvido = (refLookup?.sku || eanLimpo).trim();
      const fabricanteResolvido = inferirFabricante(
        modeloResolvido,
        refLookup?.brand || null,
        skuResolvido
      );
      const originInvoiceResolvido = refLookup
        ? (refLookup.origin_invoice || null)
        : 'NÃO LOCALIZADA NA BASE';

      // Lote informado pelo colaborador (mantido fielmente)
      const loteResolvido = (loteAtivo || 'LOTE 1').trim().toUpperCase();

      // Classificação calculada automaticamente
      const classificacaoResolvida = calcularClassificacaoProduto({
        sourceType,
        dealer: dealerResolvido,
        fabricante: fabricanteResolvido,
      });

      if (!modeloResolvido) {
        setAlertaValidacao('Preencha o modelo do produto.');
        sounds.playError();
        return;
      }

      if (sourceType === 'OUT_OF_LIST' && !skuResolvido) {
        setAlertaValidacao('O preenchimento do código SKU é obrigatório para produtos fora da lista.');
        sounds.playError();
        return;
      }

      if (!skuResolvido) {
        setAlertaValidacao('Preencha o código SKU do produto.');
        sounds.playError();
        return;
      }

      // Validação de Lote Finalizado (Regras 4, 5 e 6)
      if (db.isLoteFinalizado(loteResolvido, regBusca) && usuarioAtual?.perfil !== 'ADMINISTRADOR') {
        setAlertaValidacao(`O Lote ${loteResolvido} já foi FINALIZADO e BLOQUEADO! Operadores não podem adicionar produtos a um lote fechado.`);
        sounds.playError();
        return;
      }

      // 3. REGRA DO PRODUTO LACRADO (SIM / NÃO)
      if (!lacreAtivo) {
        sounds.playError();
        setAlertaValidacao('Informe se o produto está lacrado (SIM ou NÃO).');
        return;
      }

      if (lacreAtivo === 'NÃO') {
        if (!kitAtivo) {
          sounds.playError();
          setAlertaValidacao('Para produto NÃO lacrado, é OBRIGATÓRIO informar Kit Completo (SIM/NÃO).');
          kitSelectRef.current?.focus();
          return;
        }
        if (!marcasAtivo) {
          sounds.playError();
          setAlertaValidacao('Para produto NÃO lacrado, é OBRIGATÓRIO informar Marcas de Uso (SIM/NÃO).');
          marcasSelectRef.current?.focus();
          return;
        }
      }

      // 3.1. VALIDAÇÃO DE CAIXA HOMOGÊNEA (Chave Dupla: Classificação + Condição de Lacre)
      const validacaoCaixa = db.validarCompatibilidadeCaixa({
        caixa: caixaLimpa,
        classificacao: classificacaoResolvida,
        produto_lacrado: lacreAtivo,
        regional: regBusca,
      });

      if (!validacaoCaixa.compativel) {
        sounds.playError();
        const cfg = validacaoCaixa.configCaixa;
        const motivo =
          cfg?.classificacao && cfg.classificacao.toUpperCase() !== classificacaoResolvida.toUpperCase() &&
          cfg?.condicaoLacre && cfg.condicaoLacre !== (lacreAtivo === 'SIM' ? 'LACRADO' : 'ABERTO')
            ? 'AMBOS'
            : cfg?.classificacao && cfg.classificacao.toUpperCase() !== classificacaoResolvida.toUpperCase()
            ? 'CLASSIFICACAO'
            : 'CONDICAO';

        setIncompatibilidadeCaixa({
          caixa: caixaLimpa,
          classificacaoCaixa: cfg?.classificacao || '-',
          condicaoCaixa: cfg?.condicaoLacre || '-',
          classificacaoProduto: classificacaoResolvida,
          condicaoProduto: lacreAtivo === 'SIM' ? 'LACRADO' : 'ABERTO',
          motivo,
          detalhes: validacaoCaixa.erro || 'A caixa ativa não é compatível com este produto.',
        });
        return;
      }

      // 4. GRAVAÇÃO INSTANTÂNEA NO BANCO DE DADOS LOCAL (COM DUAL PERSISTENCE EM INDEXEDDB)
      const res = db.inserirProduto({
        modelo_produto: modeloResolvido,
        ean: skuResolvido,
        sku: skuResolvido,
        serial: serialLimpo,
        imei: serialLimpo,
        numero_lote: loteResolvido,
        classificacao_produto: classificacaoResolvida,
        product_classification: classificacaoResolvida,
        data_auditoria: dataLimpa,
        numero_caixa: caixaLimpa,
        box_id: caixaLimpa.toLowerCase().replace(/\s+/g, '-'),
        box_name: caixaLimpa,
        numero_nf: originInvoiceResolvido || '',
        nf_origem: originInvoiceResolvido,
        origin_invoice: originInvoiceResolvido,
        produto_lacrado: lacreAtivo,
        kit_completo: lacreAtivo === 'SIM' ? null : (kitAtivo as SimNao),
        aparelho_marcas_uso: lacreAtivo === 'SIM' ? null : (marcasAtivo as SimNao),
        observacao: obsAtivo.trim(),
        regional: regBusca,
        fabricante: fabricanteResolvido,
        source_type: sourceType,
        dealer: dealerResolvido,
        brand: fabricanteResolvido,
        misuse: marcasAtivo === 'SIM',
        reference_id: refLookup?.id || null,
        import_batch_id: refLookup?.import_batch_id || null,
      });

      if (res.sucesso && res.produto) {
        sounds.playSuccess();
        setSucessoNotif(`IMEI ${serialLimpo} registrado no lote ${res.produto.numero_lote} (${caixaLimpa})!`);
        setTimeout(() => setSucessoNotif(null), 2500);

        // Limpar células para a próxima linha contínua
        setSerialInput('');
        setObsAtivo('');
        setClassificacaoAtiva('');
        setReferenciaDetectada(null);
        setStatusReferencia('IDLE');
        if (lacreAtivo === 'NÃO') {
          setKitAtivo('');
          setMarcasAtivo('');
          setLacreAtivo('SIM');
        }

        if (filtroCaixa !== 'TODAS' && filtroCaixa !== caixaLimpa) {
          setFiltroCaixa(caixaLimpa);
        } else {
          recarregarDados(filtroCaixa);
        }

        setTimeout(() => {
          tableBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          focarInputSerial();
        }, 50);
      } else {
        sounds.playError();
        setAlertaValidacao(res.erro || 'Erro ao registrar linha de auditoria.');
        focarInputSerial();
      }
    } finally {
      setTimeout(() => {
        isProcessingScanRef.current = false;
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarBipagemLinha();
    }
  };

  // Full Inline Row Editing (Excel mode) - Allows editing Modelo, EAN, Serial, Caixa, Lacre, Kit, Marcas, Obs, NF Conferida
  const iniciarEdicaoLinha = (item: ProdutoAuditoria) => {
    const regItem = item.regional || regBusca;
    if (db.isLoteFinalizado(item.numero_lote || loteAtivo, regItem) && usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      sounds.playError();
      setAlertaValidacao(`O Lote ${item.numero_lote || loteAtivo} está FINALIZADO e BLOQUEADO. Apenas o Administrador pode editar itens.`);
      return;
    }
    if (item.status_sincronizacao === 'ENVIADO' && usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      sounds.playError();
      setAlertaValidacao('Este produto já foi enviado para o servidor online. Por segurança da auditoria, apenas o Administrador Geral pode editar registros sincronizados.');
      return;
    }
    setLinhaEditandoId(item.id);
    setEditModelo(item.modelo_produto);
    setEditEan(item.ean);
    setEditSerial(item.serial);
    setEditData(item.data_auditoria);
    setEditCaixa(item.numero_caixa);
    setEditLote(item.numero_lote || db.obterUltimoLote() || '01');
    setEditLacre(item.produto_lacrado);
    setEditKit(item.kit_completo || '');
    setEditMarcas(item.aparelho_marcas_uso || '');
    setEditObs(item.observacao || '');
  };

  const salvarEdicaoLinha = (id: number) => {
    if (!editModelo.trim()) {
      alert('O modelo do produto é obrigatório.');
      return;
    }
    if (!editEan.trim()) {
      alert('O código EAN é obrigatório.');
      return;
    }
    if (!editSerial.trim()) {
      alert('O IMEI do produto é obrigatório.');
      return;
    }
    if (!/^\d{15}$/.test(editSerial.trim())) {
      alert('IMEI INVÁLIDO: O IMEI deve conter exatamente 15 dígitos numéricos (ex: 357847400282342).');
      return;
    }
    if (!editCaixa.trim()) {
      alert('A caixa é obrigatória.');
      return;
    }

    if (editLacre === 'NÃO') {
      if (!editKit) {
        alert('Para produto NÃO lacrado, selecione Kit Completo (SIM/NÃO).');
        return;
      }
      if (!editMarcas) {
        alert('Para produto NÃO lacrado, selecione Marcas de Uso (SIM/NÃO).');
        return;
      }
    }

    const regItem = regionalAtiva.includes('ADMIN') || regionalAtiva === 'TODAS' ? undefined : regionalAtiva;
    if (db.isLoteFinalizado(editLote.trim() || '01', regItem) && usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      sounds.playError();
      setAlertaValidacao(`O Lote ${editLote} está FINALIZADO e BLOQUEADO. Operadores não podem alterar itens deste lote.`);
      return;
    }

    const refLookup = db.consultarImeiReferencia(editSerial.trim(), regItem);
    const fabResolvido = inferirFabricante(
      editModelo.trim(),
      refLookup?.brand || null,
      editEan.trim()
    );
    const classifResolvida = calcularClassificacaoProduto({
      sourceType: refLookup ? 'LISTED' : 'OUT_OF_LIST',
      dealer: refLookup?.dealer_normalized || null,
      fabricante: fabResolvido,
    });

    const cxFinal = editCaixa.trim() || caixaAtiva;

    // Gravar no storage
    const res = db.atualizarProduto(id, {
      modelo_produto: editModelo.trim(),
      ean: editEan.trim(),
      sku: editEan.trim(),
      fabricante: fabResolvido,
      brand: fabResolvido,
      classificacao_produto: classifResolvida,
      product_classification: classifResolvida,
      origin_invoice: refLookup ? (refLookup.origin_invoice || null) : 'NÃO LOCALIZADA NA BASE',
      nf_origem: refLookup ? (refLookup.origin_invoice || null) : 'NÃO LOCALIZADA NA BASE',
      serial: editSerial.trim(),
      imei: editSerial.trim(),
      data_auditoria: editData.trim() || getDataAtualFormatada(),
      numero_caixa: cxFinal,
      box_id: cxFinal.toLowerCase().replace(/\s+/g, '-'),
      box_name: cxFinal,
      numero_lote: editLote.trim() || 'LOTE 1',
      produto_lacrado: editLacre,
      kit_completo: editLacre === 'SIM' ? null : (editKit as SimNao),
      aparelho_marcas_uso: editLacre === 'SIM' ? null : (editMarcas as SimNao),
      observacao: editObs.trim(),
    });

    if (!res.sucesso) {
      sounds.playError();
      setAlertaValidacao(res.erro || 'Erro ao salvar alterações na linha.');
      return;
    }

    sounds.playSuccess();
    setSucessoNotif('Linha atualizada com sucesso!');
    setTimeout(() => setSucessoNotif(null), 2000);
    recarregarDados(filtroCaixa);
    setLinhaEditandoId(null);
    focarInputSerial();
  };

  const cancelarEdicaoLinha = () => {
    setLinhaEditandoId(null);
    focarInputSerial();
  };

  // Excluir linha
  const handleExcluirLinha = (id: number, serial: string, statusSync?: string) => {
    if (statusSync === 'ENVIADO' && usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      sounds.playError();
      setAlertaValidacao('Este produto já foi enviado para o servidor online. Por segurança da auditoria, apenas o Administrador Geral pode excluir registros sincronizados.');
      return;
    }
    const itemAlvo = produtos.find(p => p.id === id);
    const regItem = itemAlvo?.regional || regBusca;
    if (itemAlvo?.numero_lote && db.isLoteFinalizado(itemAlvo.numero_lote, regItem) && usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      sounds.playError();
      setAlertaValidacao(`O Lote ${itemAlvo.numero_lote} está FINALIZADO e BLOQUEADO. Operadores não podem excluir itens deste lote.`);
      return;
    }
    if (window.confirm(`Deseja remover o IMEI ${serial}?`)) {
      const res = db.excluirProduto(id);
      if (!res.sucesso) {
        sounds.playError();
        setAlertaValidacao(res.erro || 'Erro ao excluir produto.');
        return;
      }
      recarregarDados(filtroCaixa);
      focarInputSerial();
    }
  };

  // =========================================================================
  // =========================================================================
  // MUDANÇA DE CAIXA COM PERGUNTA DE CONFIRMAÇÃO DE FOTOS (NÃO BLOQUEANTE)
  // Pergunta: "As fotos dos produtos foram anexadas?"
  // Botão SIM -> Libera mudança de numeração da caixa diretamente
  // Botão NÃO -> Abre campo para informar o motivo de não ter colocado e libera
  // =========================================================================
  const executarAcaoAposConfirmacaoFotos = () => {
    setMostrarModalConfirmacaoFotos(false);
    setExibirCampoMotivoSemFotos(false);
    setMotivoSemFotosInput('');

    if (!acaoPendenteTrocaCaixa) return;

    if (acaoPendenteTrocaCaixa.tipo === 'mudar_caixa' && acaoPendenteTrocaCaixa.caixaDestino) {
      const dest = acaoPendenteTrocaCaixa.caixaDestino;
      setAcaoPendenteTrocaCaixa(null);
      setCaixaAtiva(dest);
      setFiltroCaixa(dest);
      setCaixaPara10Fotos(dest);
      recarregarDados(dest);
      setSucessoNotif(`Caixa alterada para ${dest}.`);
      setTimeout(() => setSucessoNotif(null), 2000);
    } else if (acaoPendenteTrocaCaixa.tipo === 'abrir_modal_alterar') {
      setAcaoPendenteTrocaCaixa(null);
      setCaixaParaMudarInput(caixaAtiva);
      setMostrarAlterarCaixaModal(true);
    } else if (acaoPendenteTrocaCaixa.tipo === 'nova_caixa') {
      setAcaoPendenteTrocaCaixa(null);
      const match = caixaAtiva.match(/(\d+)/);
      let sugestaoProxima = 'Caixa 01';
      if (match) {
        const num = parseInt(match[1], 10) + 1;
        sugestaoProxima = `Caixa ${num < 10 ? '0' + num : num}`;
      } else {
        sugestaoProxima = `${caixaAtiva} Lote 2`;
      }
      setNovaCaixaNome(sugestaoProxima);
      setMostrarNovaCaixaModal(true);
    }
  };

  const handleRespostaFotosSim = () => {
    executarAcaoAposConfirmacaoFotos();
  };

  const handleRespostaFotosNao = () => {
    setExibirCampoMotivoSemFotos(true);
  };

  const handleConfirmarMotivoSemFotos = () => {
    if (!motivoSemFotosInput.trim()) {
      sounds.playError();
      setAlertaValidacao('Por favor, informe o motivo de não ter anexado as fotos para liberar a mudança de caixa.');
      return;
    }
    db.registrarMotivoSemFotosCaixa(caixaAtiva, motivoSemFotosInput, regionalAtiva);
    setSucessoNotif('Motivo registrado com sucesso! Mudança de caixa liberada.');
    setTimeout(() => setSucessoNotif(null), 3000);
    executarAcaoAposConfirmacaoFotos();
  };

  const tentarMudarCaixa = (novaCaixa: string): boolean => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return false;
    }
    const cxDestino = novaCaixa.trim();
    if (!cxDestino || cxDestino === caixaAtiva) {
      return true;
    }

    const prodsNaCaixa = produtos.filter((p) => p.numero_caixa === caixaAtiva).length;
    if (prodsNaCaixa === 0) {
      setCaixaAtiva(cxDestino);
      setFiltroCaixa(cxDestino);
      setCaixaPara10Fotos(cxDestino);
      recarregarDados(cxDestino);
      setSucessoNotif(`Caixa alterada para ${cxDestino}.`);
      setTimeout(() => setSucessoNotif(null), 2000);
      return true;
    }

    // Gerar pergunta: "As fotos dos produtos foram anexadas?"
    setAcaoPendenteTrocaCaixa({ tipo: 'mudar_caixa', caixaDestino: cxDestino });
    setExibirCampoMotivoSemFotos(false);
    setMotivoSemFotosInput('');
    setMostrarModalConfirmacaoFotos(true);
    return false;
  };

  const abrirModalAlterarCaixa = () => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    const prodsNaCaixa = produtos.filter((p) => p.numero_caixa === caixaAtiva).length;
    if (prodsNaCaixa === 0) {
      setCaixaParaMudarInput(caixaAtiva);
      setMostrarAlterarCaixaModal(true);
      return;
    }

    setAcaoPendenteTrocaCaixa({ tipo: 'abrir_modal_alterar' });
    setExibirCampoMotivoSemFotos(false);
    setMotivoSemFotosInput('');
    setMostrarModalConfirmacaoFotos(true);
  };

  const confirmarAlterarCaixaModal = () => {
    const cx = caixaParaMudarInput.trim();
    if (cx) {
      const ok = tentarMudarCaixa(cx);
      if (ok) {
        setCaixaParaMudarInput(cx);
        setCaixaPara10Fotos(cx);
        setMostrarAlterarCaixaModal(false);
      }
    }
  };

  const abrirCapturaGrupo = (grupo: GrupoFotosInfo) => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    setGrupoFotoAtivo(grupo);
    setModalFotoGrupoAberto(true);
  };

  const lidarComFotoSalva = () => {
    setModalFotoGrupoAberto(false);
    recarregarDados(filtroCaixa);
    setSucessoNotif('Evidência fotográfica registrada e salva com sucesso!');
    setTimeout(() => setSucessoNotif(null), 3000);
  };

  // Conclusão das Fotos da Caixa
  const handle10FotosConcluidas = () => {
    setModal10FotosAberto(false);
    recarregarDados(filtroCaixa);
    setSucessoNotif(`Fotos da ${caixaPara10Fotos || caixaAtiva} salvas com sucesso!`);
    setTimeout(() => setSucessoNotif(null), 3000);
  };

  const abrir10FotosCaixaAtiva = (slot: number | unknown = 1) => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    setCaixaPara10Fotos(caixaAtiva);
    setSlotFotoSelecionado(typeof slot === 'number' ? slot : 1);
    setAcaoApos10Fotos(null);
    setModal10FotosAberto(true);
  };

  // Nova Auditoria / Próxima Caixa
  const handleNovaAuditoria = () => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    const prodsNaCaixa = produtos.filter((p) => p.numero_caixa === caixaAtiva).length;
    if (prodsNaCaixa === 0) {
      const match = caixaAtiva.match(/(\d+)/);
      let sugestaoProxima = 'Caixa 01';
      if (match) {
        const num = parseInt(match[1], 10) + 1;
        sugestaoProxima = `Caixa ${num < 10 ? '0' + num : num}`;
      } else {
        sugestaoProxima = `${caixaAtiva} Lote 2`;
      }
      setNovaCaixaNome(sugestaoProxima);
      setMostrarNovaCaixaModal(true);
      return;
    }

    setAcaoPendenteTrocaCaixa({ tipo: 'nova_caixa' });
    setExibirCampoMotivoSemFotos(false);
    setMotivoSemFotosInput('');
    setMostrarModalConfirmacaoFotos(true);
  };

  // Limpeza da Tela do Colaborador (Mantém Dados Salvos na Nuvem)
  const handleConfirmarLimpezaRegistros = () => {
    setLimpandoRegistros(true);
    try {
      const res = db.limparTelaColaborador(regionalAtiva);
      setMostrarModalLimparRegistros(false);
      setProdutos([]);
      setCaixaAtiva('Caixa 01');
      setFiltroCaixa('Caixa 01');
      setCaixaPara10Fotos('Caixa 01');
      setContadores(db.obterContadoresCaixa('Caixa 01'));
      setSucessoNotif(res.mensagem);
      setTimeout(() => setSucessoNotif(null), 5000);
      recarregarDados('Caixa 01');
    } catch {
      setAlertaValidacao('Erro ao limpar a tela deste computador.');
    } finally {
      setLimpandoRegistros(false);
    }
  };

  const confirmarCriacaoNovaCaixa = () => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    const nome = novaCaixaNome.trim();
    if (nome) {
      setCaixaAtiva(nome);
      setFiltroCaixa(nome);
      setCaixaPara10Fotos(nome);
      setMostrarNovaCaixaModal(false);
      recarregarDados(nome);
      setSucessoNotif(`Iniciada ${nome}. Pronto para bipagem!`);
      setTimeout(() => setSucessoNotif(null), 2500);
      setTimeout(() => serialInputRef.current?.focus(), 100);
    }
  };

  // =========================================================================
  // 1. ESPELHO DA CAIXA (MODELO, EAN, QUANTIDADE E LOGOS SOLUTIONS & SAMSUNG)
  // Conforme solicitado pelo usuário:
  // "O ESPELHO PRECISA VIM O MODELO, NÃO PRECISA VIM SE ESTA LACRADO OU NÃO,
  // POIS ISSO VAI ESTA NO RELATORIO. ESPELHO MODELO, EAN E QUANTIDADE DESSE
  // MODELO REPRESENTANDO ESSE EAN. NOP ESPELHO PRECISA VIM TAMBÉM LOGO SOLUTIONS E SAMSUNG"
  // =========================================================================
  const obterDadosEspelhoCaixa = (caixaNome: string) => {
    const itens = db.listarProdutos({ caixa: caixaNome });

    // Agrupamento estrito por Modelo e EAN conforme exigência:
    // "espelho deve informar o modelo, o EAN e a quantidade. exemplo mesmo modelo e mesmo ean o espelho só informa a quantidade ex 10,
    // mudou o ean e o modelo ai vem embaixo o modelo e o ean e quantidade"
    const agrupamento = new Map<
      string,
      { item: number; modelo: string; ean: string; total: number; seriais: string[] }
    >();

    for (const p of itens) {
      const modelo = p.modelo_produto?.trim() || 'SAMSUNG';
      const ean = p.ean?.trim() || 'SEM EAN';
      const chave = `${modelo}___${ean}`;
      const ex = agrupamento.get(chave);
      if (ex) {
        ex.total++;
        ex.seriais.push(p.serial);
      } else {
        agrupamento.set(chave, {
          item: agrupamento.size + 1,
          modelo,
          ean,
          total: 1,
          seriais: [p.serial],
        });
      }
    }

    const resumoModelos = Array.from(agrupamento.values()).map((r, idx) => ({
      ...r,
      item: idx + 1,
    }));

    // Agrupamento exclusivo por EAN (Requisito Espelho 2: Região, EAN, Quantidade por EAN)
    const agrupamentoEans = new Map<string, { item: number; ean: string; total: number }>();
    for (const p of itens) {
      const ean = p.ean?.trim() || 'SEM EAN';
      const ex = agrupamentoEans.get(ean);
      if (ex) {
        ex.total++;
      } else {
        agrupamentoEans.set(ean, {
          item: agrupamentoEans.size + 1,
          ean,
          total: 1,
        });
      }
    }

    const resumoEans = Array.from(agrupamentoEans.values()).map((r, idx) => ({
      ...r,
      item: idx + 1,
    }));

    return {
      caixaNome,
      itens,
      totalGeral: itens.length,
      resumoModelos,
      resumoEans,
    };
  };

  // Exportar PDF Oficial do Espelho da Caixa
  const exportarEspelhoPDF = () => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    const caixaNomeAlvo = filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa;
    const { itens, totalGeral, resumoModelos } = obterDadosEspelhoCaixa(caixaNomeAlvo);
    const usuarioAtual = db.getUsuarioAtual();

    const doc = new jsPDF();

    // 1. Logos Oficiais Solutions e Samsung
    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 10, 36, 11.8);
    } catch {
      // Fallback
    }

    try {
      doc.addImage(LOGO_SAMSUNG_BASE64, 'PNG', 160, 9, 36, 15.4);
    } catch {
      // Fallback
    }

    // 2. Título Oficial do Espelho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - CONTROLE, CONFERÊNCIA E QUALIDADE', 14, 28);

    doc.setFontSize(11);
    doc.setTextColor(12, 77, 162); // Azul Samsung
    doc.text('ESPELHO DE AUDITORIA SAMSUNG', 14, 34);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 40);
    doc.text(`Responsável Grupo Solutions: ${usuarioAtual?.nome || 'Operador'}`, 14, 45);

    // Box de Instrução: Colocar dentro da Caixa Master
    doc.setDrawColor(37, 99, 235);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, 49, 182, 10, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 64, 175);
    doc.text('ATENÇÃO: Este espelho deve ser colocado dentro da Caixa Master.', 18, 55.5);

    // 3. Quadro de Informações da Caixa
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 62, 182, 28, 2, 2, 'FD');

    const loteCaixa = itens.length > 0 && itens[0].numero_lote ? itens[0].numero_lote : loteAtivo;
    const fabCaixa = itens.length > 0
      ? (itens[0].fabricante || itens[0].brand || 'NÃO IDENTIFICADO')
      : (fabricanteAtivo || 'NÃO IDENTIFICADO');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`CAIXA: ${caixaNomeAlvo.toUpperCase()}`, 18, 70);
    doc.text(`LOTE: ${loteCaixa.toUpperCase()}`, 18, 77);
    doc.text(`FABRICANTE: ${fabCaixa.toUpperCase()}`, 18, 84);

    doc.text(`REGIONAL: ${regionalAtiva}`, 105, 70);
    doc.text(`QUANTIDADE TOTAL NA CAIXA: ${totalGeral} ${totalGeral === 1 ? 'produto' : 'produtos'}`, 105, 77);
    doc.text(`MODELOS/EANS DISTINTOS: ${resumoModelos.length}`, 105, 84);

    // 4. TABELA PRINCIPAL DO ESPELHO: MODELO, EAN E QUANTIDADE AGRUPADA
    // Exatamente como solicitado:
    // "espelho deve informar o modelo, o EAN e a quantidade. exemplo mesmo modelo e mesmo ean o espelho só informa a quantidade ex 10,
    // mudou o ean e o modelo ai vem embaixo o modelo e o ean e quantidade"
    const tableData = resumoModelos.map((r) => [
      r.item.toString().padStart(2, '0'),
      r.modelo,
      r.ean,
      `${r.total} ${r.total === 1 ? 'unidade' : 'unidades'}`,
    ]);

    autoTable(doc, {
      startY: 94,
      head: [['Item', 'Modelo Produto', 'Código EAN', 'Quantidade']],
      body: tableData.length > 0 ? tableData : [['-', 'Nenhum produto registrado nesta caixa', '-', '-']],
      foot: [
        ['', 'TOTAL GERAL DE PRODUTOS NA CAIXA', '', `${totalGeral} ${totalGeral === 1 ? 'unidade' : 'unidades'}`],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [12, 77, 162],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      styles: {
        fontSize: 9,
        cellPadding: 3.5,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 16 },
        1: { fontStyle: 'bold' },
        2: { font: 'courier' },
        3: { halign: 'center', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    let currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    // 5. Relação de Seriais (Opcional se selecionado)
    if (incluirSeriaisEspelho && itens.length > 0) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('RELAÇÃO DE IMEIS BIPADOS NESTA CAIXA:', 14, currentY);

      const serialsData = itens.map((p, idx) => [
        (idx + 1).toString().padStart(2, '0'),
        p.modelo_produto,
        p.ean,
        p.imei || p.serial,
      ]);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Nº', 'Modelo Produto', 'EAN', 'Número IMEI (15 Dígitos)']],
        body: serialsData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          3: { font: 'courier', fontStyle: 'bold' },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });

      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    }

    // 6. Bloco de Assinaturas (Requisito 5: Responsável Casas Bahia e Responsável Grupo Solutions)
    if (currentY > 250) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.line(18, currentY + 15, 90, currentY + 15);
    doc.text('Responsável Casas Bahia', 18, currentY + 20);

    doc.line(110, currentY + 15, 182, currentY + 15);
    doc.text('Responsável Grupo Solutions', 110, currentY + 20);

    doc.save(`Espelho_Completo_${caixaNomeAlvo.replace(/\s+/g, '_')}_Samsung.pdf`);
  };

  // =========================================================================
  // ESPELHO 2: RESUMIDO / TRANSPORTE (SEGURANÇA DE CARGA)
  // REQUISITO DE SEGURANÇA: NÃO EXIBE MODELOS DOS PRODUTOS
  // Contém apenas NF, Caixas, quantidades por caixa e totais + assinaturas
  // =========================================================================
  const exportarEspelhoTransportePDF = (caixaAlvo?: string) => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    const doc = new jsPDF();
    const caixaNomeAlvo = caixaAlvo || (filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa);
    const itens = db.listarProdutos({ caixa: caixaNomeAlvo });
    const totalGeral = itens.length;
    const loteCaixa = itens.length > 0 && itens[0].numero_lote ? itens[0].numero_lote : loteAtivo;

    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 10, 36, 11.8);
      doc.addImage(LOGO_SAMSUNG_BASE64, 'PNG', 160, 9, 36, 15.4);
    } catch {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - CONTROLE DE TRANSPORTE E EXPEDIÇÃO', 14, 28);

    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9); // Âmbar transporte
    doc.text('ESPELHO 2 - RESUMIDO DE EXPEDIÇÃO', 14, 34);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 40);
    doc.text(`Responsável pelo Embarque: ${usuarioAtual?.nome || 'Operador'}`, 14, 45);

    // Quadro de informações gerais (Região, Lote e Caixa)
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 49, 182, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`REGIONAL: ${regionalAtiva}`, 18, 58);
    doc.text(`VOLUME / CAIXA: ${caixaNomeAlvo.toUpperCase()}`, 18, 64);
    doc.text(`LOTE: ${loteCaixa.toUpperCase()}`, 105, 58);
    doc.text(`QUANTIDADE TOTAL NO VOLUME: ${totalGeral} peças`, 105, 64);

    // Agrupamento exclusivo por EAN (Requisito Espelho 2: Região, EAN, Quantidade por EAN)
    const eanMap = new Map<string, number>();
    for (const p of itens) {
      const ean = p.ean?.trim() || 'SEM EAN';
      eanMap.set(ean, (eanMap.get(ean) || 0) + 1);
    }
    const listaEans = Array.from(eanMap.entries()).map(([ean, qtd], idx) => ({
      item: (idx + 1).toString().padStart(2, '0'),
      ean,
      qtd,
    }));

    const tableData = listaEans.map((e) => [
      e.item,
      e.ean,
      `${e.qtd} ${e.qtd === 1 ? 'unidade' : 'unidades'}`,
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Item', 'Código EAN', 'Quantidade por EAN']],
      body: tableData.length > 0 ? tableData : [['-', 'Nenhum produto registrado nesta caixa', '-']],
      foot: [['', 'TOTAL GERAL NO VOLUME', `${totalGeral} ${totalGeral === 1 ? 'unidade' : 'unidades'}`]],
      theme: 'grid',
      headStyles: {
        fillColor: [180, 83, 9],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { font: 'courier', fontStyle: 'bold' },
        2: { halign: 'center', fontStyle: 'bold' },
      },
    });

    let currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 25;

    if (currentY > 250) {
      doc.addPage();
      currentY = 30;
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.line(18, currentY + 15, 90, currentY + 15);
    doc.text('Responsável Casas Bahia', 18, currentY + 20);

    doc.line(110, currentY + 15, 182, currentY + 15);
    doc.text('Responsável Grupo Solutions', 110, currentY + 20);

    doc.save(`Espelho_2_Expedicao_${caixaNomeAlvo.replace(/\s+/g, '_')}.pdf`);
  };

  const baixarAmbosEspelhos = () => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    exportarEspelhoPDF();
    setTimeout(() => {
      exportarEspelhoTransportePDF();
    }, 600);
  };

  // =========================================================================
  // 2. RELATÓRIOS (EXCEL E PDF - DA CAIXA OU GERAL DE TODAS AS CAIXAS)
  // Conforme solicitado pelo usuário:
  // "NÃO PRECISA VIM SE ESTA LACRADO OU NÃO, POIS ISSO VAI ESTA NO RELATORIO"
  // "NO RELATORIO QUANDO EU FOR BAIXAR PODE VIM RELATORIO DE TODAS AS CAIXA, RELATORIO GERAL."
  // =========================================================================

  // Exportar Relatório em Planilha Excel (.xlsx)
  const exportarRelatorioExcel = (geralTodasCaixas: boolean) => {
    const lista = geralTodasCaixas
      ? db.listarProdutos() // Todas as caixas
      : db.listarProdutos({ caixa: filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa });

    const dados = lista.map((p, index) => ({
      'Nº': index + 1,
      Regional: p.regional || regionalAtiva,
      'Computador ID': p.computador_id || 'PC-01',
      'Nome Estação': p.computador_nome || 'Estação 01',
      Fabricante: p.fabricante || p.brand || 'FABRICANTE NÃO IDENTIFICADO',
      'Modelo Produto': p.modelo_produto,
      SKU: p.sku || p.ean,
      IMEI: p.imei || p.serial,
      'NF Origem': p.origin_invoice || p.nf_origem || p.numero_nf || 'NÃO LOCALIZADA NA BASE',
      'Data Auditoria': p.data_auditoria,
      Caixa: p.box_name || p.numero_caixa,
      Lote: p.numero_lote || 'LOTE 1',
      Classificação: p.classificacao_produto || p.product_classification || '-',
      'Produto Lacrado': p.produto_lacrado,
      'Kit Completo': p.kit_completo || '-',
      'Marcas de Uso': p.aparelho_marcas_uso || '-',
      Observação: p.observacao || '-',
      Auditor: p.usuario_cadastro,
      'Status Sincronização':
        p.status_sincronizacao === 'ENVIADO'
          ? 'Enviado para Online'
          : p.status_sincronizacao === 'ERRO_DUPLICADO'
          ? 'Duplicado Servidor'
          : 'Aguardando envio para Online',
      'Data Sincronização': p.data_sincronizacao || '-',
      'ID Servidor': p.id_servidor || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    const sheetName = geralTodasCaixas
      ? 'Auditoria_Geral_Samsung'
      : (filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa).substring(0, 31);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(
      wb,
      geralTodasCaixas
        ? `Relatorio_Geral_Todas_Caixas_Samsung_${regionalAtiva.replace(/\s+/g, '_')}_${getDataAtualFormatada().replace(/\//g, '-')}.xlsx`
        : `Relatorio_Auditoria_${sheetName.replace(/\s+/g, '_')}.xlsx`
    );
  };

  // Exportar Relatório em PDF com informações completas de Lacre e Marcas
  const exportarRelatorioPDF = (geralTodasCaixas: boolean) => {
    const lista = geralTodasCaixas
      ? db.listarProdutos()
      : db.listarProdutos({ caixa: filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa });

    const doc = new jsPDF('landscape'); // Paisagem para caber todas as colunas de auditoria
    const usuarioAtual = db.getUsuarioAtual();
    const titulo = geralTodasCaixas
      ? `RELATÓRIO GERAL DE AUDITORIA - TODAS AS CAIXAS SAMSUNG (${regionalAtiva})`
      : `RELATÓRIO DE AUDITORIA E CONFERÊNCIA - ${filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa} (${regionalAtiva})`;

    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 8, 36, 11.8);
      doc.addImage(LOGO_SAMSUNG_BASE64, 'PNG', 246, 8, 36, 15.4);
    } catch {
      // Fallback
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - DEPARTAMENTO DE AUDITORIA E QUALIDADE', 14, 25);

    doc.setFontSize(10);
    doc.setTextColor(12, 77, 162);
    doc.text(titulo, 14, 30);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Emissão: ${new Date().toLocaleString('pt-BR')} | Regional: ${regionalAtiva} | Auditor: ${usuarioAtual?.nome || 'Operador'} | Total: ${lista.length} aparelhos`,
      14,
      35
    );

    const tableData = lista.map((p, idx) => [
      (idx + 1).toString(),
      p.regional || regionalAtiva,
      p.box_name || p.numero_caixa,
      p.modelo_produto,
      p.sku || p.ean,
      p.imei || p.serial,
      p.origin_invoice || p.nf_origem || p.numero_nf || 'NÃO LOCALIZADA',
      p.numero_lote || 'LOTE 1',
      p.classificacao_produto || p.product_classification || '-',
      p.produto_lacrado,
      p.kit_completo || '-',
      p.aparelho_marcas_uso || '-',
      p.observacao || '-',
      p.data_auditoria,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nº', 'Regional', 'Caixa', 'Modelo', 'SKU', 'IMEI', 'NF Origem', 'Lote', 'Classificação', 'Lacrado', 'Kit Completo', 'Marcas de Uso', 'Observação', 'Data']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
      },
    });

    doc.save(
      geralTodasCaixas
        ? `Relatorio_Geral_Todas_Caixas_${regionalAtiva.replace(/\s+/g, '_')}_${getDataAtualFormatada().replace(/\//g, '-')}.pdf`
        : `Relatorio_${(filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa).replace(/\s+/g, '_')}.pdf`
    );
  };

  // Botão de Backup / Proteção de Dados (Cópia com 1 clique)
  const baixarCopiaSeguranca = () => {
    const backupJson = db.gerarArquivoBackup();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_Seguranca_Auditoria_Solutions_${getDataAtualFormatada().replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSucessoNotif('Cópia de segurança salva com sucesso! Seus dados estão 100% protegidos.');
    setTimeout(() => setSucessoNotif(null), 3000);
  };

  const handleAbrirEspelho = () => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    setMostrarEspelhoModal(true);
  };

  const handleImprimirEspelho = () => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      return;
    }
    setMostrarEspelhoModal(true);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const handleAbrirFechamentoLote = () => {
    if (!loteAtivo.trim()) {
      sounds.playError();
      setAlertaValidacao('Informe o número do lote antes de iniciar o fechamento.');
      return;
    }

    const regBusca = regionalAtiva.includes('ADMIN') || regionalAtiva === 'TODAS' ? undefined : regionalAtiva;
    const prodsDoLote = db.listarProdutos({
      regional: regBusca,
      numero_lote: loteAtivo.trim(),
    });

    if (prodsDoLote.length === 0) {
      sounds.playError();
      setAlertaValidacao(`Não há produtos registrados no Lote ${loteAtivo}. Lance os produtos antes de realizar o fechamento.`);
      return;
    }

    if (db.isLoteFinalizado(loteAtivo, regBusca)) {
      sounds.playError();
      setAlertaValidacao(`O Lote ${loteAtivo} já foi finalizado e bloqueado.`);
      return;
    }

    setMostrarModalFechamentoLote(true);
  };

  const handleLoteFinalizadoComSucesso = (loteFinalizado: RegistroLoteFinalizado) => {
    setMostrarModalFechamentoLote(false);
    sounds.playSuccess();
    setSucessoNotif(`Lote ${loteFinalizado.numero_lote} finalizado com sucesso e bloqueado para a operação!`);

    const regBusca = regionalAtiva.includes('ADMIN') || regionalAtiva === 'TODAS' ? undefined : regionalAtiva;
    const lotesAbertos = db.listarLotes(regBusca);
    if (lotesAbertos.length > 0) {
      handleMudarLoteAtivo(lotesAbertos[0]);
    } else {
      const numAtual = parseInt(loteFinalizado.numero_lote.replace(/\D/g, ''), 10);
      const prox = isNaN(numAtual) ? '02' : String(numAtual + 1).padStart(2, '0');
      handleMudarLoteAtivo(prox);
    }
    recarregarDados(filtroCaixa);
  };

  const espelhoCaixaAtual = obterDadosEspelhoCaixa(filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa);
  const statusCaixaAtiva = db.obterStatusEnvioCaixa(filtroCaixa === 'TODAS' ? caixaAtiva : filtroCaixa, regionalAtiva);
  const produtosPendentesCount = produtos.filter((p) => p.status_sincronizacao !== 'ENVIADO').length;
  const contagemStatusRegistros = db.obterContagemStatusRegistros(regionalAtiva);
  const gruposFotosCaixaAtiva = db.obterGruposFotosCaixa(caixaAtiva, regionalAtiva);
  const totalFotosCaixaAtiva = gruposFotosCaixaAtiva.filter((g) => g.temFoto).length;
  const totalFotos10CaixaAtiva = db.obterContadorFotos10(caixaAtiva, regionalAtiva);
  const registro10Atual = db.obter10FotosCaixa(caixaAtiva, regionalAtiva);

  return (
    <div className="space-y-4">
      {/* Datalists compartilhados */}
      <datalist id="lista-modelos-samsung">
        {SAMSUNG_MODELOS_PRESET.map((m) => (
          <option key={m.modelo} value={m.modelo}>
            {m.ean}
          </option>
        ))}
      </datalist>

      <datalist id="lista-caixas-existentes">
        {caixasExistentes.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* ========================================================================= */}
      {/* BARRA DE ALTERNAÇÃO DE VISUALIZAÇÃO: MODO CELULAR VS PLANILHA EXCEL */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border-2 border-slate-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-300 w-full sm:w-auto justify-center">
          <button
            type="button"
            onClick={() => {
              setModoVisualizacao('celular');
              setTimeout(() => focarInputSerial(), 80);
            }}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              modoVisualizacao === 'celular'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Modo Celular (Bipagem Ágil)
          </button>
          <button
            type="button"
            onClick={() => {
              setModoVisualizacao('excel');
              setTimeout(() => focarInputSerial(), 80);
            }}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              modoVisualizacao === 'excel'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Modo Planilha (Grid Completo)
          </button>
        </div>

        {/* Botão de Envio para Online / Servidor Central */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleSyncMobile}
            disabled={syncMobileLoading}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
              produtosPendentesCount > 0
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            <Upload className={`w-4 h-4 ${syncMobileLoading ? 'animate-spin' : ''}`} />
            {syncMobileLoading
              ? 'Enviando para o Online...'
              : produtosPendentesCount > 0
              ? `Enviar para Online (${produtosPendentesCount} aguardando)`
              : 'Enviar para Online'}
          </button>
        </div>
      </div>

      {/* Screen Reader Live Region para anúncios de bipagem e status */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {sucessoNotif || erroDuplicado || alertaValidacao || ''}
      </div>

      {/* Alertas globais (visíveis em ambos os modos) */}
      {erroDuplicado && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-rose-100 border-2 border-rose-500 text-rose-900 rounded-xl p-3.5 flex items-center gap-3 shadow-md animate-bounce"
        >
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-xs font-black">{erroDuplicado}</span>
        </div>
      )}

      {alertaValidacao && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-amber-100 border border-amber-500 text-amber-900 rounded-xl p-3 flex items-center gap-2 shadow-xs"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-xs font-bold">{alertaValidacao}</span>
        </div>
      )}

      {sucessoNotif && (
        <div
          role="status"
          aria-live="polite"
          className="bg-emerald-100 border border-emerald-500 text-emerald-900 rounded-xl p-2.5 flex items-center gap-2 animate-in fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{sucessoNotif}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CABEÇALHO DA OPERAÇÃO: REGIONAL, ESTAÇÃO, CAIXA, LOTE ATUAL E CLASSIFICAÇÃO */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-md flex flex-wrap items-center justify-between gap-4 border-2 border-blue-600/50">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          {/* Regional */}
          <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-200 block">Regional</span>
            <span className="text-xs font-black uppercase text-white truncate block max-w-[140px]">{regionalAtiva}</span>
          </div>

          {/* Estação */}
          <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-200 block">Estação</span>
            <span className="text-xs font-mono font-black text-emerald-300 block">💻 {computadorAtual.id}</span>
          </div>

          {/* Caixa */}
          <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-200 block">Caixa</span>
            <span className="text-xs font-black uppercase text-amber-300 block">{caixaAtiva}</span>
          </div>

          {/* Campo Obrigatório: LOTE ATUAL (Informado e Mantido pelo Colaborador) */}
          <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-400/40 rounded-xl px-3 py-1">
            <div className="w-7 h-7 rounded-lg bg-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 block">
                Lote Atual:
              </span>
              <input
                type="text"
                value={loteAtivo}
                onChange={(e) => handleMudarLoteAtivo(e.target.value)}
                placeholder="Ex: LOTE 1"
                className={`text-xs font-black text-white bg-blue-950/80 border rounded-lg px-2.5 py-0.5 focus:outline-none focus:ring-2 w-32 uppercase tracking-wider shadow-inner transition-all ${
                  !loteAtivo.trim()
                    ? 'border-rose-500 ring-2 ring-rose-500/60 placeholder-rose-400'
                    : 'border-amber-400/80 focus:ring-amber-400'
                }`}
                title="Número do Lote ativo (informado pelo colaborador, ex: LOTE 1)"
              />
            </div>
          </div>

          {/* Classificação do Item Bipado (Calculada Automaticamente) */}
          <div className="bg-indigo-950/70 border border-indigo-400/40 rounded-xl px-3 py-1.5 min-w-[160px]">
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300 block">
              Classificação do Item:
            </span>
            <span className="text-xs font-black uppercase text-indigo-100 truncate block max-w-[240px]" title={classificacaoAtiva || 'Aguardando bipagem...'}>
              {classificacaoAtiva ? `🏷️ ${classificacaoAtiva}` : '⏳ Aguardando bipagem...'}
            </span>
          </div>
        </div>

        {/* Indicador em Tempo Real do Limite de 20 Produtos por Caixa */}
        <div className="flex items-center gap-3">
          <div
            className={`px-4 py-2 rounded-xl border flex items-center gap-2.5 transition-all ${
              contadores.totalAuditados >= 20
                ? 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-md ring-2 ring-rose-500 animate-pulse'
                : contadores.totalAuditados >= 15
                ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                : 'bg-blue-950/80 border-blue-500/50 text-blue-200'
            }`}
          >
            <Boxes className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold uppercase block leading-tight">
                Limite por Caixa:
              </span>
              <span className="text-xs font-black">
                {contadores.totalAuditados} / 20 produtos
              </span>
            </div>
          </div>

          {contadores.totalAuditados >= 20 && (
            <button
              type="button"
              onClick={handleNovaAuditoria}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer animate-bounce"
            >
              <Plus className="w-4 h-4" /> Nova Caixa
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BANNER DE BLOQUEIO: STATUS LOTE FINALIZADO (REGRAS 4, 5 e 6) */}
      {/* ========================================================================= */}
      {isLoteAtualFinalizado && (
        <div className="bg-gradient-to-r from-red-600 via-rose-700 to-amber-700 text-white rounded-2xl p-4 shadow-lg border-2 border-red-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <span>STATUS: LOTE FINALIZADO (LOTE {loteAtivo})</span>
                <span className="bg-white text-rose-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shadow-xs">
                  BLOQUEADO
                </span>
              </div>
              <p className="text-xs text-rose-100 font-medium mt-0.5">
                {usuarioAtual?.perfil === 'ADMINISTRADOR'
                  ? 'Este lote foi finalizado e lacrado com as 3 fotos obrigatórias. Modo Administrador ativo: você pode visualizar ou realizar auditoria.'
                  : 'Este lote já foi fechado com as 3 fotos obrigatórias e lacrado. Não é permitido adicionar novos itens ou reutilizar este lote.'}
              </p>
            </div>
          </div>
          {usuarioAtual?.perfil === 'ADMINISTRADOR' ? (
            <span className="text-[11px] bg-black/30 border border-white/40 text-white px-3 py-1.5 rounded-xl font-black uppercase tracking-wider shrink-0">
              🛡️ Acesso Admin Liberado
            </span>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const lotesAbertos = db.listarLotes(regBusca);
                  if (lotesAbertos.length > 0) {
                    handleMudarLoteAtivo(lotesAbertos[0]);
                  } else {
                    const num = parseInt(loteAtivo.replace(/\D/g, ''), 10);
                    const prox = isNaN(num) ? '02' : String(num + 1).padStart(2, '0');
                    handleMudarLoteAtivo(prox);
                  }
                }}
                className="bg-white hover:bg-slate-100 text-rose-900 font-black text-xs uppercase px-3.5 py-2 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95"
              >
                Mudar para Próximo Lote ❯
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* RENDERIZAÇÃO CONDICIONAL: MODO CELULAR VS PLANILHA */}
      {/* ========================================================================= */}
      {modoVisualizacao === 'celular' ? (
        <div className="space-y-4">
          {/* Card 1: Caixa e Status de Auditoria */}
          <div className="bg-white rounded-2xl p-4 border-2 border-slate-300 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex items-center gap-1.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Caixa Atual:</span>
                    <input
                      list="lista-caixas-existentes"
                      type="text"
                      defaultValue={caixaAtiva}
                      key={caixaAtiva}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && val !== caixaAtiva) {
                          tentarMudarCaixa(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="Ex: Caixa 01"
                      className="text-base font-black text-blue-900 uppercase bg-blue-50 border-2 border-blue-400 rounded-lg px-2.5 py-1 focus:outline-none w-32"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={abrirModalAlterarCaixa}
                    className="mt-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] uppercase px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                    title="Trocar Caixa (Valida Fotos)"
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    Alterar
                  </button>
                </div>
              </div>
              
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total na Caixa:</span>
                <span className="text-2xl font-black text-slate-900">{contadores.totalAuditados}</span>
                <span className="text-[10px] text-emerald-700 font-bold block">
                  {contadores.produtosLacrados} lacrados • {contadores.produtosNaoLacrados} abertos
                </span>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      statusCaixaAtiva === 'Enviado Online'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        statusCaixaAtiva === 'Enviado Online' ? 'bg-emerald-600' : 'bg-amber-600 animate-pulse'
                      }`}
                    />
                    {statusCaixaAtiva}
                  </span>
                </div>
              </div>
            </div>

            {/* Badges de Regional e Estação */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-blue-950 text-amber-300 px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 border border-blue-800">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                {regionalAtiva}
              </span>
              <span className="bg-indigo-950 text-white px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] flex items-center gap-1 border border-indigo-800">
                <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                {computadorAtual.id}
              </span>
              <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg font-black text-[11px] flex items-center gap-1 border border-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                AUDITORIA
              </span>
            </div>

            {/* Header da Caixa Homogênea (Seção 19) */}
            <div className="bg-slate-50 rounded-xl p-3 border-2 border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="border-r border-slate-200 pr-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">CAIXA</span>
                <span className="font-black text-slate-900 truncate block">{caixaAtiva}</span>
              </div>
              <div className="border-r border-slate-200 pr-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">CLASSIFICAÇÃO</span>
                <span
                  className="font-black text-blue-900 truncate block"
                  title={configCaixaAtiva.vazia ? 'AGUARDANDO PRIMEIRO PRODUTO' : (configCaixaAtiva.classificacao || '-')}
                >
                  {configCaixaAtiva.vazia ? 'AGUARDANDO PRIMEIRO PRODUTO' : (configCaixaAtiva.classificacao || '-')}
                </span>
              </div>
              <div className="border-r border-slate-200 pr-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">CONDIÇÃO</span>
                <span
                  className={`font-black truncate block ${
                    configCaixaAtiva.vazia
                      ? 'text-slate-500'
                      : configCaixaAtiva.condicaoLacre === 'LACRADO'
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {configCaixaAtiva.vazia ? '-' : configCaixaAtiva.condicaoLacre}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">LOTE</span>
                <span className="font-black text-amber-900 truncate block">{loteAtivo || 'LOTE 1'}</span>
              </div>
            </div>

            {/* Seletor Rápido de Caixas Existentes */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Trocar Caixa:</span>
              {caixasExistentes.map((cx) => (
                <button
                  key={cx}
                  type="button"
                  onClick={() => tentarMudarCaixa(cx)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition-colors cursor-pointer ${
                    caixaAtiva === cx
                      ? 'bg-blue-600 text-white font-black'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cx} ({db.obterContadoresCaixa(cx).totalAuditados})
                </button>
              ))}
              <button
                type="button"
                onClick={handleNovaAuditoria}
                className="px-2.5 py-1 rounded-lg font-bold text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200 whitespace-nowrap flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Nova
              </button>
            </div>
          </div>

          {/* Card 1.5: Evidências Fotográficas da Caixa */}
          <div className="bg-slate-900 border-2 border-blue-600/50 rounded-2xl p-3.5 shadow-sm text-white space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase text-white truncate">
                      Fotos da {caixaAtiva}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                        totalFotos10CaixaAtiva >= 2
                          ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                          : 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                      }`}
                    >
                      {totalFotos10CaixaAtiva} foto{totalFotos10CaixaAtiva !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Foto dos produtos 1 e 2 (+ adicionar mais)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    db.adicionarSlotFotoCaixa(caixaAtiva, regionalAtiva);
                    recarregarDados(filtroCaixa);
                    setSucessoNotif('Novo slot de foto adicionado!');
                    setTimeout(() => setSucessoNotif(null), 2000);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-2.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                  title="Adicionar mais um espaço de foto para esta caixa"
                >
                  <Plus className="w-3.5 h-3.5" /> Foto
                </button>
                <button
                  type="button"
                  onClick={() => abrir10FotosCaixaAtiva(1)}
                  className={`font-black text-xs uppercase px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
                    totalFotos10CaixaAtiva >= 2
                      ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {totalFotos10CaixaAtiva > 0 ? 'Ver' : 'Tirar'}
                </button>
              </div>
            </div>

            {/* Slots Dinâmicos da Caixa Ativa */}
            <div className="grid grid-cols-2 gap-2">
              {(registro10Atual?.fotos || []).map((fItem) => {
                const temFoto = !!fItem?.fotoDataUri && fItem.fotoDataUri.length > 50;

                return (
                  <div
                    key={fItem.indice}
                    onClick={() => abrir10FotosCaixaAtiva(fItem.indice)}
                    className={`p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                      temFoto
                        ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-100'
                        : 'bg-slate-800/80 border-dashed border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-300 truncate">
                        {fItem.rotulo || `Foto dos produtos ${fItem.indice}`}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {temFoto ? (
                          <span className="text-[9px] font-black uppercase bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> OK
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">
                            Vazia
                          </span>
                        )}
                        {fItem.indice > 2 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              db.removerSlotFotoCaixa(caixaAtiva, fItem.indice, regionalAtiva);
                              recarregarDados(filtroCaixa);
                            }}
                            className="p-0.5 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                            title="Remover foto adicional"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {temFoto ? (
                      <div className="w-full h-16 rounded-lg overflow-hidden bg-black/40 mb-1 border border-emerald-500/30 flex items-center justify-center">
                        <img src={fItem?.fotoDataUri} alt={fItem.rotulo} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-16 rounded-lg border border-dashed border-slate-700 bg-slate-900/50 mb-1 flex flex-col items-center justify-center text-slate-500">
                        <Camera className="w-5 h-5 mb-0.5 text-slate-600" />
                        <span className="text-[9px] font-medium">Espaço limpo</span>
                      </div>
                    )}

                    <div className="text-[10px] font-bold text-white truncate leading-tight" title={fItem.rotulo}>
                      {fItem.rotulo}
                    </div>
                  </div>
                );
              })}

              {/* Botão + Adicionar mais fotos */}
              <button
                type="button"
                onClick={() => {
                  db.adicionarSlotFotoCaixa(caixaAtiva, regionalAtiva);
                  recarregarDados(filtroCaixa);
                  setSucessoNotif('Novo slot de foto adicionado!');
                  setTimeout(() => setSucessoNotif(null), 2000);
                }}
                className="p-2 rounded-xl border-2 border-dashed border-blue-500/40 bg-blue-950/30 hover:bg-blue-900/40 text-blue-300 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer min-h-[90px]"
              >
                <Plus className="w-5 h-5 text-blue-400" />
                <span className="text-[10px] font-bold uppercase text-center leading-tight">Adicionar Foto (+)</span>
              </button>
            </div>
          </div>

          {/* Card 2: Seleção de Modelo & Código SKU */}
          <div className="bg-white rounded-2xl p-4 border-2 border-slate-300 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                Modelo & Código SKU
              </label>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                fabricanteAtivo === 'SAMSUNG'
                  ? 'bg-blue-100 text-blue-800'
                  : fabricanteAtivo === 'MOTOROLA'
                  ? 'bg-purple-100 text-purple-800'
                  : fabricanteAtivo === 'OPPO'
                  ? 'bg-emerald-100 text-emerald-800'
                  : fabricanteAtivo === 'APPLE'
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                FABRICANTE: {fabricanteAtivo || 'NÃO IDENTIFICADO'}
              </span>
            </div>

            {/* Atalhos Rápidos dos Modelos mais Frequentes */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {SAMSUNG_MODELOS_PRESET.slice(0, 6).map((m) => (
                <button
                  key={m.modelo}
                  type="button"
                  onClick={() => {
                    setModeloAtivo(m.modelo);
                    setEanAtivo(m.ean);
                    const fabResolvido = inferirFabricante(m.modelo, null, m.ean);
                    setFabricanteAtivo(fabResolvido);
                    focarInputSerial();
                  }}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                    modeloAtivo.toLowerCase() === m.modelo.toLowerCase()
                      ? 'bg-blue-900 text-white shadow-xs font-black ring-2 ring-blue-500'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m.modelo}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Modelo Selecionado:</span>
                <input
                  list="lista-modelos-samsung"
                  type="text"
                  value={modeloAtivo}
                  onChange={(e) => handleModeloChange(e.target.value)}
                  placeholder="Digite ou escolha o modelo..."
                  className="w-full text-sm font-black text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Código SKU {statusReferencia === 'LISTED' ? '(Bloqueado)' : '(Obrigatório)'}:
                </span>
                <input
                  type="text"
                  value={eanAtivo}
                  onChange={(e) => setEanAtivo(e.target.value)}
                  readOnly={statusReferencia === 'LISTED'}
                  placeholder={statusReferencia === 'LISTED' ? 'SKU...' : 'SKU obrigatório...'}
                  className={`w-full font-mono text-sm font-bold rounded-xl px-3 py-2 border-2 focus:outline-none ${
                    statusReferencia === 'LISTED'
                      ? 'bg-slate-100 text-slate-600 border-slate-300 cursor-not-allowed select-none'
                      : 'bg-white text-slate-900 border-emerald-500 focus:border-emerald-600'
                  }`}
                  title={statusReferencia === 'LISTED' ? 'SKU da base regional (somente leitura)' : 'Código SKU obrigatório para produto fora da lista'}
                />
              </div>
            </div>
          </div>

          {/* Card 3: BIPAGEM PRINCIPAL - CÓDIGO IMEI (15 DÍGITOS) */}
          <div className="bg-blue-50 border-2 border-blue-500 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="input-imei-mobile" className="text-sm font-black text-blue-950 uppercase flex items-center gap-2">
                <CornerDownLeft className="w-4 h-4 text-blue-600" />
                Bipagem de IMEI (15 Dígitos Numéricos)
              </label>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                Posicione o leitor ou digite (15 dígitos)
              </span>
            </div>

            {/* Input de IMEI Gigante */}
            <div className="relative">
              <input
                id="input-imei-mobile"
                aria-label="Bipagem de IMEI do aparelho (15 dígitos numéricos)"
                ref={serialMobileInputRef}
                type="text"
                inputMode="numeric"
                maxLength={15}
                disabled={isLoteAtualFinalizado && usuarioAtual?.perfil !== 'ADMINISTRADOR'}
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value.replace(/\D/g, '').slice(0, 15))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    processarBipagemLinha();
                  }
                }}
                placeholder={
                  isLoteAtualFinalizado && usuarioAtual?.perfil !== 'ADMINISTRADOR'
                    ? 'LOTE FINALIZADO (BLOQUEADO)'
                    : 'BIPAR IMEI (15 NÚMEROS)...'
                }
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                className={`w-full font-mono font-black text-xl sm:text-2xl text-slate-950 border-3 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-4 placeholder:text-slate-300 uppercase shadow-inner ${
                  isLoteAtualFinalizado && usuarioAtual?.perfil !== 'ADMINISTRADOR'
                    ? 'bg-rose-50 border-rose-400 cursor-not-allowed text-rose-800 placeholder:text-rose-400'
                    : 'bg-white border-blue-600 focus:ring-blue-300'
                }`}
              />
              {serialInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSerialInput('');
                    focarInputSerial();
                  }}
                  aria-label="Limpar campo de IMEI"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Indicador de Status da Lista de Referência (Mobile) */}
            {statusReferencia === 'LISTED' && referenciaDetectada && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>LISTADO • {referenciaDetectada.dealer_normalized}</span>
                </div>
                {referenciaDetectada.origin_invoice && (
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                    NF {referenciaDetectada.origin_invoice}
                  </span>
                )}
              </div>
            )}
            {statusReferencia === 'OUT_OF_LIST' && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>FORA DA LISTA • {fabricanteAtivo || 'FABRICANTE NÃO IDENTIFICADO'}</span>
                </div>
                <span className="text-[10px] text-amber-700 font-semibold">Conferir Modelo/SKU</span>
              </div>
            )}

            {/* Número do Lote (Mobile) */}
            <div className={`p-3.5 rounded-xl border-2 space-y-1.5 ${
              !loteAtivo.trim()
                ? 'bg-rose-50 border-rose-400'
                : 'bg-amber-50 border-amber-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase flex items-center gap-1 text-slate-800">
                  <Layers className="w-4 h-4 text-amber-600" />
                  Número do Lote: <span className="text-rose-500 font-bold">*</span>
                </span>
                {!loteAtivo.trim() && (
                  <span className="text-[10px] font-black text-rose-600 uppercase animate-pulse">Obrigatório</span>
                )}
              </div>
              <input
                type="text"
                value={loteAtivo}
                onChange={(e) => handleMudarLoteAtivo(e.target.value)}
                placeholder="Ex: 01"
                className="w-full font-black text-base uppercase bg-white border border-amber-400 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>


            {/* Condição Física / Lacre */}
            <div className="space-y-3">
              <div>
                {/* 1. Produto Lacrado */}
                <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 uppercase">
                      PRODUTO LACRADO:
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {lacreAtivo === 'SIM' ? 'LACRADO DE FÁBRICA' : 'ABERTO / SEM LACRE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLacreAtivo('SIM');
                        setKitAtivo('');
                        setMarcasAtivo('');
                        focarInputSerial();
                      }}
                      className={`py-2.5 px-2 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        lacreAtivo === 'SIM'
                          ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400 scale-[1.02]'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      🟢 SIM (LACRADO)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLacreAtivo('NÃO');
                      }}
                      className={`py-2.5 px-2 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        lacreAtivo === 'NÃO'
                          ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400 scale-[1.02]'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      NÃO (ABERTO)
                    </button>
                  </div>
                </div>
              </div>

              {/* Campos extras obrigatórios se produto NÃO for lacrado */}
              {lacreAtivo === 'NÃO' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 space-y-3 animate-in fade-in">
                  <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Produto aberto: Obrigatório conferir Kit e Marcas de Uso!
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-black text-slate-700 uppercase block mb-1">
                        Kit Completo:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setKitAtivo('SIM')}
                          className={`py-2 px-1 rounded-lg text-xs font-black uppercase cursor-pointer ${
                            kitAtivo === 'SIM'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          SIM
                        </button>
                        <button
                          type="button"
                          onClick={() => setKitAtivo('NÃO')}
                          className={`py-2 px-1 rounded-lg text-xs font-black uppercase cursor-pointer ${
                            kitAtivo === 'NÃO'
                              ? 'bg-rose-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          NÃO
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-black text-slate-700 uppercase block mb-1">
                        Marcas de Uso:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMarcasAtivo('NÃO')}
                          className={`py-2 px-1 rounded-lg text-xs font-black uppercase cursor-pointer ${
                            marcasAtivo === 'NÃO'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          NÃO
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarcasAtivo('SIM')}
                          className={`py-2 px-1 rounded-lg text-xs font-black uppercase cursor-pointer ${
                            marcasAtivo === 'SIM'
                              ? 'bg-rose-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          SIM
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black text-slate-700 uppercase block mb-1">
                      Observações de Avaria ou Faltas:
                    </span>
                    <input
                      type="text"
                      value={obsAtivo}
                      onChange={(e) => setObsAtivo(e.target.value)}
                      placeholder="Ex: Falta cabo, marcas na carcaça..."
                      className="w-full text-xs text-slate-900 bg-white border border-amber-400 rounded-lg px-2.5 py-1.5 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Botão de Gravação Touch Grande */}
            <button
              type="button"
              onClick={processarBipagemLinha}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-base uppercase py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
            >
              <CornerDownLeft className="w-5 h-5" />
              ⚡ Registrar e Bipar Próximo (Enter)
            </button>
          </div>

          {/* Card 4: Lista dos Últimos Itens Bipados na Caixa Atual */}
          <div className="bg-white rounded-2xl p-4 border-2 border-slate-300 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-blue-600" />
                Aparelhos na {caixaAtiva} ({produtos.length})
              </span>
              <button
                type="button"
                onClick={() => setModoVisualizacao('excel')}
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ver tabela completa ({produtos.length}) →
              </button>
            </div>

            {produtos.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-bold">
                Nenhum aparelho bipado nesta caixa ainda. Bipar acima para começar!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
                {produtos.slice().reverse().map((item, idx) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-black text-slate-900 truncate">
                          {item.imei || item.serial}
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            item.produto_lacrado === 'SIM'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.produto_lacrado === 'SIM' ? 'LACRADO' : 'ABERTO'}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            item.status_sincronizacao === 'ENVIADO'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : item.status_sincronizacao === 'ERRO_DUPLICADO'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-100 text-amber-700 border-amber-300'
                          }`}
                        >
                          {item.status_sincronizacao === 'ENVIADO'
                            ? 'Enviado para Online'
                            : item.status_sincronizacao === 'ERRO_DUPLICADO'
                            ? 'Duplicado Servidor'
                            : 'Aguardando envio para Online'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold truncate flex items-center gap-1.5 flex-wrap">
                        <span>{item.modelo_produto} • EAN {item.ean} • #{produtos.length - idx}</span>
                        {item.source_type === 'LISTED' && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            ✓ {item.dealer || 'LISTA'} {item.origin_invoice ? `• NF ${item.origin_invoice}` : ''}
                          </span>
                        )}
                        {item.source_type === 'OUT_OF_LIST' && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                            ⚠️ FORA DA LISTA
                          </span>
                        )}
                      </div>
                    </div>

                    {item.status_sincronizacao === 'ENVIADO' && usuarioAtual?.perfil !== 'ADMINISTRADOR' ? (
                      <span
                        title="Item enviado para o online. Apenas o Administrador pode excluir."
                        className="p-1.5 text-slate-400 cursor-not-allowed shrink-0 flex items-center"
                      >
                        <Lock className="w-4 h-4 text-slate-400" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleExcluirLinha(item.id, item.serial, item.status_sincronizacao)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                        title="Excluir item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ações Rápidas Mobile: Espelho, Relatórios e Limpar Tela */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIncluirSeriaisEspelho(false);
                handleAbrirEspelho();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase py-2.5 px-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Espelho da Caixa
            </button>

            <button
              type="button"
              onClick={handleAbrirFechamentoLote}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase py-2.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer ring-1 ring-amber-400"
              title="Fechamento oficial de lote com as 3 fotos obrigatórias"
            >
              <Lock className="w-4 h-4 text-slate-950" />
              Fechamento Lote
            </button>

            <button
              type="button"
              onClick={() => exportarRelatorioExcel(true)}
              className="bg-teal-700 hover:bg-teal-800 text-white font-black text-xs uppercase py-2.5 px-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Files className="w-4 h-4" />
              Relatório Geral
            </button>

            <button
              type="button"
              onClick={() => setMostrarModalLimparRegistros(true)}
              className="bg-slate-700 hover:bg-slate-800 text-white font-black text-xs uppercase py-2.5 px-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              title="Limpar registros da tela deste aparelho"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Tela
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODO PLANILHA EXCEL OPERACIONAL */
        /* ========================================================================= */
        <div className={`space-y-4 ${mostrarEspelhoModal ? 'no-print' : ''}`}>
        <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-slate-300 shadow-sm space-y-4">
        {/* Linha 1: Controles de Caixa e Botões Principais */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          
          {/* Controles de Lote e Caixa */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Regional Ativa Badge */}
            <div className="flex items-center gap-2 bg-blue-950 text-white px-3 py-1.5 rounded-xl shadow-xs border border-blue-800">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200">
                  Regional:
                </span>
                <span className="text-xs font-black text-amber-300 whitespace-nowrap">
                  {regionalAtiva}
                </span>
              </div>
            </div>

            {/* Computador / Estação Ativa Badge */}
            <div className="flex items-center gap-2 bg-indigo-950 text-white px-3 py-1.5 rounded-xl shadow-xs border border-indigo-800">
              <Laptop className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                  Estação:
                </span>
                <span className="text-xs font-black text-white whitespace-nowrap font-mono">
                  {computadorAtual.id} <span className="text-indigo-300 font-sans font-normal text-[10px]">({computadorAtual.nome})</span>
                </span>
              </div>
            </div>

            {/* Visualizar Caixa */}
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-xs">
              <Boxes className="w-4 h-4 text-blue-400 shrink-0" />
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap">
                Visualizar:
              </label>
              <select
                value={filtroCaixa}
                onChange={(e) => {
                  if (e.target.value === 'TODAS') {
                    setFiltroCaixa('TODAS');
                  } else {
                    tentarMudarCaixa(e.target.value);
                  }
                }}
                className="bg-transparent font-black text-sm text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="TODAS" className="text-slate-900 font-bold">
                  ★ TODAS AS CAIXAS ({db.listarProdutos().length} produtos)
                </option>
                {caixasExistentes.map((c) => (
                  <option key={c} value={c} className="text-slate-900 font-bold">
                    {c} ({db.obterContadoresCaixa(c).totalAuditados} produtos)
                  </option>
                ))}
                {!caixasExistentes.includes(filtroCaixa) && filtroCaixa !== 'TODAS' && (
                  <option value={filtroCaixa} className="text-slate-900 font-bold">
                    {filtroCaixa}
                  </option>
                )}
              </select>
            </div>

            {/* Bipando na Caixa */}
            <div className="flex items-center gap-2 bg-blue-50 border-2 border-blue-300 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-black text-blue-900 uppercase whitespace-nowrap">Bipando na:</span>
              <input
                list="lista-caixas-existentes"
                type="text"
                defaultValue={caixaAtiva}
                key={caixaAtiva}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && val !== caixaAtiva) {
                    tentarMudarCaixa(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Ex: Caixa 01"
                className="w-28 bg-white font-black text-xs text-blue-800 border border-blue-400 rounded px-2 py-0.5 focus:outline-none uppercase"
                title="Caixa editável. Valida evidências fotográficas antes de trocar."
              />
              <button
                type="button"
                onClick={abrirModalAlterarCaixa}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] uppercase px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                title="Trocar Caixa (Validação de Evidências Fotográficas)"
              >
                <Boxes className="w-3.5 h-3.5" />
                Alterar Caixa
              </button>
            </div>

            {/* Número do Lote */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 ${
              !loteAtivo.trim()
                ? 'bg-rose-50 border-rose-400 text-rose-900 ring-2 ring-rose-300'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}>
              <span className="text-[11px] font-black uppercase whitespace-nowrap flex items-center gap-0.5">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                Lote: <span className="text-rose-500 font-bold">*</span>
              </span>
              <input
                type="text"
                value={loteAtivo}
                onChange={(e) => handleMudarLoteAtivo(e.target.value)}
                placeholder="Ex: 01"
                className="w-20 bg-white font-black text-xs text-amber-900 border border-amber-400 rounded px-2 py-0.5 focus:outline-none uppercase"
                title="Número do Lote ativo (Obrigatório para bipagem e espelho)"
              />
            </div>

            {/* Status da Caixa Homogênea (Seção 19 Desktop) */}
            <div className="hidden lg:flex items-center gap-2 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Classificação:</span>
              <span className="font-black text-blue-950 text-[11px] max-w-[180px] truncate" title={configCaixaAtiva.vazia ? 'AGUARDANDO PRIMEIRO PRODUTO' : (configCaixaAtiva.classificacao || '-')}>
                {configCaixaAtiva.vazia ? 'AGUARDANDO PRIMEIRO PRODUTO' : (configCaixaAtiva.classificacao || '-')}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Condição:</span>
              <span className={`font-black text-[11px] ${configCaixaAtiva.vazia ? 'text-slate-500' : configCaixaAtiva.condicaoLacre === 'LACRADO' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {configCaixaAtiva.vazia ? '-' : configCaixaAtiva.condicaoLacre}
              </span>
            </div>



            {/* 2. Botão: O produto está lacrado? */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 px-2.5 py-1.5 rounded-xl text-xs">
              <span className="text-[11px] font-black text-slate-700 uppercase whitespace-nowrap mr-1">
                Produto Lacrado:
              </span>
              <button
                type="button"
                onClick={() => {
                  setLacreAtivo('SIM');
                  setKitAtivo('');
                  setMarcasAtivo('');
                  serialInputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] uppercase transition-all cursor-pointer ${
                  lacreAtivo === 'SIM'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Produto Lacrado de Fábrica: SIM"
              >
                SIM (Lacrado)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLacreAtivo('NÃO');
                  serialInputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] uppercase transition-all cursor-pointer ${
                  lacreAtivo === 'NÃO'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Produto Aberto / Sem Lacre: NÃO"
              >
                NÃO (Aberto)
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BOTÕES DE AÇÃO: ESPELHO, FOTOS, RELATÓRIO GERAL E SEGURANÇA */}
          {/* ========================================================================= */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            {/* 0. Fotos da Caixa */}
            <button
              type="button"
              onClick={abrir10FotosCaixaAtiva}
              className={`font-black text-xs uppercase px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                totalFotos10CaixaAtiva >= 2
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-500'
                  : 'bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-600'
              }`}
              title="Fotos dos produtos da caixa atual"
            >
              <Camera className="w-3.5 h-3.5 text-amber-300" />
              Fotos Caixa ({totalFotos10CaixaAtiva})
            </button>

            {/* 1. Nova Caixa */}
            <button
              onClick={handleNovaAuditoria}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
              title="Iniciar nova caixa ou lote"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Caixa
            </button>

            {/* 2. Gerar Espelho da Caixa */}
            <button
              onClick={() => {
                setIncluirSeriaisEspelho(false);
                handleAbrirEspelho();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Espelho da Caixa (Modelo, EAN, Quantidade e Logos)"
            >
              <FileText className="w-3.5 h-3.5" />
              Gerar Espelho
            </button>

            {/* 3. Fechamento Oficial do Lote (Novo Fluxo Oficial) */}
            <button
              onClick={handleAbrirFechamentoLote}
              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer ring-1 ring-amber-400"
              title="Fechamento oficial do lote com as 3 fotos obrigatórias"
            >
              <Lock className="w-3.5 h-3.5 text-slate-950" />
              Fechamento de Lote
            </button>

            {/* 4. Relatório Geral de Todas as Caixas (EXCEL GERAL) */}
            <button
              onClick={() => exportarRelatorioExcel(true)}
              className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Baixar Relatório Geral consolidado com TODAS as caixas em Excel"
            >
              <Files className="w-3.5 h-3.5" />
              Relatório Geral (Excel)
            </button>

            {/* 5. Relatório Geral de Todas as Caixas (PDF GERAL) */}
            <button
              onClick={() => exportarRelatorioPDF(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Baixar Relatório Geral consolidado com TODAS as caixas em PDF"
            >
              <Download className="w-3.5 h-3.5" />
              Relatório Geral (PDF)
            </button>

            {/* 8. Limpar Registros da Tela */}
            <button
              type="button"
              onClick={() => setMostrarModalLimparRegistros(true)}
              className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Limpar a tela deste computador mantendo os registros enviados salvos na nuvem"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Tela
            </button>
          </div>
        </div>

        {/* WIDGET OPERACIONAL DE EVIDÊNCIAS FOTOGRÁFICAS */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-3 text-white border border-slate-700 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Evidências Fotográficas da {caixaAtiva}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                      totalFotos10CaixaAtiva >= 2
                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                        : 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                    }`}
                  >
                    {totalFotos10CaixaAtiva} foto{totalFotos10CaixaAtiva !== 1 ? 's' : ''} anexada{totalFotos10CaixaAtiva !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">
                  Fotos dos produtos da caixa: Foto dos produtos 1 e Foto dos produtos 2 (clique em + para adicionar mais fotos se necessário).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  db.adicionarSlotFotoCaixa(caixaAtiva, regionalAtiva);
                  recarregarDados(filtroCaixa);
                  setSucessoNotif('Novo slot de foto adicionado!');
                  setTimeout(() => setSucessoNotif(null), 2000);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Adicionar mais um slot de foto para esta caixa"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Foto (+)
              </button>
              <button
                type="button"
                onClick={() => abrir10FotosCaixaAtiva(1)}
                className={`font-black text-xs uppercase px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                  totalFotos10CaixaAtiva >= 2
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                {totalFotos10CaixaAtiva > 0 ? 'Visualizar / Gerenciar Fotos' : 'Capturar Fotos'}
              </button>
            </div>
          </div>

          {/* Slots Dinâmicos das Fotos da Caixa Ativa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {(registro10Atual?.fotos || []).map((fItem) => {
              const temF = !!fItem?.fotoDataUri && fItem.fotoDataUri.length > 50;

              return (
                <div
                  key={fItem.indice}
                  onClick={() => abrir10FotosCaixaAtiva(fItem.indice)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer relative group ${
                    temF
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100 hover:bg-emerald-900/50'
                      : 'bg-slate-800/80 border-dashed border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-400'
                  }`}
                  title={`${fItem.rotulo} - ${temF ? 'Foto Registrada' : 'Espaço limpo - clique para fotografar'}`}
                >
                  {temF ? (
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/40 shrink-0 border border-emerald-500/40">
                      <img src={fItem?.fotoDataUri} alt={fItem.rotulo} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/50 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-5 h-5 text-slate-400" />
                      <span className="text-[9px] font-mono mt-0.5">#{fItem.indice}</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-black uppercase text-white truncate">
                        {fItem.rotulo || `Foto dos produtos ${fItem.indice}`}
                      </span>
                      {fItem.indice > 2 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            db.removerSlotFotoCaixa(caixaAtiva, fItem.indice, regionalAtiva);
                            recarregarDados(filtroCaixa);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                          title="Remover foto adicional"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {temF ? (
                        <span className="text-[9px] font-black uppercase bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                          <Check className="w-3 h-3" /> OK
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full shrink-0">
                          Espaço Limpo
                        </span>
                      )}
                      <p className="text-[11px] text-slate-400 font-medium truncate">
                        {temF ? 'Foto salva' : fItem.descricao || 'Clique para anexar'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Card para Adicionar Mais Fotos */}
            <button
              type="button"
              onClick={() => {
                db.adicionarSlotFotoCaixa(caixaAtiva, regionalAtiva);
                recarregarDados(filtroCaixa);
                setSucessoNotif('Novo slot de foto adicionado!');
                setTimeout(() => setSucessoNotif(null), 2000);
              }}
              className="p-3 rounded-xl border-2 border-dashed border-blue-500/50 hover:border-blue-400 bg-blue-950/20 hover:bg-blue-900/30 text-blue-300 flex items-center justify-center gap-2 font-black text-xs uppercase transition-all cursor-pointer min-h-[76px]"
            >
              <Plus className="w-5 h-5 text-blue-400" />
              Adicionar Mais Fotos (+)
            </button>
          </div>
        </div>


        {/* Linha 2: Indicadores em Tempo Real e Status de Proteção */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              {filtroCaixa === 'TODAS' ? 'Total Todas Caixas' : `Total ${caixaAtiva}`}
            </span>
            <span className="text-xl font-black text-slate-900">
              {filtroCaixa === 'TODAS' ? db.listarProdutos().length : contadores.totalAuditados}
            </span>
            <span className="text-[9px] text-slate-400 block">produtos na caixa</span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Caixa Ativa</span>
            <span className="text-xl font-black text-blue-700 uppercase truncate px-1 block">{caixaAtiva}</span>
            <span className="text-[9px] text-blue-500 font-bold block">100% editável</span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Status da Caixa</span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full border mt-1 ${
                statusCaixaAtiva === 'Enviado Online'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  statusCaixaAtiva === 'Enviado Online' ? 'bg-emerald-600' : 'bg-amber-600 animate-pulse'
                }`}
              />
              {statusCaixaAtiva}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              {statusCaixaAtiva === 'Enviado Online' ? 'Disponível no Online' : 'Sistema Interno'}
            </span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Lacrados (SIM)</span>
            <span className="text-xl font-black text-emerald-700">
              {filtroCaixa === 'TODAS'
                ? db.listarProdutos().filter((p) => p.produto_lacrado === 'SIM').length
                : contadores.produtosLacrados}
            </span>
          </div>
          <div className="border-r border-slate-200 last:border-0">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Não Lacrados (NÃO)</span>
            <span className="text-xl font-black text-amber-700">
              {filtroCaixa === 'TODAS'
                ? db.listarProdutos().filter((p) => p.produto_lacrado === 'NÃO').length
                : contadores.produtosNaoLacrados}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Proteção de Dados
            </span>
            <span className="text-xs font-black text-emerald-800 mt-1 block">
              IndexedDB Ativo
            </span>
            <span className="text-[9px] text-emerald-600 font-bold block">Gravado em 2 bancos</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TABELA OPERACIONAL EM FORMATO PLANILHA EXCEL */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden w-full">
        <div className="bg-emerald-800 text-white px-3.5 py-2 flex items-center justify-between text-xs font-bold select-none">
          <div className="flex items-center gap-2">
            <span className="bg-white text-emerald-800 font-mono font-black px-1.5 py-0.5 rounded text-[10px] uppercase">
              XLS
            </span>
            <span className="uppercase tracking-wider">
              Planilha Operacional de Auditoria • {filtroCaixa === 'TODAS' ? 'Todas as Caixas' : filtroCaixa}
            </span>
          </div>
          <div className="flex items-center gap-4 text-emerald-100 text-[11px]">
            <span>{produtos.length} aparelhos listados</span>
            <span className="hidden sm:inline">• EAN, IMEI e Caixa 100% editáveis</span>
          </div>
        </div>

        <div className="overflow-x-auto h-[calc(100vh-250px)] max-h-[calc(100vh-220px)] min-h-[500px] overflow-y-auto w-full">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-200 text-slate-800 uppercase font-black text-[11px] tracking-wider sticky top-0 z-20 border-b-2 border-slate-300 select-none shadow-2xs">
              <tr>
                <th className="py-1.5 px-2 w-10 text-center bg-slate-300 border-r border-slate-300">#</th>
                <th className="py-1.5 px-2 border-r border-slate-300 min-w-[85px] bg-slate-100 text-center">Estação 💻</th>
                <th className="py-1.5 px-2 border-r border-slate-300 w-24 text-center">Fabricante</th>
                <th className="py-1.5 px-2 border-r border-slate-300 min-w-[220px]">Modelo Produto ✏️</th>
                <th className="py-1.5 px-2 border-r border-slate-300 font-mono min-w-[110px]">SKU ✏️</th>
                <th className="py-1.5 px-3 border-r border-slate-300 min-w-[160px] bg-blue-100 text-blue-950">
                  IMEI (Bipar / Editar) ⚡
                </th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center min-w-[110px] bg-slate-100 text-slate-900">
                  NF Origem
                </th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-24">Data Auditoria</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center min-w-[95px] bg-indigo-50 text-indigo-950">
                  Caixa ✏️
                </th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center min-w-[95px] bg-amber-50 text-amber-950">
                  Lote ✏️
                </th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center min-w-[150px] bg-blue-50 text-blue-950">
                  Classificação
                </th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-24">Produto Lacrado</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-20">Kit Completo</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-20">Marcas de Uso</th>
                <th className="py-1.5 px-2 border-r border-slate-300 min-w-[120px]">Observação</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center min-w-[85px]">Status Sync</th>
                <th className="py-1.5 px-1.5 text-center w-14">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {produtos.map((item, index) => {
                const isEditing = linhaEditandoId === item.id;

                if (isEditing) {
                  return (
                    <tr key={item.id} className="bg-amber-50 border-2 border-amber-400">
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-500 bg-amber-100 border-r border-amber-200">
                        {index + 1}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-[10px] font-bold text-slate-700 bg-amber-100/50 border-r border-amber-200 whitespace-nowrap">
                        💻 {item.computador_id || 'PC-01'}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-700 border-r border-amber-200 whitespace-nowrap">
                        {item.brand || item.fabricante || inferirFabricante(editModelo, null)}
                      </td>

                      {/* Modelo Produto */}
                      <td className="py-2 px-2 border-r border-amber-200 min-w-[220px]">
                        <input
                          list="lista-modelos-samsung"
                          type="text"
                          value={editModelo}
                          onChange={(e) => setEditModelo(e.target.value)}
                          className="w-full text-xs font-bold text-slate-900 bg-white border border-amber-400 rounded px-2 py-1"
                        />
                      </td>

                      {/* SKU */}
                      <td className="py-2 px-2 border-r border-amber-200 min-w-[110px]">
                        <input
                          type="text"
                          value={editEan}
                          onChange={(e) => setEditEan(e.target.value)}
                          placeholder="SKU..."
                          className="w-full font-mono text-xs font-bold text-slate-900 bg-white border border-amber-400 rounded px-2 py-1"
                        />
                      </td>

                      {/* IMEI */}
                      <td className="py-2 px-2 border-r border-amber-200 bg-amber-100/50 min-w-[160px]">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={15}
                          value={editSerial}
                          onChange={(e) => setEditSerial(e.target.value.replace(/\D/g, '').slice(0, 15))}
                          className="w-full font-mono text-xs font-black text-slate-950 bg-white border-2 border-amber-500 rounded px-2 py-1 uppercase tracking-wider"
                        />
                      </td>

                      {/* NF Origem */}
                      <td className="py-2 px-2 text-center border-r border-amber-200 font-mono text-xs text-slate-700 whitespace-nowrap select-none">
                        {item.origin_invoice || item.nf_origem || item.numero_nf || 'NÃO LOCALIZADA NA BASE'}
                      </td>

                      {/* Data */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        <input
                          type="text"
                          value={editData}
                          onChange={(e) => setEditData(e.target.value)}
                          className="w-full text-center text-xs font-semibold text-slate-800 bg-white border border-amber-400 rounded px-1.5 py-1"
                        />
                      </td>

                      {/* Caixa */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        <input
                          list="lista-caixas-existentes"
                          type="text"
                          value={editCaixa}
                          onChange={(e) => setEditCaixa(e.target.value)}
                          className="w-full text-center text-xs font-black text-blue-900 bg-white border-2 border-blue-400 rounded px-1.5 py-1 uppercase"
                        />
                      </td>

                      {/* Lote */}
                      <td className="py-2 px-2 text-center border-r border-amber-200 bg-amber-50/40">
                        <input
                          type="text"
                          value={editLote}
                          onChange={(e) => setEditLote(e.target.value)}
                          placeholder="LOTE 1"
                          className="w-full text-center text-xs font-black text-amber-900 bg-white border-2 border-amber-500 rounded px-1.5 py-1 uppercase"
                          title="Número do Lote"
                        />
                      </td>

                      {/* Classificação */}
                      <td className="py-2 px-2 text-center border-r border-amber-200 font-black text-[10px] text-slate-700 whitespace-nowrap">
                        {item.classificacao_produto || item.product_classification || '-'}
                      </td>

                      {/* Produto Lacrado */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        <select
                          value={editLacre}
                          onChange={(e) => setEditLacre(e.target.value as SimNao)}
                          className="text-[11px] font-black px-2 py-1 rounded border bg-white cursor-pointer"
                        >
                          <option value="SIM">SIM</option>
                          <option value="NÃO">NÃO</option>
                        </select>
                      </td>

                      {/* Kit Completo */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        {editLacre === 'SIM' ? (
                          <span className="text-slate-400 font-bold">-</span>
                        ) : (
                          <select
                            value={editKit}
                            onChange={(e) => setEditKit(e.target.value as SimNao)}
                            className="text-[11px] font-bold bg-white border border-amber-400 rounded p-1"
                          >
                            <option value="">Selecione</option>
                            <option value="SIM">SIM</option>
                            <option value="NÃO">NÃO</option>
                          </select>
                        )}
                      </td>

                      {/* Marcas de Uso */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        {editLacre === 'SIM' ? (
                          <span className="text-slate-400 font-bold">-</span>
                        ) : (
                          <select
                            value={editMarcas}
                            onChange={(e) => setEditMarcas(e.target.value as SimNao)}
                            className="text-[11px] font-bold bg-white border border-amber-400 rounded p-1"
                          >
                            <option value="">Selecione</option>
                            <option value="NÃO">NÃO</option>
                            <option value="SIM">SIM</option>
                          </select>
                        )}
                      </td>

                      {/* Observação */}
                      <td className="py-2 px-2 border-r border-amber-200">
                        <input
                          type="text"
                          value={editObs}
                          onChange={(e) => setEditObs(e.target.value)}
                          className="w-full text-xs text-slate-800 bg-white border border-amber-300 rounded px-2 py-1"
                        />
                      </td>

                      {/* Status Sync */}
                      <td className="py-2 px-2 text-center border-r border-amber-200">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.status_sincronizacao || 'PENDENTE'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => salvarEdicaoLinha(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded cursor-pointer"
                            title="Salvar alteração (Enter)"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelarEdicaoLinha}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1 rounded cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={item.id}
                    onDoubleClick={() => iniciarEdicaoLinha(item)}
                    className={`hover:bg-blue-50/60 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                    }`}
                    title="Dê um duplo clique para editar esta linha"
                  >
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-400 bg-slate-100/70 border-r border-slate-200">
                      {index + 1}
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[10px] font-bold text-slate-700 bg-slate-100/70 border-r border-slate-200 whitespace-nowrap">
                      💻 {item.computador_id || 'PC-01'}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {item.brand || item.fabricante || 'FABRICANTE NÃO IDENTIFICADO'}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-200 min-w-[220px] max-w-[340px] whitespace-normal break-words" title={item.modelo_produto}>
                      {item.modelo_produto}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600 font-medium border-r border-slate-200 whitespace-nowrap">
                      {item.sku || item.ean}
                    </td>
                    <td className="py-2 px-4 font-mono font-black text-slate-900 tracking-wider border-r border-slate-200 bg-blue-50/30">
                      <div>{item.imei || item.serial}</div>
                      {item.source_type === 'LISTED' && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-0.5">
                            ✓ {item.dealer || 'LISTA'}
                          </span>
                        </div>
                      )}
                      {item.source_type === 'OUT_OF_LIST' && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-0.5">
                            ⚠️ FORA DA LISTA
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap" title={item.origin_invoice || item.nf_origem || item.numero_nf || 'NÃO LOCALIZADA NA BASE'}>
                      {item.origin_invoice || item.nf_origem || item.numero_nf || 'NÃO LOCALIZADA NA BASE'}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-200">
                      {item.data_auditoria}
                    </td>
                    <td className="py-2 px-3 text-center font-black text-blue-700 border-r border-slate-200 bg-blue-50/20">
                      {item.box_name || item.numero_caixa}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-200 bg-amber-50/20">
                      <span className="font-black px-2 py-0.5 rounded text-[10px] border bg-amber-100 text-amber-800 border-amber-300 whitespace-nowrap">
                        {item.numero_lote || 'LOTE 1'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-200 bg-blue-50/20">
                      <span className="font-black px-2 py-0.5 rounded text-[10px] border bg-blue-100 text-blue-900 border-blue-300 whitespace-nowrap block truncate max-w-[220px]" title={item.classificacao_produto || item.product_classification || '-'}>
                        {item.classificacao_produto || item.product_classification || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center border-r border-slate-200">
                      <span
                        className={`font-black px-2.5 py-0.5 rounded text-[10px] ${
                          item.produto_lacrado === 'SIM'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.produto_lacrado}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-bold border-r border-slate-200">
                      {item.produto_lacrado === 'SIM' ? (
                        <span className="text-slate-300">-</span>
                      ) : (
                        <span className={item.kit_completo === 'SIM' ? 'text-emerald-700 font-black' : 'text-rose-600 font-black'}>
                          {item.kit_completo || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-bold border-r border-slate-200">
                      {item.produto_lacrado === 'SIM' ? (
                        <span className="text-slate-300">-</span>
                      ) : item.aparelho_marcas_uso === 'SIM' ? (
                        <span className="text-rose-600 font-black">SIM</span>
                      ) : (
                        <span className="text-emerald-700 font-bold">{item.aparelho_marcas_uso || '-'}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-600 italic border-r border-slate-200 truncate max-w-[160px]">
                      {item.observacao || '-'}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-200 whitespace-nowrap">
                      {item.status_sincronizacao === 'ERRO_DUPLICADO' ? (
                        <span
                          className="inline-flex items-center gap-1 font-black text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 animate-pulse"
                          title={item.erro_sincronizacao || 'IMEI duplicado no servidor online'}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                          Duplicado Servidor
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                            item.status_sincronizacao === 'ENVIADO'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.status_sincronizacao === 'ENVIADO'
                                ? 'bg-emerald-600'
                                : 'bg-amber-600 animate-pulse'
                            }`}
                          />
                          {item.status_sincronizacao === 'ENVIADO'
                            ? 'Enviado para Online'
                            : 'Aguardando envio para Online'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {item.status_sincronizacao === 'ENVIADO' && usuarioAtual?.perfil !== 'ADMINISTRADOR' ? (
                          <span
                            title="Item enviado para o online. Apenas o Administrador pode editar."
                            className="text-slate-400 p-1 cursor-not-allowed inline-flex items-center"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                        ) : (
                          <button
                            onClick={() => iniciarEdicaoLinha(item)}
                            title="Editar esta linha (ou duplo clique)"
                            className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.status_sincronizacao === 'ENVIADO' && usuarioAtual?.perfil !== 'ADMINISTRADOR' ? (
                          <span
                            title="Item enviado para o online. Apenas o Administrador pode excluir."
                            className="text-slate-400 p-1 cursor-not-allowed inline-flex items-center"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          </span>
                        ) : (
                          <button
                            onClick={() => handleExcluirLinha(item.id, item.serial, item.status_sincronizacao)}
                            title="Remover linha"
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* LINHA ATIVA DE ENTRADA / BIPAGEM CONTÍNUA */}
              <tr className="bg-emerald-50/80 border-t-2 border-b-2 border-emerald-600 ring-2 ring-emerald-500/50 sticky bottom-0 z-10 shadow-lg">
                <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-100 border-r border-emerald-300">
                  {produtos.length + 1} ▶
                </td>
                <td className="py-2 px-2 text-center font-mono text-[10px] font-bold text-emerald-950 bg-emerald-100/70 border-r border-emerald-300 whitespace-nowrap">
                  💻 {computadorAtual.id}
                </td>
                <td className="py-2 px-3 font-black text-slate-800 border-r border-emerald-300 whitespace-nowrap">
                  {fabricanteAtivo}
                </td>

                {/* MODELO PRODUTO */}
                <td className="py-2 px-2 border-r border-emerald-300 min-w-[220px]">
                  <input
                    list="lista-modelos-samsung"
                    type="text"
                    value={modeloAtivo}
                    onChange={(e) => handleModeloChange(e.target.value)}
                    placeholder="Ex: Galaxy S24"
                    className="w-full text-xs font-black text-slate-900 bg-white border border-slate-300 rounded px-2 py-1.5 focus:border-emerald-600 focus:outline-none"
                    title="Digite ou selecione o modelo"
                  />
                </td>

                {/* SKU */}
                <td className="py-2 px-2 border-r border-emerald-300 min-w-[110px]">
                  <input
                    type="text"
                    value={eanAtivo}
                    onChange={(e) => setEanAtivo(e.target.value)}
                    readOnly={statusReferencia === 'LISTED'}
                    placeholder={statusReferencia === 'LISTED' ? 'SKU...' : 'SKU obrigatório...'}
                    className={`w-full font-mono text-xs rounded px-2 py-1.5 focus:outline-none ${
                      statusReferencia === 'LISTED'
                        ? 'bg-slate-100 font-bold text-slate-600 border border-slate-300 cursor-not-allowed select-none'
                        : 'bg-white font-black text-slate-900 border-2 border-emerald-500 focus:ring-1 focus:ring-emerald-600'
                    }`}
                    title={statusReferencia === 'LISTED' ? 'SKU preenchido automaticamente pela lista (somente leitura)' : 'Código SKU obrigatório para produto fora da lista'}
                  />
                </td>

                {/* IMEI */}
                <td className="py-2 px-2 border-r border-emerald-300 bg-white min-w-[160px]">
                  <input
                    id="input-imei-desktop"
                    aria-label="Posicione o cursor e bipe o IMEI com 15 dígitos"
                    ref={serialInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={15}
                    disabled={isLoteAtualFinalizado && usuarioAtual?.perfil !== 'ADMINISTRADOR'}
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value.replace(/\D/g, '').slice(0, 15))}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isLoteAtualFinalizado && usuarioAtual?.perfil !== 'ADMINISTRADOR'
                        ? 'Lote finalizado (bloqueado)'
                        : 'Bipe o IMEI (15 dígitos)...'
                    }
                    className={`w-full font-mono font-black text-sm text-slate-950 border-2 rounded px-2.5 py-1.5 focus:outline-none tracking-wider placeholder:text-slate-400 ${
                      isLoteAtualFinalizado && usuarioAtual?.perfil !== 'ADMINISTRADOR'
                        ? 'bg-rose-50 border-rose-400 cursor-not-allowed text-rose-800 placeholder:text-rose-400'
                        : 'bg-blue-50/50 border-blue-600'
                    }`}
                    autoFocus={!(isLoteAtualFinalizado && usuarioAtual?.perfil !== 'ADMINISTRADOR')}
                    title={
                      isLoteAtualFinalizado && usuarioAtual?.perfil !== 'ADMINISTRADOR'
                        ? 'Lote finalizado e bloqueado'
                        : 'Posicione o cursor aqui e bipe o IMEI (15 dígitos)'
                    }
                  />
                  {statusReferencia === 'LISTED' && referenciaDetectada && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {referenciaDetectada.dealer_normalized}
                      </span>
                      {referenciaDetectada.origin_invoice && (
                        <span className="px-1 py-0.5 font-mono text-[9px] rounded bg-slate-100 text-slate-600 border border-slate-300">
                          NF {referenciaDetectada.origin_invoice}
                        </span>
                      )}
                    </div>
                  )}
                  {statusReferencia === 'OUT_OF_LIST' && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-800">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        FORA DA LISTA
                      </span>
                    </div>
                  )}
                </td>

                {/* NF ORIGEM */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 font-mono text-xs text-slate-700 whitespace-nowrap bg-emerald-50/50 select-none min-w-[110px]">
                  {statusReferencia === 'LISTED'
                    ? (referenciaDetectada?.origin_invoice || '-')
                    : statusReferencia === 'OUT_OF_LIST'
                    ? 'NÃO LOCALIZADA NA BASE'
                    : '-'}
                </td>

                {/* DATA AUDITORIA */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 w-24">
                  <input
                    type="text"
                    value={dataAtiva}
                    onChange={(e) => setDataAtiva(e.target.value)}
                    className="w-full text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:outline-none"
                    title="Data da auditoria"
                  />
                </td>

                {/* CAIXA */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 bg-blue-50/50 min-w-[95px]">
                  <input
                    list="lista-caixas-existentes"
                    type="text"
                    value={caixaAtiva}
                    onChange={(e) => setCaixaAtiva(e.target.value)}
                    placeholder="Ex: Caixa 01"
                    className="w-full text-center text-xs font-black text-blue-900 bg-white border-2 border-blue-500 rounded px-2 py-1.5 focus:outline-none uppercase"
                    title="Caixa editável. Sem limite de produtos!"
                  />
                </td>

                {/* NÚMERO DO LOTE */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 bg-amber-50/50 min-w-[95px]">
                  <input
                    type="text"
                    value={loteAtivo}
                    onChange={(e) => handleMudarLoteAtivo(e.target.value)}
                    placeholder="LOTE 1"
                    className="w-full text-center text-xs font-black text-amber-900 bg-white border-2 border-amber-500 rounded px-2 py-1.5 focus:outline-none uppercase"
                    title="Número do Lote ativo (digitado pelo colaborador)"
                  />
                </td>

                {/* CLASSIFICAÇÃO */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 bg-blue-50/40 min-w-[150px]">
                  {classificacaoAtiva ? (
                    <span className="font-black px-2 py-0.5 rounded text-[10px] border bg-blue-100 text-blue-900 border-blue-300 whitespace-nowrap block truncate max-w-[220px]" title={classificacaoAtiva}>
                      {classificacaoAtiva}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-bold text-[10px]">-</span>
                  )}
                </td>

                {/* PRODUTO LACRADO */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 w-24">
                  <select
                    value={lacreAtivo}
                    onChange={(e) => {
                      const val = e.target.value as SimNao;
                      setLacreAtivo(val);
                      if (val === 'SIM') {
                        setKitAtivo('');
                        setMarcasAtivo('');
                        serialInputRef.current?.focus();
                      } else {
                        setTimeout(() => kitSelectRef.current?.focus(), 50);
                      }
                    }}
                    className={`w-full text-[11px] font-black px-2 py-1.5 rounded-md border focus:outline-none cursor-pointer ${
                      lacreAtivo === 'SIM'
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-amber-600 text-white border-amber-700'
                    }`}
                  >
                    <option value="SIM">SIM</option>
                    <option value="NÃO">NÃO</option>
                  </select>
                </td>

                {/* KIT COMPLETO */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 w-20">
                  {lacreAtivo === 'SIM' ? (
                    <span className="text-slate-400 font-bold">-</span>
                  ) : (
                    <select
                      ref={kitSelectRef}
                      value={kitAtivo}
                      onChange={(e) => {
                        setKitAtivo(e.target.value as SimNao);
                        marcasSelectRef.current?.focus();
                      }}
                      className="w-full text-[11px] font-bold bg-white border border-amber-500 rounded p-1 text-slate-900 cursor-pointer"
                    >
                      <option value="">Selecione</option>
                      <option value="SIM">SIM</option>
                      <option value="NÃO">NÃO</option>
                    </select>
                  )}
                </td>

                {/* MARCAS DE USO */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 w-20">
                  {lacreAtivo === 'SIM' ? (
                    <span className="text-slate-400 font-bold">-</span>
                  ) : (
                    <select
                      ref={marcasSelectRef}
                      value={marcasAtivo}
                      onChange={(e) => setMarcasAtivo(e.target.value as SimNao)}
                      className="w-full text-[11px] font-bold bg-white border border-amber-500 rounded p-1 text-slate-900 cursor-pointer"
                    >
                      <option value="">Selecione</option>
                      <option value="NÃO">NÃO</option>
                      <option value="SIM">SIM</option>
                    </select>
                  )}
                </td>

                {/* OBSERVAÇÃO */}
                <td className="py-2 px-2 border-r border-emerald-300 min-w-[120px]">
                  <input
                    type="text"
                    value={obsAtivo}
                    onChange={(e) => setObsAtivo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        processarBipagemLinha();
                      }
                    }}
                    placeholder="Obs livre..."
                    className="w-full text-xs text-slate-900 bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none"
                  />
                </td>

                {/* STATUS SYNC PADRÃO (PENDENTE) */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 whitespace-nowrap min-w-[85px]">
                  <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                    Pendente
                  </span>
                </td>

                {/* BOTÃO ENTER */}
                <td className="py-2 px-2 text-center w-14">
                  <button
                    type="button"
                    onClick={processarBipagemLinha}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[11px] uppercase px-2 py-1.5 rounded shadow-xs flex items-center justify-center mx-auto gap-1 cursor-pointer"
                    title="Adicionar linha (Enter)"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div ref={tableBottomRef} />
        </div>

        {/* Rodapé de Status */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-bold text-slate-600 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Pronto para bipagem contínua
            </span>
            <span>Caixa Ativa: <strong className="text-blue-800">{caixaAtiva}</strong></span>
            <span>Regional: <strong className="text-purple-800">{regionalAtiva}</strong></span>
            <span>Quantidade: <strong className="text-slate-900">{produtos.length} aparelhos</strong> (sem limite)</span>
          </div>
          <div className="text-slate-500 font-normal">
            💡 EAN, IMEI e Caixa podem ser alterados diretamente em cada linha ou com duplo clique.
          </div>
        </div>
      </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL: GERADOR DE ESPELHO DA CAIXA (COM LOGOS SOLUTIONS E SAMSUNG) */}
      {/* Mostra Modelo, EAN e Quantidade desse modelo representando esse EAN */}
      {/* SEM colunas de lacre, kit ou marcas (que pertencem aos relatórios) */}
      {/* ========================================================================= */}
      <ModalEspelhoCaixa
        isOpen={mostrarEspelhoModal}
        onClose={() => setMostrarEspelhoModal(false)}
        espelhoCaixaAtual={espelhoCaixaAtual}
        loteAtivo={loteAtivo}
        regionalAtiva={regionalAtiva}
        usuarioAtual={usuarioAtual}
        tipoEspelhoVisualizacao={tipoEspelhoVisualizacao}
        setTipoEspelhoVisualizacao={setTipoEspelhoVisualizacao}
        incluirSeriaisEspelho={incluirSeriaisEspelho}
        setIncluirSeriaisEspelho={setIncluirSeriaisEspelho}
        exportarEspelhoPDF={exportarEspelhoPDF}
        exportarEspelhoTransportePDF={exportarEspelhoTransportePDF}
        baixarAmbosEspelhos={baixarAmbosEspelhos}
        handleImprimirEspelho={handleImprimirEspelho}
      />

      {/* ========================================================================= */}
      {/* 4. MODAL: NOVA AUDITORIA / NOVA CAIXA */}
      {/* ========================================================================= */}
      <ModalNovaCaixa
        isOpen={mostrarNovaCaixaModal}
        onClose={() => setMostrarNovaCaixaModal(false)}
        novaCaixaNome={novaCaixaNome}
        setNovaCaixaNome={setNovaCaixaNome}
        onConfirmar={confirmarCriacaoNovaCaixa}
      />

      {/* ========================================================================= */}
      {/* 5. MODAL: IMPORTAÇÃO EXCEL EM LOTE */}
      {/* ========================================================================= */}
      <ModalImportacaoRapida
        isOpen={mostrarImportModal}
        onClose={() => setMostrarImportModal(false)}
        modeloAtivo={modeloAtivo}
        eanAtivo={eanAtivo}
        caixaAtiva={caixaAtiva}
        filtroCaixa={filtroCaixa}
        getDataAtualFormatada={getDataAtualFormatada}
        recarregarDados={recarregarDados}
      />

      {/* 9. MODAL: ALTERAR CAIXA OPERACIONAL */}
      <ModalAlterarCaixa
        isOpen={mostrarAlterarCaixaModal}
        onClose={() => setMostrarAlterarCaixaModal(false)}
        caixaAtiva={caixaAtiva}
        caixaParaMudarInput={caixaParaMudarInput}
        setCaixaParaMudarInput={setCaixaParaMudarInput}
        caixasExistentes={caixasExistentes}
        onConfirmar={confirmarAlterarCaixaModal}
      />

      {/* 10. MODAL: CAPTURA DE FOTOS DA CAIXA */}
      <ModalCaptura10FotosCaixa
        key={`${caixaPara10Fotos || caixaAtiva}-${modal10FotosAberto}-${slotFotoSelecionado}`}
        isOpen={modal10FotosAberto}
        caixa={caixaPara10Fotos || caixaAtiva}
        regional={regionalAtiva}
        slotInicial={slotFotoSelecionado}
        onClose={() => {
          setModal10FotosAberto(false);
          setCaixaDestinoTentativa(null);
          setAcaoApos10Fotos(null);
        }}
        onConcluido={handle10FotosConcluidas}
      />

      {/* 10.5. MODAL: CONFIRMAÇÃO DE FOTOS ANTES DE MUDAR DE CAIXA (SIM / NÃO COM MOTIVO) */}
      <ModalConfirmacaoTrocaCaixa
        isOpen={mostrarModalConfirmacaoFotos}
        onClose={() => {
          setMostrarModalConfirmacaoFotos(false);
          setExibirCampoMotivoSemFotos(false);
          setMotivoSemFotosInput('');
        }}
        caixaAtiva={caixaAtiva}
        exibirCampoMotivoSemFotos={exibirCampoMotivoSemFotos}
        setExibirCampoMotivoSemFotos={setExibirCampoMotivoSemFotos}
        motivoSemFotosInput={motivoSemFotosInput}
        setMotivoSemFotosInput={setMotivoSemFotosInput}
        onRespostaSim={handleRespostaFotosSim}
        onRespostaNao={handleRespostaFotosNao}
        onConfirmarMotivo={handleConfirmarMotivoSemFotos}
      />

      {/* 11. MODAL: LIMPAR REGISTROS DA TELA */}
      <ModalLimparRegistros
        isOpen={mostrarModalLimparRegistros}
        onClose={() => setMostrarModalLimparRegistros(false)}
        limpandoRegistros={limpandoRegistros}
        contagemStatusRegistros={contagemStatusRegistros}
        onConfirmar={handleConfirmarLimpezaRegistros}
      />

      {/* Modal de Bloqueio por Duplicidade no Servidor Online */}
      {duplicadosAlerta && (
        <ModalAlertaDuplicidadeServidor
          isOpen={!!duplicadosAlerta}
          duplicados={duplicadosAlerta}
          totalSincronizados={totalEnviadosAlerta}
          onClose={() => setDuplicadosAlerta(null)}
          onItensRemovidos={() => {
            recarregarDados(filtroCaixa);
          }}
          onContinuarEnvio={() => {
            setDuplicadosAlerta(null);
            handleSyncMobile();
          }}
        />
      )}

      {/* Modal Oficial de Fechamento de Lote com 3 Fotos Obrigatórias */}
      <ModalFechamentoLote
        isOpen={mostrarModalFechamentoLote}
        lote={loteAtivo}
        regional={regionalAtiva}
        colaborador={db.obterColaboradorAtivo() || usuarioAtual?.nome_colaborador || usuarioAtual?.nome || 'Operador'}
        onClose={() => setMostrarModalFechamentoLote(false)}
        onLoteFinalizado={handleLoteFinalizadoComSucesso}
      />

      {/* MODAL DE BLOQUEIO: CAIXA HOMOGÊNEA (INCOMPATIBILIDADE DETECTADA) */}
      {incompatibilidadeCaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-rose-500">
            {/* Header */}
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-wide">
                  Produto Não Compatível com esta Caixa
                </h3>
                <p className="text-xs text-rose-100 font-medium">
                  Regra de Caixa Homogênea estrita ativa
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-sm">
              <p className="text-slate-700 leading-relaxed">
                A <strong>{incompatibilidadeCaixa.caixa}</strong> já possui produtos com características definidas e não permite a inclusão deste item divergente:
              </p>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-2 border-r border-slate-200 pr-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Definido na Caixa
                  </span>
                  <div>
                    <span className="text-xs text-slate-500 block">Classificação:</span>
                    <span className="text-xs font-black text-slate-900 block truncate" title={incompatibilidadeCaixa.classificacaoCaixa}>
                      {incompatibilidadeCaixa.classificacaoCaixa}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Condição de Lacre:</span>
                    <span className={`text-xs font-black ${incompatibilidadeCaixa.condicaoCaixa === 'LACRADO' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {incompatibilidadeCaixa.condicaoCaixa}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pl-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
                    Produto Bipado
                  </span>
                  <div>
                    <span className="text-xs text-slate-500 block">Classificação:</span>
                    <span className={`text-xs font-black truncate block ${incompatibilidadeCaixa.classificacaoCaixa !== incompatibilidadeCaixa.classificacaoProduto ? 'text-rose-600' : 'text-slate-900'}`} title={incompatibilidadeCaixa.classificacaoProduto}>
                      {incompatibilidadeCaixa.classificacaoProduto}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Condição de Lacre:</span>
                    <span className={`text-xs font-black ${incompatibilidadeCaixa.condicaoCaixa !== incompatibilidadeCaixa.condicaoProduto ? 'text-rose-600' : 'text-slate-900'}`}>
                      {incompatibilidadeCaixa.condicaoProduto}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Para manter a integridade dos lotes da auditoria, crie uma nova caixa ou selecione uma caixa existente com a mesma classificação e condição.
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIncompatibilidadeCaixa(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIncompatibilidadeCaixa(null);
                  setCaixaParaMudarInput(caixasExistentes.find(c => c !== caixaAtiva) || '');
                  setMostrarAlterarCaixaModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                Selecionar Outra Caixa
              </button>
              <button
                type="button"
                onClick={() => {
                  setIncompatibilidadeCaixa(null);
                  setNovaCaixaNome('');
                  setMostrarNovaCaixaModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
              >
                Criar Nova Caixa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BipagemRapida;
