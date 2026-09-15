import React, { useState, useRef, useEffect } from 'react';
import { db, SAMSUNG_MODELOS_PRESET } from '../db/storage';
import { ProdutoAuditoria, SimNao, GrupoFotosInfo, ROTULOS_10_FOTOS_CAIXA, ROTULOS_2_FOTOS_CAIXA, DetalheImeiDuplicado } from '../types';
import { sounds } from '../utils/audio';
import { SamsungLogo } from '../components/SamsungLogo';
import { SolutionsLogo } from '../components/SolutionsLogo';
import { LOGO_SAMSUNG_BASE64, LOGO_SOLUTIONS_BASE64 } from '../assets/logosDataUri';
import { ModalCaptura10FotosCaixa } from '../components/ModalCaptura10FotosCaixa';
import { ModalAlertaDuplicidadeServidor } from '../components/ModalAlertaDuplicidadeServidor';
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

  const [modeloAtivo, setModeloAtivo] = useState(SAMSUNG_MODELOS_PRESET[2].modelo); // Galaxy S24
  const [eanAtivo, setEanAtivo] = useState(SAMSUNG_MODELOS_PRESET[2].ean);
  const [serialInput, setSerialInput] = useState('');
  const [dataAtiva, setDataAtiva] = useState(getDataAtualFormatada());
  const [lacreAtivo, setLacreAtivo] = useState<SimNao>('SIM');
  const [kitAtivo, setKitAtivo] = useState<SimNao | ''>('');
  const [marcasAtivo, setMarcasAtivo] = useState<SimNao | ''>('');
  const [obsAtivo, setObsAtivo] = useState('');

  // Estados da Nota Fiscal e Conferência de NF (Requisitos 3 e 4)
  const [nfAtiva, setNfAtiva] = useState<string>(() => {
    return localStorage.getItem('solutions_nf_ativa') || 'NF 001';
  });
  const [nfConferidaAtiva, setNfConferidaAtiva] = useState<SimNao>(() => {
    return (localStorage.getItem('solutions_nf_conferida_ativa') as SimNao) || 'SIM';
  });

  // Estado do Número do Lote (Obrigatório e Memorizado no Navegador)
  const [loteAtivo, setLoteAtivo] = useState<string>(() => {
    return db.obterUltimoLote() || '01';
  });

  const handleMudarLoteAtivo = (novoLote: string) => {
    setLoteAtivo(novoLote);
    db.salvarUltimoLote(novoLote);
  };

  const handleMudarNfConferida = (novoValor: SimNao) => {
    setNfConferidaAtiva(novoValor);
    localStorage.setItem('solutions_nf_conferida_ativa', novoValor);
  };

  const handleMudarNfAtiva = (novaNf: string) => {
    setNfAtiva(novaNf);
    localStorage.setItem('solutions_nf_ativa', novaNf);
  };

  // Editing state for previously recorded rows (full inline editing of any cell)
  const [linhaEditandoId, setLinhaEditandoId] = useState<number | null>(null);
  const [editModelo, setEditModelo] = useState('');
  const [editEan, setEditEan] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editData, setEditData] = useState('');
  const [editCaixa, setEditCaixa] = useState('');
  const [editLote, setEditLote] = useState('');
  const [editNf, setEditNf] = useState('');
  const [editNfConferida, setEditNfConferida] = useState<SimNao>('SIM');
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
    if (encontrado) {
      setEanAtivo(encontrado.ean);
    }
  };

  // Main Bipagem Process (Excel Row Enter)
  const processarBipagemLinha = () => {
    const serialLimpo = serialInput.trim().toUpperCase();
    const eanLimpo = eanAtivo.trim();
    const modeloLimpo = modeloAtivo.trim();
    const caixaLimpa = caixaAtiva.trim();
    const dataLimpa = dataAtiva.trim() || getDataAtualFormatada();
    const loteLimpo = loteAtivo.trim();

    setErroDuplicado(null);
    setAlertaValidacao(null);
    setSucessoNotif(null);

    // Validação obrigatória do Número do Lote
    if (!loteLimpo) {
      setAlertaValidacao('Informe o número do lote antes de continuar.');
      sounds.playError();
      return;
    }

    // Validação Modelo
    if (!modeloLimpo) {
      setAlertaValidacao('Preencha o modelo do produto.');
      sounds.playError();
      return;
    }

    // Validação EAN
    if (!eanLimpo) {
      setAlertaValidacao('Preencha o código EAN do produto.');
      sounds.playError();
      return;
    }

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

    // 2. REGRA DO PRODUTO LACRADO (SIM / NÃO)
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

    // 3. GRAVAÇÃO INSTANTÂNEA NO BANCO DE DADOS LOCAL (COM DUAL PERSISTENCE EM INDEXEDDB)
    const res = db.inserirProduto({
      modelo_produto: modeloLimpo,
      ean: eanLimpo,
      serial: serialLimpo,
      imei: serialLimpo,
      numero_lote: loteLimpo,
      data_auditoria: dataLimpa,
      numero_caixa: caixaLimpa,
      numero_nf: nfAtiva.trim(),
      nf_conferida: nfConferidaAtiva,
      produto_lacrado: lacreAtivo,
      kit_completo: lacreAtivo === 'SIM' ? null : (kitAtivo as SimNao),
      aparelho_marcas_uso: lacreAtivo === 'SIM' ? null : (marcasAtivo as SimNao),
      observacao: obsAtivo.trim(),
    });

    if (res.sucesso && res.produto) {
      sounds.playSuccess();
      setSucessoNotif(`IMEI ${serialLimpo} registrado na ${caixaLimpa}!`);
      setTimeout(() => setSucessoNotif(null), 2000);

      // Limpar células para a próxima linha contínua
      setSerialInput('');
      setObsAtivo('');
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
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarBipagemLinha();
    }
  };

  // Full Inline Row Editing (Excel mode) - Allows editing Modelo, EAN, Serial, Caixa, Lacre, Kit, Marcas, Obs, NF Conferida
  const iniciarEdicaoLinha = (item: ProdutoAuditoria) => {
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
    setEditNf(item.numero_nf || '');
    setEditNfConferida(item.nf_conferida || 'SIM');
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

    const res = db.atualizarProduto(id, {
      modelo_produto: editModelo.trim(),
      ean: editEan.trim(),
      serial: editSerial.trim(),
      imei: editSerial.trim(),
      data_auditoria: editData.trim(),
      numero_caixa: editCaixa.trim(),
      numero_nf: editNf.trim(),
      nf_conferida: editNfConferida,
      produto_lacrado: editLacre,
      kit_completo: editLacre === 'SIM' ? null : (editKit as SimNao),
      aparelho_marcas_uso: editLacre === 'SIM' ? null : (editMarcas as SimNao),
      observacao: editObs.trim(),
    });

    if (!res.sucesso) {
      alert(res.erro || 'Erro ao atualizar registro.');
      return;
    }

    setLinhaEditandoId(null);
    recarregarDados(filtroCaixa);
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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`CAIXA: ${caixaNomeAlvo.toUpperCase()}`, 18, 70);
    doc.text(`LOTE: ${loteCaixa.toUpperCase()}`, 18, 77);
    doc.text(`FABRICANTE: SAMSUNG`, 18, 84);

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
      Fabricante: p.fabricante,
      'Modelo Produto': p.modelo_produto,
      EAN: p.ean,
      IMEI: p.imei || p.serial,
      'Data Auditoria': p.data_auditoria,
      Caixa: p.numero_caixa,
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
      p.numero_caixa,
      p.modelo_produto,
      p.ean,
      p.imei || p.serial,
      p.produto_lacrado,
      p.kit_completo || '-',
      p.aparelho_marcas_uso || '-',
      p.observacao || '-',
      p.data_auditoria,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nº', 'Regional', 'Caixa', 'Modelo', 'EAN', 'IMEI', 'Lacrado', 'Kit Completo', 'Marcas de Uso', 'Observação', 'Data']],
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

      {/* Alertas globais (visíveis em ambos os modos) */}
      {erroDuplicado && (
        <div className="bg-rose-100 border-2 border-rose-500 text-rose-900 rounded-xl p-3.5 flex items-center gap-3 shadow-md animate-bounce">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-xs font-black">{erroDuplicado}</span>
        </div>
      )}

      {alertaValidacao && (
        <div className="bg-amber-100 border border-amber-500 text-amber-900 rounded-xl p-3 flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-xs font-bold">{alertaValidacao}</span>
        </div>
      )}

      {sucessoNotif && (
        <div className="bg-emerald-100 border border-emerald-500 text-emerald-900 rounded-xl p-2.5 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{sucessoNotif}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARRA SUPERIOR: NOTA FISCAL, CONFERÊNCIA AUTOMÁTICA DA NF E LIMITE DA CAIXA */}
      {/* REQUISITOS 2, 3 E 4 DO CLIENTE */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-md flex flex-wrap items-center justify-between gap-4 border-2 border-blue-600/50">
        <div className="flex flex-wrap items-center gap-4">
          {/* Campo Obrigatório: Número do Lote (Memorizado e Obrigatório) */}
          <div className="flex items-center gap-2 pr-3 border-r border-blue-700/60">
            <div className="w-8 h-8 rounded-xl bg-amber-500/25 border border-amber-400/60 flex items-center justify-center text-amber-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block flex items-center gap-1">
                Número do Lote: <span className="text-rose-400 font-bold">*</span>
              </span>
              <input
                type="text"
                value={loteAtivo}
                onChange={(e) => handleMudarLoteAtivo(e.target.value)}
                placeholder="Ex: 01"
                className={`text-sm font-black text-white bg-blue-950/80 border rounded-xl px-3 py-1 focus:outline-none focus:ring-2 w-32 uppercase tracking-wider shadow-inner transition-all ${
                  !loteAtivo.trim()
                    ? 'border-rose-500 ring-2 ring-rose-500/60 placeholder-rose-400'
                    : 'border-amber-400/80 focus:ring-amber-400'
                }`}
                title="Número do Lote (Obrigatório para bipagem e espelho)"
              />
            </div>
          </div>

          {/* Campo da Nota Fiscal (NF) */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/50 flex items-center justify-center text-amber-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 block">
                Nota Fiscal (NF):
              </span>
              <input
                type="text"
                value={nfAtiva}
                onChange={(e) => handleMudarNfAtiva(e.target.value)}
                placeholder="Ex: NF 00123"
                className="text-sm font-black text-white bg-blue-950/80 border border-blue-400/60 rounded-xl px-3 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 w-36 uppercase tracking-wider shadow-inner"
              />
            </div>
          </div>

          {/* Seletor Automático de Conferência da NF: [ SIM ] [ NÃO ] */}
          <div className="flex items-center gap-2 pl-3 border-l border-blue-700/60">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 block mb-1">
                NF foi conferida?
              </span>
              <div className="inline-flex bg-blue-950/90 rounded-xl p-1 border border-blue-600/60 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleMudarNfConferida('SIM')}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-1 transition-all cursor-pointer ${
                    nfConferidaAtiva === 'SIM'
                      ? 'bg-emerald-600 text-white shadow-xs scale-105 ring-2 ring-emerald-400'
                      : 'text-blue-200 hover:text-white'
                  }`}
                  title="Todos os próximos seriais bipados assumirão NF Conferida: SIM"
                >
                  <Check className="w-3.5 h-3.5" /> SIM
                </button>
                <button
                  type="button"
                  onClick={() => handleMudarNfConferida('NÃO')}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-1 transition-all cursor-pointer ${
                    nfConferidaAtiva === 'NÃO'
                      ? 'bg-rose-600 text-white shadow-xs scale-105 ring-2 ring-rose-400'
                      : 'text-blue-200 hover:text-white'
                  }`}
                  title="Todos os próximos seriais bipados assumirão NF Conferida: NÃO"
                >
                  <X className="w-3.5 h-3.5" /> NÃO
                </button>
              </div>
            </div>
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
                SAMSUNG
              </span>
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

          {/* Card 2: Seleção de Modelo Samsung & EAN */}
          <div className="bg-white rounded-2xl p-4 border-2 border-slate-300 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                Modelo Samsung & Código EAN
              </label>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                FABRICANTE: SAMSUNG
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
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Código EAN:</span>
                <input
                  type="text"
                  value={eanAtivo}
                  onChange={(e) => setEanAtivo(e.target.value)}
                  placeholder="Código EAN 789..."
                  className="w-full font-mono text-sm font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 3: BIPAGEM PRINCIPAL - CÓDIGO IMEI (15 DÍGITOS) */}
          <div className="bg-blue-50 border-2 border-blue-500 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-blue-950 uppercase flex items-center gap-2">
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
                ref={serialMobileInputRef}
                type="text"
                inputMode="numeric"
                maxLength={15}
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value.replace(/\D/g, '').slice(0, 15))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    processarBipagemLinha();
                  }
                }}
                placeholder="BIPAR IMEI (15 NÚMEROS)..."
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                className="w-full font-mono font-black text-xl sm:text-2xl text-slate-950 bg-white border-3 border-blue-600 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-4 focus:ring-blue-300 placeholder:text-slate-300 uppercase shadow-inner"
              />
              {serialInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSerialInput('');
                    focarInputSerial();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

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

            {/* Conferência da Nota Fiscal (Mobile) */}
            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase">
                  NF foi conferida?
                </span>
                <span className="text-[10px] text-emerald-800 font-bold uppercase">
                  {nfAtiva}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handleMudarNfConferida('SIM');
                    focarInputSerial();
                  }}
                  className={`py-2.5 px-3 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    nfConferidaAtiva === 'SIM'
                      ? 'bg-emerald-700 text-white shadow-md ring-2 ring-emerald-400 scale-[1.02]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleMudarNfConferida('NÃO');
                    focarInputSerial();
                  }}
                  className={`py-2.5 px-3 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    nfConferidaAtiva === 'NÃO'
                      ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400 scale-[1.02]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <X className="w-4 h-4" />
                  NÃO
                </button>
              </div>
            </div>

            {/* Condição Física / Lacre (Botões Touch Grandes) */}
            <div className="space-y-3 bg-white p-3.5 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase">
                  Produto Lacrado?
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  {lacreAtivo === 'SIM' ? 'LACRADO DE FÁBRICA' : 'ABERTO / SEM LACRE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setLacreAtivo('SIM');
                    setKitAtivo('');
                    setMarcasAtivo('');
                    focarInputSerial();
                  }}
                  className={`py-3 px-3 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    lacreAtivo === 'SIM'
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400 scale-[1.02]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  SIM (Lacrado)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLacreAtivo('NÃO');
                  }}
                  className={`py-3 px-3 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    lacreAtivo === 'NÃO'
                      ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400 scale-[1.02]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  NÃO (Aberto)
                </button>
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
                      <div className="text-[10px] text-slate-500 font-bold truncate">
                        {item.modelo_produto} • EAN {item.ean} • #{produtos.length - idx}
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
              onClick={() => exportarRelatorioExcel(false)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase py-2.5 px-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel da Caixa
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

            {/* Nota Fiscal */}
            <div className="flex items-center gap-1.5 bg-emerald-50 border-2 border-emerald-300 px-2.5 py-1.5 rounded-xl">
              <span className="text-[11px] font-black text-emerald-950 uppercase whitespace-nowrap">NF:</span>
              <input
                type="text"
                value={nfAtiva}
                onChange={(e) => handleMudarNfAtiva(e.target.value)}
                placeholder="Ex: NF 001"
                className="w-20 bg-white font-black text-xs text-emerald-900 border border-emerald-400 rounded px-2 py-0.5 focus:outline-none uppercase"
                title="Número da Nota Fiscal ativa"
              />
            </div>

            {/* 1. Botão: NF foi conferida? */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 px-2.5 py-1.5 rounded-xl text-xs">
              <span className="text-[11px] font-black text-slate-700 uppercase whitespace-nowrap mr-1">
                NF Conferida:
              </span>
              <button
                type="button"
                onClick={() => {
                  handleMudarNfConferida('SIM');
                  serialInputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] uppercase transition-all cursor-pointer ${
                  nfConferidaAtiva === 'SIM'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Nota Fiscal foi conferida: SIM"
              >
                SIM
              </button>
              <button
                type="button"
                onClick={() => {
                  handleMudarNfConferida('NÃO');
                  serialInputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] uppercase transition-all cursor-pointer ${
                  nfConferidaAtiva === 'NÃO'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Nota Fiscal NÃO foi conferida"
              >
                NÃO
              </button>
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

            {/* 3. Relatório da Caixa (Excel) */}
            <button
              onClick={() => exportarRelatorioExcel(false)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Baixar relatório completo da caixa atual em Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel Caixa
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

            {/* 6. Cópia de Segurança / Backup Anti-Perda */}
            <button
              onClick={baixarCopiaSeguranca}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Salvar cópia de segurança completa para seu computador"
            >
              <HardDrive className="w-3.5 h-3.5" />
              Backup Seguro
            </button>

            {/* 7. Importar Excel */}
            <button
              onClick={() => setMostrarImportModal(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 border border-slate-300 transition-colors cursor-pointer"
              title="Importar lista de seriais via Excel"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              Importar
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
                <th className="py-1.5 px-2 border-r border-slate-300 w-20 text-center">Fabricante</th>
                <th className="py-1.5 px-2 border-r border-slate-300 min-w-[140px]">Modelo Produto ✏️</th>
                <th className="py-1.5 px-2 border-r border-slate-300 font-mono min-w-[120px]">EAN ✏️</th>
                <th className="py-1.5 px-3 border-r border-slate-300 min-w-[160px] bg-blue-100 text-blue-950">
                  IMEI (Bipar / Editar) ⚡
                </th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-24">Data Auditoria</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center min-w-[95px] bg-indigo-50 text-indigo-950">
                  Caixa ✏️
                </th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-center min-w-[105px] bg-emerald-50 text-emerald-950">
                  NF foi conferida? ✏️
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
                      <td className="py-2 px-3 font-bold text-slate-700 border-r border-amber-200">
                        SAMSUNG
                      </td>

                      {/* Modelo Produto */}
                      <td className="py-2 px-2 border-r border-amber-200">
                        <input
                          list="lista-modelos-samsung"
                          type="text"
                          value={editModelo}
                          onChange={(e) => setEditModelo(e.target.value)}
                          className="w-full text-xs font-bold text-slate-900 bg-white border border-amber-400 rounded px-2 py-1"
                        />
                      </td>

                      {/* EAN */}
                      <td className="py-2 px-2 border-r border-amber-200">
                        <input
                          type="text"
                          value={editEan}
                          onChange={(e) => setEditEan(e.target.value)}
                          className="w-full font-mono text-xs font-bold text-slate-900 bg-white border border-amber-400 rounded px-2 py-1"
                        />
                      </td>

                      {/* IMEI */}
                      <td className="py-2 px-2 border-r border-amber-200 bg-amber-100/50">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={15}
                          value={editSerial}
                          onChange={(e) => setEditSerial(e.target.value.replace(/\D/g, '').slice(0, 15))}
                          className="w-full font-mono text-xs font-black text-slate-950 bg-white border-2 border-amber-500 rounded px-2 py-1 uppercase tracking-wider"
                        />
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

                      {/* NF foi conferida? */}
                      <td className="py-2 px-2 text-center border-r border-amber-200 bg-emerald-50/40">
                        <select
                          value={editNfConferida}
                          onChange={(e) => setEditNfConferida(e.target.value as SimNao)}
                          className="text-[11px] font-black px-1.5 py-1 rounded border border-amber-400 bg-white cursor-pointer"
                        >
                          <option value="SIM">SIM</option>
                          <option value="NÃO">NÃO</option>
                        </select>
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
                    <td className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                      {item.fabricante}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-200 truncate max-w-[180px]">
                      {item.modelo_produto}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600 font-medium border-r border-slate-200">
                      {item.ean}
                    </td>
                    <td className="py-2 px-4 font-mono font-black text-slate-900 tracking-wider border-r border-slate-200 bg-blue-50/30">
                      {item.imei || item.serial}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-200">
                      {item.data_auditoria}
                    </td>
                    <td className="py-2 px-3 text-center font-black text-blue-700 border-r border-slate-200 bg-blue-50/20">
                      {item.numero_caixa}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-200 bg-emerald-50/20">
                      <span
                        className={`font-black px-2 py-0.5 rounded text-[10px] border ${
                          item.nf_conferida === 'NÃO'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {item.nf_conferida || 'SIM'}
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
                <td className="py-2 px-3 font-black text-slate-800 border-r border-emerald-300">
                  SAMSUNG
                </td>

                {/* MODELO PRODUTO */}
                <td className="py-2 px-2 border-r border-emerald-300">
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

                {/* EAN */}
                <td className="py-2 px-2 border-r border-emerald-300">
                  <input
                    type="text"
                    value={eanAtivo}
                    onChange={(e) => setEanAtivo(e.target.value)}
                    placeholder="EAN 789..."
                    className="w-full font-mono text-xs font-black text-slate-900 bg-white border-2 border-emerald-500 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    title="Código EAN editável"
                  />
                </td>

                {/* IMEI */}
                <td className="py-2 px-2 border-r border-emerald-300 bg-white">
                  <input
                    ref={serialInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={15}
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value.replace(/\D/g, '').slice(0, 15))}
                    onKeyDown={handleKeyDown}
                    placeholder="Bipe o IMEI (15 dígitos)..."
                    className="w-full font-mono font-black text-sm text-slate-950 bg-blue-50/50 border-2 border-blue-600 rounded px-2.5 py-1.5 focus:outline-none tracking-wider placeholder:text-slate-400"
                    autoFocus
                    title="Posicione o cursor aqui e bipe o IMEI (15 dígitos)"
                  />
                </td>

                {/* DATA AUDITORIA */}
                <td className="py-2 px-2 text-center border-r border-emerald-300">
                  <input
                    type="text"
                    value={dataAtiva}
                    onChange={(e) => setDataAtiva(e.target.value)}
                    className="w-full text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:outline-none"
                    title="Data da auditoria"
                  />
                </td>

                {/* CAIXA */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 bg-blue-50/50">
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

                {/* NF FOI CONFERIDA? (COLUNA 9) */}
                <td className="py-2 px-2 text-center border-r border-emerald-300 bg-emerald-50/50">
                  <select
                    value={nfConferidaAtiva}
                    onChange={(e) => {
                      const val = e.target.value as SimNao;
                      handleMudarNfConferida(val);
                      serialInputRef.current?.focus();
                    }}
                    className={`w-full text-[11px] font-black px-2 py-1.5 rounded-md border focus:outline-none cursor-pointer ${
                      nfConferidaAtiva === 'SIM'
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-rose-600 text-white border-rose-700'
                    }`}
                    title="NF foi conferida? SIM ou NÃO"
                  >
                    <option value="SIM">SIM</option>
                    <option value="NÃO">NÃO</option>
                  </select>
                </td>

                {/* PRODUTO LACRADO (COLUNA 10) */}
                <td className="py-2 px-2 text-center border-r border-emerald-300">
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
                <td className="py-2 px-2 text-center border-r border-emerald-300">
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
                <td className="py-2 px-2 text-center border-r border-emerald-300">
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
                <td className="py-2 px-2 border-r border-emerald-300">
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
                <td className="py-2 px-2 text-center border-r border-emerald-300 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                    Pendente
                  </span>
                </td>

                {/* BOTÃO ENTER */}
                <td className="py-2 px-2 text-center">
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
      {mostrarEspelhoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs no-print-backdrop">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 print-container">
            
            {/* Cabeçalho do Espelho com LOGO SOLUTIONS E LOGO SAMSUNG */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-5">
                <SolutionsLogo height={38} />
                <div className="h-8 w-px bg-slate-200" />
                <SamsungLogo height={24} />
              </div>
              <button
                onClick={() => setMostrarEspelhoModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg no-print cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Seletor do Tipo de Espelho */}
            <div className="flex flex-wrap items-center justify-center gap-3 no-print bg-slate-100 p-2 rounded-2xl border border-slate-300">
              <button
                type="button"
                onClick={() => setTipoEspelhoVisualizacao('completo')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
                  tipoEspelhoVisualizacao === 'completo'
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 scale-[1.02]'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                Espelho 1: Completo (Dentro da Caixa Master)
              </button>
              <button
                type="button"
                onClick={() => setTipoEspelhoVisualizacao('transporte')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
                  tipoEspelhoVisualizacao === 'transporte'
                    ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400 scale-[1.02]'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                <Boxes className="w-4 h-4 text-amber-200" />
                Espelho 2: Expedição (Por EAN)
              </button>
            </div>

            {/* Título Oficial */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                {tipoEspelhoVisualizacao === 'transporte'
                  ? 'ESPELHO 2 - RESUMIDO DE EXPEDIÇÃO'
                  : 'ESPELHO 1 - COMPLETO (OPERACIONAL)'}
              </h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Grupo Solutions • Setor de Rastreabilidade e Logística Samsung
              </p>
            </div>

            {/* AVISO DA CAIXA MASTER NO ESPELHO 1 */}
            {tipoEspelhoVisualizacao === 'completo' && (
              <div className="bg-blue-50 border-2 border-blue-400 text-blue-900 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
                <PackageCheck className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-xs font-bold leading-relaxed">
                  <strong>INSTRUÇÃO DE EMBARQUE:</strong> Este espelho deve ser colocado <strong>dentro da Caixa Master</strong>.
                </span>
              </div>
            )}

            {/* Quadro de Detalhes da Caixa */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Volume / Caixa:</span>
                  <span className="font-black text-blue-700 text-base uppercase">{espelhoCaixaAtual.caixaNome}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Lote:</span>
                  <span className="font-black text-amber-600 text-base uppercase">
                    LOTE {espelhoCaixaAtual.itens.length > 0 && espelhoCaixaAtual.itens[0].numero_lote ? espelhoCaixaAtual.itens[0].numero_lote : loteAtivo}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Regional / Cliente:</span>
                  <span className="font-black text-purple-700 text-base uppercase">{regionalAtiva}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Qtd Total no Volume:</span>
                  <span className="font-black text-emerald-700 text-base">
                    {espelhoCaixaAtual.totalGeral} peças
                  </span>
                </div>
              </div>
            </div>

            {/* RENDERIZAÇÃO DO CONTEÚDO CONFORME O TIPO DE ESPELHO SELECIONADO */}
            {tipoEspelhoVisualizacao === 'transporte' ? (
              /* ========================================================================= */
              /* ESPELHO 2: RESUMIDO / EXPEDIÇÃO (POR EAN)                                 */
              /* ========================================================================= */
              <div className="space-y-4">
                <div className="border-2 border-amber-300 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-amber-700 text-white uppercase text-[11px] font-black tracking-wider">
                      <tr>
                        <th className="py-3 px-4 text-center w-16 border-r border-amber-600">Item</th>
                        <th className="py-3 px-5 font-mono border-r border-amber-600">Código EAN</th>
                        <th className="py-3 px-5 text-center w-48">Quantidade por EAN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {espelhoCaixaAtual.resumoEans.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                            Nenhum produto registrado nesta caixa até o momento.
                          </td>
                        </tr>
                      ) : (
                        espelhoCaixaAtual.resumoEans.map((item) => (
                          <tr key={item.ean} className="hover:bg-amber-50/40">
                            <td className="py-3.5 px-4 text-center font-bold text-slate-400 border-r border-slate-200">
                              {item.item.toString().padStart(2, '0')}
                            </td>
                            <td className="py-3.5 px-5 font-mono font-bold text-slate-800 text-sm border-r border-slate-200">
                              {item.ean}
                            </td>
                            <td className="py-3.5 px-5 text-center">
                              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900">
                                {item.total} {item.total === 1 ? 'unidade' : 'unidades'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-amber-50 font-black text-slate-900 border-t-2 border-amber-300">
                      <tr>
                        <td colSpan={2} className="py-3.5 px-5 text-right uppercase text-xs tracking-wider text-amber-950">
                          TOTAL GERAL TRANSPORTADO NESTE VOLUME:
                        </td>
                        <td className="py-3.5 px-5 text-center text-sm text-amber-900 font-black">
                          {espelhoCaixaAtual.totalGeral} peças
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* ESPELHO 1: COMPLETO (OPERACIONAL COM MODELOS E EANS)                      */
              /* ========================================================================= */
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black uppercase text-slate-800 tracking-wide">
                    Conteúdo da Caixa (Modelo, EAN e Quantidade):
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {espelhoCaixaAtual.resumoModelos.length} item(ns) agrupado(s)
                  </span>
                </div>

                <div className="border-2 border-slate-300 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#0C4DA2] text-white uppercase text-[11px] font-black tracking-wider">
                      <tr>
                        <th className="py-3 px-4 text-center w-16 border-r border-blue-600">Item</th>
                        <th className="py-3 px-5 border-r border-blue-600">Modelo Produto</th>
                        <th className="py-3 px-5 font-mono border-r border-blue-600">Código EAN</th>
                        <th className="py-3 px-5 text-center w-36">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {espelhoCaixaAtual.resumoModelos.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400 font-medium">
                            Nenhum produto registrado nesta caixa até o momento.
                          </td>
                        </tr>
                      ) : (
                        espelhoCaixaAtual.resumoModelos.map((item) => (
                          <tr key={`${item.modelo}___${item.ean}`} className="hover:bg-blue-50/50 transition-colors">
                            <td className="py-3 px-4 text-center font-bold text-slate-400 border-r border-slate-200">
                              {item.item.toString().padStart(2, '0')}
                            </td>
                            <td className="py-3 px-5 font-bold text-slate-900 text-sm border-r border-slate-200">
                              {item.modelo}
                            </td>
                            <td className="py-3 px-5 font-mono text-slate-700 text-xs border-r border-slate-200 font-bold">
                              {item.ean}
                            </td>
                            <td className="py-3 px-5 text-center border-slate-200">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800">
                                {item.total} {item.total === 1 ? 'unidade' : 'unidades'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={3} className="py-3 px-5 text-right uppercase text-xs tracking-wider">
                          Total Geral de Produtos na Caixa:
                        </td>
                        <td className="py-3 px-5 text-center text-sm text-emerald-700 font-black">
                          {espelhoCaixaAtual.totalGeral} {espelhoCaixaAtual.totalGeral === 1 ? 'produto' : 'produtos'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Opção de Controle de Seriais (Impressão e PDF) */}
                <div className="bg-slate-100 p-3 rounded-2xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-700 whitespace-nowrap">
                      Modo com IMEI:
                    </span>
                    <div className="inline-flex bg-white rounded-xl p-1 border border-slate-300 shadow-xs">
                      <button
                        type="button"
                        onClick={() => setIncluirSeriaisEspelho(false)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                          !incluirSeriaisEspelho
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        📄 Sem IMEI (Padrão)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncluirSeriaisEspelho(true)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                          incluirSeriaisEspelho
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        📋 Com IMEI
                      </button>
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 font-bold">
                    {incluirSeriaisEspelho
                      ? '🟢 Modo com IMEI Ativo: Os códigos IMEI sairão na impressão'
                      : '⚪ Modo Padrão Ativo: Apenas Modelo, EAN e Quantidade'}
                  </span>
                </div>

                {/* Relação de IMEIs (Opcional) */}
                {incluirSeriaisEspelho && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-700 tracking-wide">
                        Relação Detalhada de IMEIs da {espelhoCaixaAtual.caixaNome}:
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {espelhoCaixaAtual.itens.length} IMEIs
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-800 text-white uppercase text-[10px] font-black tracking-wider sticky top-0">
                          <tr>
                            <th className="py-2 px-3 text-center w-12 border-r border-slate-700">Nº</th>
                            <th className="py-2 px-4 border-r border-slate-700">Modelo Produto</th>
                            <th className="py-2 px-4 font-mono border-r border-slate-700">EAN</th>
                            <th className="py-2 px-4 font-mono">Número IMEI (15 Dígitos)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {espelhoCaixaAtual.itens.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-slate-400 font-sans">
                                Nenhum IMEI nesta caixa.
                              </td>
                            </tr>
                          ) : (
                            espelhoCaixaAtual.itens.map((p, index) => (
                              <tr key={p.id} className="hover:bg-slate-50">
                                <td className="py-1.5 px-3 text-center text-slate-400 font-sans border-r border-slate-100">
                                  {(index + 1).toString().padStart(2, '0')}
                                </td>
                                <td className="py-1.5 px-4 font-sans font-bold text-slate-700 border-r border-slate-100">
                                  {p.modelo_produto}
                                </td>
                                <td className="py-1.5 px-4 text-slate-500 border-r border-slate-100">
                                  {p.ean}
                                </td>
                                <td className="py-1.5 px-4 font-black text-slate-900 tracking-wider">
                                  {p.imei || p.serial}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assinaturas no Espelho (Requisito 5: Responsável Casas Bahia e Responsável Grupo Solutions) */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
              <div>
                <div className="border-t border-slate-300 w-3/4 mx-auto mb-1"></div>
                <span className="font-bold text-slate-700 block">Responsável Casas Bahia</span>
                <span className="text-[10px] text-slate-400">Conferência e Recebimento</span>
              </div>
              <div>
                <div className="border-t border-slate-300 w-3/4 mx-auto mb-1"></div>
                <span className="font-bold text-slate-700 block">Responsável Grupo Solutions</span>
                <span className="text-[10px] text-slate-400">{usuarioAtual?.nome || 'Operador'}</span>
              </div>
            </div>

            {/* Ações do Modal do Espelho */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 no-print">
              <button
                onClick={() => setMostrarEspelhoModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Fechar
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={exportarEspelhoPDF}
                  className="px-3 py-2 rounded-xl text-xs font-black uppercase bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Baixar PDF do Espelho 1 (Completo com Modelos e EANs)"
                >
                  <Download className="w-4 h-4" />
                  Espelho 1 (Completo)
                </button>

                <button
                  type="button"
                  onClick={() => exportarEspelhoTransportePDF()}
                  className="px-3 py-2 rounded-xl text-xs font-black uppercase bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Baixar PDF do Espelho 2 (Região, EAN e Quantidade por EAN)"
                >
                  <Boxes className="w-4 h-4" />
                  Espelho 2 (Expedição)
                </button>

                <button
                  type="button"
                  onClick={baixarAmbosEspelhos}
                  className="px-3 py-2 rounded-xl text-xs font-black uppercase bg-indigo-700 hover:bg-indigo-800 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Baixar automaticamente os dois espelhos (Completo + Transporte)"
                >
                  <Files className="w-4 h-4" />
                  Baixar Ambos (2 PDFs)
                </button>

                <button
                  onClick={handleImprimirEspelho}
                  className="px-3 py-2 rounded-xl text-xs font-bold uppercase text-white shadow-xs flex items-center gap-1.5 cursor-pointer bg-slate-800 hover:bg-slate-900"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: NOVA AUDITORIA / NOVA CAIXA */}
      {/* ========================================================================= */}
      {mostrarNovaCaixaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-600" />
                Iniciar Nova Caixa
              </h3>
              <button
                onClick={() => setMostrarNovaCaixaModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Defina a identificação da caixa. Cada caixa pode conter <strong>no máximo 20 produtos</strong> conforme a regra operacional do sistema.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Identificação da Caixa:</label>
              <input
                type="text"
                value={novaCaixaNome}
                onChange={(e) => setNovaCaixaNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmarCriacaoNovaCaixa();
                  }
                }}
                placeholder="Ex: Caixa 02"
                className="w-full text-sm font-black text-slate-900 border-2 border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-600"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                onClick={() => setMostrarNovaCaixaModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCriacaoNovaCaixa}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl shadow-xs cursor-pointer"
              >
                Iniciar Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: IMPORTAÇÃO EXCEL EM LOTE */}
      {/* ========================================================================= */}
      {mostrarImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 uppercase flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                Importar Planilha de Auditoria
              </h3>
              <button
                onClick={() => setMostrarImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
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
              <label className="inline-block bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl cursor-pointer shadow-xs transition-transform active:scale-95">
                Selecionar Planilha Excel
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
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
                        setMostrarImportModal(false);
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
      )}



      {/* 9. MODAL: ALTERAR CAIXA OPERACIONAL */}
      {mostrarAlterarCaixaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-600" />
                Alterar Caixa Operacional
              </h3>
              <button
                onClick={() => setMostrarAlterarCaixaModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Todas as fotos da caixa atual <strong>{caixaAtiva}</strong> estão validadas. Escolha a próxima caixa para continuar:
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Caixa Alvo:</label>
              <input
                list="lista-caixas-existentes"
                type="text"
                value={caixaParaMudarInput}
                onChange={(e) => setCaixaParaMudarInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmarAlterarCaixaModal();
                  }
                }}
                placeholder="Ex: Caixa 02"
                className="w-full text-sm font-black text-slate-900 border-2 border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-600 uppercase"
                autoFocus
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-400 block w-full">Caixas Existentes:</span>
              {caixasExistentes.map((cx) => (
                <button
                  key={cx}
                  type="button"
                  onClick={() => setCaixaParaMudarInput(cx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    caixaParaMudarInput === cx
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cx}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setMostrarAlterarCaixaModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAlterarCaixaModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-4 py-2 rounded-xl shadow-xs cursor-pointer"
              >
                Confirmar Troca
              </button>
            </div>
          </div>
        </div>
      )}

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
      {mostrarModalConfirmacaoFotos && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-slate-300 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">
                    Fotos dos Produtos
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Confirmação da {caixaAtiva}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMostrarModalConfirmacaoFotos(false);
                  setExibirCampoMotivoSemFotos(false);
                  setMotivoSemFotosInput('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!exibirCampoMotivoSemFotos ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-base font-black text-slate-900">
                    As fotos dos produtos foram anexadas?
                  </p>
                  <p className="text-xs text-slate-600">
                    Se você já anexou as fotos da <strong>{caixaAtiva}</strong>, clique em <strong>SIM</strong> para liberar a mudança de caixa. Caso não tenha fotos, clique em <strong>NÃO</strong> para justificar o motivo.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRespostaFotosSim}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Check className="w-5 h-5" />
                    SIM (Liberar)
                  </button>
                  <button
                    type="button"
                    onClick={handleRespostaFotosNao}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-black text-sm uppercase py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <X className="w-5 h-5" />
                    NÃO
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Informe o motivo de não ter colocado as fotos:
                  </div>
                  <p className="text-xs text-slate-600">
                    Para liberar a mudança de caixa sem as fotos anexadas, informe uma breve justificativa abaixo:
                  </p>
                  <textarea
                    value={motivoSemFotosInput}
                    onChange={(e) => setMotivoSemFotosInput(e.target.value)}
                    rows={3}
                    placeholder="Ex: Câmera temporariamente indisponível, caixa lacrada de fábrica pelo fabricante, etc."
                    className="w-full text-xs font-medium text-slate-900 border-2 border-amber-300 rounded-xl p-2.5 focus:outline-none focus:border-amber-600 bg-white"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setExibirCampoMotivoSemFotos(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 uppercase cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarMotivoSemFotos}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Confirmar Motivo e Liberar Caixa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 11. MODAL: LIMPAR REGISTROS DA TELA */}
      {mostrarModalLimparRegistros && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-slate-300 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Limpar Registros da Tela
                  </h3>
                  <span className="text-xs font-bold text-amber-700">
                    Limpa a tela deste computador mantendo os dados seguros na nuvem
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalLimparRegistros(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50/70 border-2 border-amber-200 rounded-2xl p-4 text-slate-800 text-xs font-medium space-y-3">
              <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Deseja limpar a tela deste computador?
              </div>
              <p className="leading-relaxed text-slate-700">
                Esta ação apagará todos os registros visualizados <strong>neste computador</strong> (inclusive os que já foram enviados para o online), deixando a tela 100% limpa para novos trabalhos.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1 pb-1">
                <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Registros na sua Tela</span>
                  <span className="text-xl font-black text-amber-700">{contagemStatusRegistros.total}</span>
                  <span className="text-[10px] text-amber-600 block mt-0.5">Serão removidos desta tela</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Salvos na Nuvem</span>
                  <span className="text-xl font-black text-emerald-700">{contagemStatusRegistros.enviados}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">100% preservados no online</span>
                </div>
              </div>

              {contagemStatusRegistros.pendentes > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-rose-900 text-[11px] font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Atenção:</strong> Você possui <strong>{contagemStatusRegistros.pendentes} produto(s) pendente(s)</strong> que ainda não foram enviados para o online. Se limpar a tela agora sem enviar, esses itens pendentes serão descartados deste computador.
                  </div>
                </div>
              )}

              <div className="pt-2 text-emerald-900 font-semibold border-t border-amber-200 space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  A base enviada para a nuvem continua 100% intacta e segura.
                </p>
                <p className="text-[11px] text-slate-600 font-normal">
                  A base online enviada só pode ser excluída ou resetada pelo <strong>Administrador Geral</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={limpandoRegistros}
                onClick={() => setMostrarModalLimparRegistros(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={limpandoRegistros}
                onClick={handleConfirmarLimpezaRegistros}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white bg-amber-600 hover:bg-amber-700 shadow-md flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {limpandoRegistros ? 'Limpando Tela...' : 'CONFIRMAR E LIMPAR TELA'}
              </button>
            </div>
          </div>
        </div>
      )}

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

    </div>
  );
};

export default BipagemRapida;
