import React, { useState, useMemo, useEffect } from 'react';
import { db, REGIONAIS_PADRAO } from '../db/storage';
import {
  ProdutoAuditoria,
  EstatisticasRegional,
  FotoGrupoAuditoria,
  RelatorioLoteInfo,
  RegistroLoteFinalizado,
  StatusLote,
  HistoricoAlteracaoLote,
  SimNao,
} from '../types';
import { SamsungLogo } from '../components/SamsungLogo';
import { SolutionsLogo } from '../components/SolutionsLogo';
import { LOGO_SAMSUNG_BASE64, LOGO_SOLUTIONS_BASE64 } from '../assets/logosDataUri';
import { ModalVisualizarFotoLote } from '../components/ModalVisualizarFotoLote';
import {
  AbaGaleriaFotos,
  ModalImportarPlanilhaRegional,
  ModalHistoricoVersoesPlanilha,
} from '../features/admin/components';
import { isAdminOuSuper } from '../domain';
import {
  Building2,
  Boxes,
  Barcode,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  History,
  Upload,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  TrendingUp,
  PieChart,
  BarChart3,
  RefreshCw,
  Laptop,
  Monitor,
  Clock,
  Trash2,
  Camera,
  Folder,
  FolderOpen,
  ZoomIn,
  X,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  FileText,
  User,
  Edit2,
  Check,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const PainelAdmin: React.FC = () => {
  // Aba ativa: 'visao_geral', 'galeria_fotos' ou 'relatorio_lote' (Requisito 5)
  const [abaPrincipal, setAbaPrincipal] = useState<'visao_geral' | 'galeria_fotos' | 'relatorio_lote'>('visao_geral');
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoGrupoAuditoria | null>(null);

  // Estados da Aba Consulta de Lote Finalizado (Requisitos 7 e 8)
  const [loteSelecionado, setLoteSelecionado] = useState<string>(() => db.obterUltimoLote() || '01');
  const [regionalFiltroLote, setRegionalFiltroLote] = useState<string>('TODAS');
  const [filtroDataLote, setFiltroDataLote] = useState<string>('');
  const [filtroColaboradorLote, setFiltroColaboradorLote] = useState<string>('');
  const [filtroStatusLote, setFiltroStatusLote] = useState<'TODOS' | StatusLote>('TODOS');
  const [subAbaLote, setSubAbaLote] = useState<'fotos' | 'caixas' | 'produtos' | 'historico'>('fotos');

  // Estados para Reabertura de Lote (Exclusivo Administrador)
  const [mostrarModalReabertura, setMostrarModalReabertura] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [erroReabertura, setErroReabertura] = useState<string | null>(null);
  const [sucessoReabertura, setSucessoReabertura] = useState<string | null>(null);

  // Estados para Exclusão de Lote e Fotos (Exclusivo Administrador)
  const [mostrarModalExcluirLote, setMostrarModalExcluirLote] = useState(false);
  const [excluindoLote, setExcluindoLote] = useState(false);
  const [erroExclusaoLote, setErroExclusaoLote] = useState<string | null>(null);
  const [sucessoExclusaoLote, setSucessoExclusaoLote] = useState<string | null>(null);

  // Pesquisa de Lote (Requisito 3)
  const [inputPesquisaLote, setInputPesquisaLote] = useState<string>(() => db.obterUltimoLote() || '01');

  // Estados para Edição de Produtos pelo Administrador (Requisito 10)
  const [produtoParaEditar, setProdutoParaEditar] = useState<ProdutoAuditoria | null>(null);
  const [editFabricanteAdmin, setEditFabricanteAdmin] = useState('');
  const [editModeloAdmin, setEditModeloAdmin] = useState('');
  const [editEanAdmin, setEditEanAdmin] = useState('');
  const [editImeiAdmin, setEditImeiAdmin] = useState('');
  const [editCaixaAdmin, setEditCaixaAdmin] = useState('');
  const [editLoteAdmin, setEditLoteAdmin] = useState('');
  const [editLacreAdmin, setEditLacreAdmin] = useState<SimNao>('SIM');
  const [editNfAdmin, setEditNfAdmin] = useState<SimNao>('SIM');
  const [editKitAdmin, setEditKitAdmin] = useState<SimNao | ''>('');
  const [editMarcasAdmin, setEditMarcasAdmin] = useState<SimNao | ''>('');
  const [editObsAdmin, setEditObsAdmin] = useState('');
  const [motivoEdicaoAdmin, setMotivoEdicaoAdmin] = useState('');
  const [erroEdicaoAdmin, setErroEdicaoAdmin] = useState<string | null>(null);

  // Visualização Ampliada das Fotos Oficiais de Fechamento (Lightbox Modal)
  const [fotoVisualizar, setFotoVisualizar] = useState<{
    url: string;
    titulo: string;
    subtitulo?: string;
  } | null>(null);

  // Limpeza da Base de Testes (Item 2 do Prompt)
  const [mostrarModalLimpeza, setMostrarModalLimpeza] = useState(false);
  const [limpandoBase, setLimpandoBase] = useState(false);
  const [alertaLimpeza, setAlertaLimpeza] = useState<string | null>(null);

  // Pastas da Galeria
  const [pastaRegionalAberta, setPastaRegionalAberta] = useState<Record<string, boolean>>({
    'VIA VAREJO RJ': true,
    'VIA VAREJO SP': true,
    'VIA VAREJO MG': true,
    'VIA VAREJO BA': true,
  });
  const [pastaCaixaAberta, setPastaCaixaAberta] = useState<Record<string, boolean>>({});
  const [forcarAtualizacao, setForcarAtualizacao] = useState(0);

  // Seletor de visualização: 'CONSOLIDADO' ou nome de uma regional específica
  const [regionalAtiva, setRegionalAtiva] = useState<string>('CONSOLIDADO');

  // Estados para Importação de Planilha Regional de Referência (ADMIN ONLY)
  const [mostrarModalImportarPlanilha, setMostrarModalImportarPlanilha] = useState(false);
  const [mostrarModalHistoricoPlanilhas, setMostrarModalHistoricoPlanilhas] = useState(false);
  const [regionalParaImportar, setRegionalParaImportar] = useState<string>('VIA VAREJO BA');

  const usuarioAtual = db.getUsuarioAtual();
  const isAdmin = isAdminOuSuper(usuarioAtual?.perfil);

  // Listener para fechar modals com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fotoVisualizar) setFotoVisualizar(null);
        else if (fotoAmpliada) setFotoAmpliada(null);
        else if (mostrarModalReabertura) setMostrarModalReabertura(false);
        else if (mostrarModalExcluirLote) setMostrarModalExcluirLote(false);
        else if (produtoParaEditar) setProdutoParaEditar(null);
        else if (mostrarModalLimpeza) setMostrarModalLimpeza(false);
        else if (mostrarModalImportarPlanilha) setMostrarModalImportarPlanilha(false);
        else if (mostrarModalHistoricoPlanilhas) setMostrarModalHistoricoPlanilhas(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    fotoVisualizar,
    fotoAmpliada,
    mostrarModalReabertura,
    mostrarModalExcluirLote,
    produtoParaEditar,
    mostrarModalLimpeza,
    mostrarModalImportarPlanilha,
    mostrarModalHistoricoPlanilhas,
  ]);
  
  // Estados de Sincronização em Tempo Real com o Servidor Central
  const [atualizandoServidor, setAtualizandoServidor] = useState(false);
  const [ultimaAtualizacaoServidor, setUltimaAtualizacaoServidor] = useState<string>('');
  
  // Estados para tabela estilo Excel
  const [busca, setBusca] = useState('');
  const [filtroCaixa, setFiltroCaixa] = useState('TODAS');
  const [filtroLacrado, setFiltroLacrado] = useState('TODOS');
  const [filtroMarcas, setFiltroMarcas] = useState('TODOS');
  const [filtroComputador, setFiltroComputador] = useState('TODOS');
  const [filtroSync, setFiltroSync] = useState<'TODOS' | 'PENDENTE' | 'ENVIADO'>('TODOS');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);
  const [ordemCampo, setOrdemCampo] = useState<keyof ProdutoAuditoria>('id');
  const [ordemDirecao, setOrdemDirecao] = useState<'asc' | 'desc'>('desc');

  // Atualização reativa automática e sincronização contínua com o servidor central
  useEffect(() => {
    const atualizarDados = () => {
      setAtualizandoServidor(true);
      db.puxarAtualizacoesServidor().finally(() => {
        setAtualizandoServidor(false);
        setUltimaAtualizacaoServidor(new Date().toLocaleTimeString('pt-BR'));
        setForcarAtualizacao((v) => v + 1);
      });
    };

    atualizarDados();

    const unsub = db.onMudanca(() => {
      setForcarAtualizacao((v) => v + 1);
    });

    // Polling automático a cada 15 segundos para capturar novos envios de operadores e celulares em tempo real
    const intervalo = setInterval(atualizarDados, 15000);

    return () => {
      unsub();
      clearInterval(intervalo);
    };
  }, []);

  const estatisticasRegionais = useMemo(() => db.obterEstatisticasRegionais(), [forcarAtualizacao]);
  const metricasGerais = useMemo(() => db.obterMetricasDashboard('TODAS'), [forcarAtualizacao]);
  const metricasRegional = useMemo(() => db.obterMetricasDashboard(regionalAtiva), [regionalAtiva, forcarAtualizacao]);

  // Árvore de fotos de evidência organizada por regional e caixa (Item 10)
  const arvoreFotos = useMemo(() => {
    return db.obterArvoreFotosPorRegional();
  }, [forcarAtualizacao]);

  const totalFotosGerais = useMemo(() => {
    return (arvoreFotos || []).reduce(
      (acc, r) => acc + (r?.caixas || []).reduce((cAcc, c) => cAcc + (c?.fotos || []).length, 0),
      0
    );
  }, [arvoreFotos]);

  const executarLimpezaBase = async () => {
    setLimpandoBase(true);
    try {
      const res = await db.limparBaseOperacional();
      setAlertaLimpeza(res.mensagem);
      setPaginaAtual(1);
      setBusca('');
      setFiltroCaixa('TODAS');
      setFiltroLacrado('TODOS');
      setFiltroMarcas('TODOS');
      setFiltroComputador('TODOS');
      setFiltroSync('TODOS');
      setUltimaAtualizacaoServidor(new Date().toLocaleTimeString('pt-BR'));
      setForcarAtualizacao((v) => v + 1);
      setMostrarModalLimpeza(false);
      setTimeout(() => setAlertaLimpeza(null), 7000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert('Erro ao resetar base operacional: ' + msg);
    } finally {
      setLimpandoBase(false);
    }
  };

  // Detalhamento dos computadores da regional ativa (Item 7 do Prompt)
  const detalhamentoComputadores = useMemo(() => {
    if (regionalAtiva === 'CONSOLIDADO') return [];
    return db.obterDetalhamentoComputadoresRegional(regionalAtiva);
  }, [regionalAtiva]);

  // Lista de produtos da visão ativa
  const todosProdutosRegional = useMemo(() => {
    if (regionalAtiva === 'CONSOLIDADO') {
      return db.listarProdutos({ regional: 'TODAS' });
    }
    return db.listarProdutos({ regional: regionalAtiva });
  }, [regionalAtiva]);

  // Caixas disponíveis para o filtro
  const caixasDisponiveis = useMemo(() => {
    return db.listarCaixas(regionalAtiva === 'CONSOLIDADO' ? undefined : regionalAtiva);
  }, [regionalAtiva]);

  // Lista de Referência Regional & Lotes Dinâmicos (ADMIN ONLY)
  const batchAtivoRegional = useMemo(() => {
    if (regionalAtiva === 'CONSOLIDADO') return null;
    return db.listarHistoricoImportacoes(regionalAtiva).find((b) => b.status === 'ATIVA') || null;
  }, [regionalAtiva, forcarAtualizacao]);

  const totalImeisAtivosRegional = useMemo(() => {
    if (regionalAtiva === 'CONSOLIDADO') return 0;
    return db.obterListaAtivaReferencia(regionalAtiva).length;
  }, [regionalAtiva, forcarAtualizacao]);

  const lotesDinamicosRegional = useMemo(() => {
    if (regionalAtiva === 'CONSOLIDADO') return [];
    return db.listarLotesDinamicos(regionalAtiva);
  }, [regionalAtiva, forcarAtualizacao]);

  const formatarHora = (dataStr?: string | null): string => {
    if (!dataStr) return '-';
    try {
      const d = new Date(dataStr);
      if (isNaN(d.getTime())) return String(dataStr);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return String(dataStr);
    }
  };

  const formatarDataHora = (dataStr?: string | null): string => {
    if (!dataStr) return '-';
    try {
      const d = new Date(dataStr);
      if (isNaN(d.getTime())) return String(dataStr);
      return d.toLocaleString('pt-BR');
    } catch {
      return String(dataStr);
    }
  };

  // Filtragem e busca da tabela estilo Excel
  const produtosFiltrados = useMemo(() => {
    return (todosProdutosRegional || []).filter((p) => {
      if (!p) return false;
      if (busca) {
        const termo = busca.toLowerCase();
        const match =
          (p.imei || p.serial || '').toLowerCase().includes(termo) ||
          (p.modelo_produto || '').toLowerCase().includes(termo) ||
          (p.ean || '').toLowerCase().includes(termo) ||
          (p.numero_caixa || '').toLowerCase().includes(termo) ||
          (p.regional || '').toLowerCase().includes(termo) ||
          ((p.computador_id || '') && (p.computador_id || '').toLowerCase().includes(termo)) ||
          ((p.computador_nome || '') && (p.computador_nome || '').toLowerCase().includes(termo)) ||
          (p.observacao || '').toLowerCase().includes(termo);
        if (!match) return false;
      }
      if (filtroCaixa !== 'TODAS' && p.numero_caixa !== filtroCaixa) return false;
      if (filtroLacrado !== 'TODOS' && p.produto_lacrado !== filtroLacrado) return false;
      if (filtroMarcas !== 'TODOS' && p.aparelho_marcas_uso !== filtroMarcas) return false;
      if (filtroSync !== 'TODOS' && (p.status_sincronizacao || 'PENDENTE') !== filtroSync) return false;
      return true;
    });
  }, [todosProdutosRegional, busca, filtroCaixa, filtroLacrado, filtroMarcas, filtroComputador, filtroSync]);

  // Exportar Relatório Excel Geral do Painel Admin
  const exportarRelatorioExcel = () => {
    const lista = produtosOrdenados;
    const dadosExcel = lista.map((p, idx) => ({
      'Nº': idx + 1,
      Estação: p.computador_id || 'PC-01',
      Regional: p.regional || 'VIA VAREJO RJ',
      Fabricante: p.brand || p.fabricante || 'SAMSUNG',
      'Modelo Produto': p.modelo_produto || '-',
      SKU: p.sku || p.ean || '-',
      'IMEI (Bipar / Editar)': p.imei || p.serial,
      'NF Origem': p.origin_invoice || p.nf_origem || p.numero_nf || p.nf_conferida || '-',
      'Data Auditoria': p.data_auditoria,
      Caixa: p.box_name || p.numero_caixa,
      Lote: p.numero_lote || '01',
      Classificação: p.classificacao_produto || p.product_classification || p.box_classification || '-',
      'Produto Lacrado': p.produto_lacrado,
      'Lacre Segurança 🔒': p.lacre_seguranca || db.obterLacreCaixa(p.box_name || p.numero_caixa, p.regional) || '-',
      'Kit Completo': p.produto_lacrado === 'SIM' ? '-' : (p.kit_completo || '-'),
      'Marcas de Uso': p.produto_lacrado === 'SIM' ? '-' : (p.aparelho_marcas_uso || '-'),
      Observação: p.observacao || '-',
      'Status Sync':
        p.status_sincronizacao === 'ENVIADO'
          ? 'Enviado para Online'
          : p.status_sincronizacao === 'ERRO_DUPLICADO'
          ? 'Duplicado Servidor'
          : 'Aguardando envio para Online',
      Auditor: p.usuario_cadastro || '-',
      'Data Envio Online': p.data_sincronizacao ? new Date(p.data_sincronizacao).toLocaleDateString('pt-BR') : '-',
      'Horário Envio Online': p.data_sincronizacao ? new Date(p.data_sincronizacao).toLocaleTimeString('pt-BR') : '-',
      'ID Servidor': p.id_servidor || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    ws['!cols'] = [
      { wch: 6 },  // Nº
      { wch: 14 }, // Estação
      { wch: 18 }, // Regional
      { wch: 14 }, // Fabricante
      { wch: 34 }, // Modelo Produto
      { wch: 14 }, // SKU
      { wch: 22 }, // IMEI
      { wch: 16 }, // NF Origem
      { wch: 14 }, // Data Auditoria
      { wch: 12 }, // Caixa
      { wch: 10 }, // Lote
      { wch: 28 }, // Classificação
      { wch: 16 }, // Produto Lacrado
      { wch: 20 }, // Lacre Segurança 🔒
      { wch: 14 }, // Kit Completo
      { wch: 14 }, // Marcas de Uso
      { wch: 24 }, // Observação
      { wch: 20 }, // Status Sync
      { wch: 18 }, // Auditor
      { wch: 16 }, // Data Envio Online
      { wch: 18 }, // Horário Envio Online
      { wch: 18 }, // ID Servidor
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio_Geral');
    XLSX.writeFile(wb, `Relatorio_Geral_Auditoria_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Ordenação
  const produtosOrdenados = useMemo(() => {
    return [...produtosFiltrados].sort((a, b) => {
      const valA = a[ordemCampo] ?? '';
      const valB = b[ordemCampo] ?? '';
      if (typeof valA === 'string' && typeof valB === 'string') {
        return ordemDirecao === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (valA < valB) return ordemDirecao === 'asc' ? -1 : 1;
      if (valA > valB) return ordemDirecao === 'asc' ? 1 : -1;
      return 0;
    });
  }, [produtosFiltrados, ordemCampo, ordemDirecao]);

  // Paginação
  const totalPaginas = Math.ceil(produtosOrdenados.length / itensPorPagina) || 1;
  const produtosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return produtosOrdenados.slice(inicio, inicio + itensPorPagina);
  }, [produtosOrdenados, paginaAtual, itensPorPagina]);

  const alternarOrdem = (campo: keyof ProdutoAuditoria) => {
    if (ordemCampo === campo) {
      setOrdemDirecao(ordemDirecao === 'asc' ? 'desc' : 'asc');
    } else {
      setOrdemCampo(campo);
      setOrdemDirecao('asc');
    }
  };

  // =========================================================================
  // 1. EXPORTAÇÕES DA REGIONAL (EXCEL, PDF E IMPRESSÃO)
  // =========================================================================
  const exportarExcelRegional = (regionalAlvo: string) => {
    const lista = regionalAlvo === 'CONSOLIDADO'
      ? db.listarProdutos({ regional: 'TODAS' })
      : db.listarProdutos({ regional: regionalAlvo });

    const dadosExcel = lista.map((p, idx) => ({
      'Nº': idx + 1,
      Estação: p.computador_id || 'PC-01',
      Regional: p.regional || regionalAlvo,
      Fabricante: p.brand || p.fabricante || 'SAMSUNG',
      'Modelo Produto': p.modelo_produto || '-',
      SKU: p.sku || p.ean || '-',
      'IMEI (Bipar / Editar)': p.imei || p.serial,
      'NF Origem': p.origin_invoice || p.nf_origem || p.numero_nf || p.nf_conferida || '-',
      'Data Auditoria': p.data_auditoria,
      Caixa: p.box_name || p.numero_caixa,
      Lote: p.numero_lote || '01',
      Classificação: p.classificacao_produto || p.product_classification || p.box_classification || '-',
      'Produto Lacrado': p.produto_lacrado,
      'Lacre Segurança 🔒': p.lacre_seguranca || db.obterLacreCaixa(p.box_name || p.numero_caixa, p.regional || regionalAlvo) || '-',
      'Kit Completo': p.produto_lacrado === 'SIM' ? '-' : (p.kit_completo || '-'),
      'Marcas de Uso': p.produto_lacrado === 'SIM' ? '-' : (p.aparelho_marcas_uso || '-'),
      Observação: p.observacao || '-',
      'Status Sync':
        p.status_sincronizacao === 'ENVIADO'
          ? 'Enviado para Online'
          : p.status_sincronizacao === 'ERRO_DUPLICADO'
          ? 'Duplicado Servidor'
          : 'Aguardando envio para Online',
      Auditor: p.usuario_cadastro || '-',
      'Data Envio Online': p.data_sincronizacao ? new Date(p.data_sincronizacao).toLocaleDateString('pt-BR') : '-',
      'Horário Envio Online': p.data_sincronizacao ? new Date(p.data_sincronizacao).toLocaleTimeString('pt-BR') : '-',
      'ID Servidor': p.id_servidor || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    ws['!cols'] = [
      { wch: 6 },  // Nº
      { wch: 14 }, // Estação
      { wch: 18 }, // Regional
      { wch: 14 }, // Fabricante
      { wch: 34 }, // Modelo Produto
      { wch: 14 }, // SKU
      { wch: 22 }, // IMEI
      { wch: 16 }, // NF Origem
      { wch: 14 }, // Data Auditoria
      { wch: 12 }, // Caixa
      { wch: 10 }, // Lote
      { wch: 28 }, // Classificação
      { wch: 16 }, // Produto Lacrado
      { wch: 20 }, // Lacre Segurança 🔒
      { wch: 14 }, // Kit Completo
      { wch: 14 }, // Marcas de Uso
      { wch: 24 }, // Observação
      { wch: 20 }, // Status Sync
      { wch: 18 }, // Auditor
      { wch: 16 }, // Data Envio Online
      { wch: 18 }, // Horário Envio Online
      { wch: 18 }, // ID Servidor
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = regionalAlvo === 'CONSOLIDADO' ? 'Geral_Todas_Regionais' : regionalAlvo.replace(/\s+/g, '_').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    const fileName = regionalAlvo === 'CONSOLIDADO'
      ? `Auditoria_Consolidada_Todas_Regionais.xlsx`
      : `Auditoria_${regionalAlvo.replace(/\s+/g, '_')}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const exportarPDFRegional = (regionalAlvo: string) => {
    const lista = regionalAlvo === 'CONSOLIDADO'
      ? db.listarProdutos({ regional: 'TODAS' })
      : db.listarProdutos({ regional: regionalAlvo });

    const metricas = db.obterMetricasDashboard(regionalAlvo === 'CONSOLIDADO' ? undefined : regionalAlvo);
    const doc = new jsPDF('landscape');
    const nomeRegionalFormatado = regionalAlvo === 'CONSOLIDADO' ? 'CONSOLIDADO GERAL - TODAS AS REGIONAIS' : regionalAlvo;

    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 8, 36, 11.8);
      doc.addImage(LOGO_SAMSUNG_BASE64, 'PNG', 246, 8, 36, 15.4);
    } catch {
      // Fallback
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - DEPARTAMENTO DE AUDITORIA & QUALIDADE SAMSUNG', 14, 25);

    doc.setFontSize(11);
    doc.setTextColor(12, 77, 162);
    doc.text(`RELATÓRIO OFICIAL DE AUDITORIA - ${nomeRegionalFormatado}`, 14, 31);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Emissão: ${new Date().toLocaleString('pt-BR')} | Total: ${lista.length} produtos | Caixas: ${metricas.totalCaixas} | Lacrados: ${metricas.produtosLacrados} | Pendências: ${metricas.pendencias}`,
      14,
      36
    );

    const tableData = lista.map((p, idx) => [
      (idx + 1).toString(),
      p.computador_id || 'PC-01',
      p.brand || p.fabricante || 'SAMSUNG',
      p.modelo_produto || '-',
      p.sku || p.ean || '-',
      p.imei || p.serial,
      p.origin_invoice || p.nf_origem || p.numero_nf || p.nf_conferida || '-',
      p.box_name || p.numero_caixa,
      p.numero_lote || '01',
      p.classificacao_produto || p.product_classification || p.box_classification || '-',
      p.produto_lacrado,
      p.lacre_seguranca || db.obterLacreCaixa(p.box_name || p.numero_caixa, p.regional || regionalAlvo) || '-',
      p.status_sincronizacao === 'ENVIADO' ? '🟢 OK' : '🟡 Pend',
      p.data_auditoria,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nº', 'Estação', 'Fabricante', 'Modelo Produto', 'SKU', 'IMEI', 'NF Origem', 'Caixa', 'Lote', 'Classificação', 'Lacrado', 'Lacre Seg.', 'Sync', 'Data']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [12, 77, 162],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.5,
      },
      styles: {
        fontSize: 6,
        cellPadding: 1.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    if (finalY < 190) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.line(18, finalY + 10, 110, finalY + 10);
      doc.text('Auditoria Responsável Regional', 18, finalY + 15);

      doc.line(170, finalY + 10, 265, finalY + 10);
      doc.text('Diretoria de Operações Grupo Solutions', 170, finalY + 15);
    }

    const fileName = regionalAlvo === 'CONSOLIDADO'
      ? `Relatorio_Geral_Todas_Regionais_${new Date().toISOString().split('T')[0]}.pdf`
      : `Relatorio_Auditoria_${regionalAlvo.replace(/\s+/g, '_')}.pdf`;

    doc.save(fileName);
  };

  // =========================================================================
  // RELATÓRIO CONSOLIDADO POR LOTE (REQUISITO 5)
  // =========================================================================
  const lotesDisponiveis = useMemo(() => {
    return db.listarLotes(regionalFiltroLote === 'TODAS' ? undefined : regionalFiltroLote);
  }, [regionalFiltroLote, forcarAtualizacao]);

  const relatorioLote = useMemo(() => {
    const alvo = loteSelecionado?.trim() || (lotesDisponiveis[0] || '01');
    return db.obterRelatorioLote(
      alvo,
      regionalFiltroLote === 'TODAS' ? undefined : regionalFiltroLote
    );
  }, [loteSelecionado, regionalFiltroLote, lotesDisponiveis, forcarAtualizacao]);

  const loteFinalizadoAtual = useMemo(() => {
    const alvo = loteSelecionado?.trim() || (lotesDisponiveis[0] || '01');
    const regAlvo = regionalFiltroLote === 'TODAS' ? undefined : regionalFiltroLote;
    return db.obterLoteFinalizado(alvo, regAlvo);
  }, [loteSelecionado, regionalFiltroLote, lotesDisponiveis, forcarAtualizacao]);

  const lotesFinalizadosCadastrados = useMemo(() => {
    return db.listarLotesFinalizados({
      numero_lote: loteSelecionado.trim() ? loteSelecionado.trim() : undefined,
      regional: regionalFiltroLote === 'TODAS' ? undefined : regionalFiltroLote,
      data: filtroDataLote.trim() ? filtroDataLote.trim() : undefined,
      colaborador: filtroColaboradorLote.trim() ? filtroColaboradorLote.trim() : undefined,
      status: filtroStatusLote === 'TODOS' ? undefined : filtroStatusLote,
    });
  }, [loteSelecionado, regionalFiltroLote, filtroDataLote, filtroColaboradorLote, filtroStatusLote, forcarAtualizacao]);

  const handleReabrirLote = () => {
    setErroReabertura(null);
    if (!motivoReabertura.trim()) {
      setErroReabertura('Informe obrigatoriamente a justificativa/motivo para reabrir este lote.');
      return;
    }

    const regAlvo = loteFinalizadoAtual?.regional || (regionalFiltroLote === 'TODAS' ? 'VIA VAREJO RJ' : regionalFiltroLote);
    const alvo = loteSelecionado?.trim();
    if (!alvo) {
      setErroReabertura('Número do lote inválido.');
      return;
    }

    const adminAtual = db.getUsuarioAtual();
    const adminNome = adminAtual?.nome || 'Administrador Geral';

    const res = db.reabrirLoteAdmin(alvo, regAlvo, adminNome, motivoReabertura.trim());
    if (!res.sucesso) {
      setErroReabertura(res.erro || 'Erro ao reabrir lote.');
      return;
    }

    setSucessoReabertura(`Lote ${alvo} reaberto com sucesso! Operadores agora podem acessar e registrar produtos.`);
    setMostrarModalReabertura(false);
    setMotivoReabertura('');
    setForcarAtualizacao((c) => c + 1);
    setTimeout(() => setSucessoReabertura(null), 5000);
  };

  const handleFinalizarLoteAdmin = () => {
    const regAlvo = loteFinalizadoAtual?.regional || (regionalFiltroLote === 'TODAS' ? 'VIA VAREJO RJ' : regionalFiltroLote);
    const alvo = loteSelecionado?.trim();
    if (!alvo) return;

    const adminAtual = db.getUsuarioAtual();
    const adminNome = adminAtual?.nome || 'Administrador Geral';

    const res = db.finalizarLoteAdmin(alvo, regAlvo, adminNome, 'Lote finalizado novamente pelo Administrador após correções.');
    if (!res.sucesso) {
      alert(res.erro || 'Erro ao finalizar lote.');
      return;
    }

    setSucessoReabertura(`Lote ${alvo} finalizado com sucesso pelo Administrador! Status atualizado para LOTE FINALIZADO.`);
    setForcarAtualizacao((c) => c + 1);
    setTimeout(() => setSucessoReabertura(null), 5000);
  };

  const handleExcluirLote = async () => {
    const alvo = (loteSelecionado || loteFinalizadoAtual?.numero_lote || '').trim().toUpperCase();
    if (!alvo) {
      setErroExclusaoLote('Número do lote inválido para exclusão.');
      return;
    }

    const regAlvo = loteFinalizadoAtual?.regional || (regionalFiltroLote === 'TODAS' ? 'VIA VAREJO RJ' : regionalFiltroLote);
    setExcluindoLote(true);
    setErroExclusaoLote(null);

    try {
      const adminAtual = db.getUsuarioAtual();
      const adminNome = adminAtual?.nome || 'Administrador Geral';
      const res = await db.excluirLote(alvo, regAlvo, adminNome);

      if (res.sucesso) {
        setSucessoExclusaoLote(
          `Lote ${alvo} excluído com sucesso! Foram removidos ${res.produtosRemovidos} produtos e ${res.fotosRemovidas} evidências fotográficas.`
        );
        setMostrarModalExcluirLote(false);
        const lotesRestantes = db.listarLotesFinalizados();
        if (lotesRestantes.length > 0) {
          setLoteSelecionado(lotesRestantes[0].numero_lote);
          setInputPesquisaLote(lotesRestantes[0].numero_lote);
        } else {
          setLoteSelecionado('');
          setInputPesquisaLote('');
        }
        setForcarAtualizacao((c) => c + 1);
        setTimeout(() => setSucessoExclusaoLote(null), 7000);
      } else {
        setErroExclusaoLote(res.erro || 'Falha ao excluir lote.');
      }
    } catch (e: any) {
      setErroExclusaoLote(e?.message || 'Erro inesperado ao excluir o lote.');
    } finally {
      setExcluindoLote(false);
    }
  };

  const handlePesquisarLote = (termoCustom?: string) => {
    const alvo = (termoCustom !== undefined ? termoCustom : inputPesquisaLote).trim().toUpperCase();
    if (!alvo) return;
    setLoteSelecionado(alvo);
    setInputPesquisaLote(alvo);
    setForcarAtualizacao((c) => c + 1);
  };

  const abrirEdicaoProdutoAdmin = (p: ProdutoAuditoria) => {
    setProdutoParaEditar(p);
    setEditFabricanteAdmin(p.fabricante || p.brand || '');
    setEditModeloAdmin(p.modelo_produto);
    setEditEanAdmin(p.ean);
    setEditImeiAdmin(p.imei || p.serial);
    setEditCaixaAdmin(p.numero_caixa);
    setEditLoteAdmin(p.numero_lote || loteSelecionado || '01');
    setEditLacreAdmin(p.produto_lacrado);
    setEditNfAdmin(p.nf_conferida || 'SIM');
    setEditKitAdmin(p.kit_completo || '');
    setEditMarcasAdmin(p.aparelho_marcas_uso || '');
    setEditObsAdmin(p.observacao || '');
    setMotivoEdicaoAdmin('');
    setErroEdicaoAdmin(null);
  };

  const salvarEdicaoProdutoAdmin = () => {
    if (!produtoParaEditar) return;
    if (!editModeloAdmin.trim()) {
      setErroEdicaoAdmin('O modelo do produto é obrigatório.');
      return;
    }
    if (!editEanAdmin.trim()) {
      setErroEdicaoAdmin('O código EAN é obrigatório.');
      return;
    }
    if (!editImeiAdmin.trim() || !/^\d{15}$/.test(editImeiAdmin.trim())) {
      setErroEdicaoAdmin('IMEI INVÁLIDO: O IMEI deve conter exatamente 15 dígitos numéricos (ex: 357847400282342).');
      return;
    }
    if (!editCaixaAdmin.trim()) {
      setErroEdicaoAdmin('A caixa é obrigatória.');
      return;
    }

    const adminAtual = db.getUsuarioAtual();
    const adminNome = adminAtual?.nome || 'Administrador Geral';
    const loteDestino = editLoteAdmin.trim().toUpperCase() || '01';

    const res = db.atualizarProduto(produtoParaEditar.id, {
      modelo_produto: editModeloAdmin.trim(),
      fabricante: editFabricanteAdmin.trim() ? editFabricanteAdmin.trim().toUpperCase() : undefined,
      brand: editFabricanteAdmin.trim() ? editFabricanteAdmin.trim().toUpperCase() : undefined,
      ean: editEanAdmin.trim(),
      imei: editImeiAdmin.trim(),
      serial: editImeiAdmin.trim(),
      numero_caixa: editCaixaAdmin.trim().toUpperCase(),
      numero_lote: loteDestino,
      produto_lacrado: editLacreAdmin,
      nf_conferida: editNfAdmin,
      kit_completo: editLacreAdmin === 'SIM' ? null : (editKitAdmin as SimNao),
      aparelho_marcas_uso: editLacreAdmin === 'SIM' ? null : (editMarcasAdmin as SimNao),
      observacao: editObsAdmin.trim(),
    });

    if (!res.sucesso) {
      setErroEdicaoAdmin(res.erro || 'Erro ao atualizar produto.');
      return;
    }

    // Registrar detalhes completos da alteração no lote para auditoria oficial
    db.registrarAlteracaoLoteAdmin(
      loteDestino,
      produtoParaEditar.regional,
      adminNome,
      'ALTERACAO_DADO',
      `Admin ${adminNome} alterou produto IMEI ${editImeiAdmin.trim()} (Caixa: ${editCaixaAdmin.trim().toUpperCase()}, Lote: ${loteDestino}, Lacre: ${editLacreAdmin}, NF: ${editNfAdmin}). ${motivoEdicaoAdmin.trim() ? `Motivo: ${motivoEdicaoAdmin.trim()}` : ''}`
    );

    setSucessoReabertura(`Produto IMEI ${editImeiAdmin.trim()} atualizado com sucesso! Auditoria administrativa registrada.`);
    setProdutoParaEditar(null);
    setForcarAtualizacao((c) => c + 1);
    setTimeout(() => setSucessoReabertura(null), 5000);
  };

  const handleExcluirProdutoAdmin = (p: ProdutoAuditoria) => {
    if (!window.confirm(`Tem certeza que deseja excluir o produto IMEI ${p.imei || p.serial} (${p.modelo_produto}) da ${p.numero_caixa}?\n\nEsta alteração será registrada permanentemente no histórico de auditoria do lote.`)) {
      return;
    }

    const adminAtual = db.getUsuarioAtual();
    const adminNome = adminAtual?.nome || 'Administrador Geral';

    const res = db.excluirProduto(p.id);
    if (!res.sucesso) {
      alert(res.erro || 'Erro ao excluir produto.');
      return;
    }

    setSucessoReabertura(`Item IMEI ${p.imei || p.serial} excluído do Lote com registro na auditoria.`);
    setForcarAtualizacao((c) => c + 1);
    setTimeout(() => setSucessoReabertura(null), 5000);
  };

  const historicoLote = useMemo(() => {
    const todosLogs = db.listarHistorico(500);
    const imeisSet = new Set(relatorioLote.produtos.map((p) => p.serial.toUpperCase()));
    const loteUpper = relatorioLote.lote.toUpperCase();

    return todosLogs.filter((log) => {
      const dUpper = (log.detalhes || '').toUpperCase();
      if (dUpper.includes(`LOTE ${loteUpper}`) || dUpper.includes(`LOTE: ${loteUpper}`) || dUpper.includes(loteUpper)) return true;
      for (const imei of imeisSet) {
        if (dUpper.includes(imei)) return true;
      }
      return false;
    });
  }, [relatorioLote, forcarAtualizacao]);

  const exportarExcelLote = (rel: RelatorioLoteInfo) => {
    const wb = XLSX.utils.book_new();

    // Data e Hora de Fechamento separadas (Requisito 5)
    let dataFechamento = '-';
    let horaFechamento = '-';
    if (loteFinalizadoAtual?.data_fechamento) {
      try {
        const d = new Date(loteFinalizadoAtual.data_fechamento);
        if (!isNaN(d.getTime())) {
          dataFechamento = d.toLocaleDateString('pt-BR');
          horaFechamento = d.toLocaleTimeString('pt-BR');
        } else {
          const partes = loteFinalizadoAtual.data_fechamento.split(' ');
          dataFechamento = partes[0] || '-';
          horaFechamento = partes[1] || '-';
        }
      } catch {
        dataFechamento = loteFinalizadoAtual.data_fechamento;
      }
    } else if (rel.dataCriacao) {
      dataFechamento = rel.dataCriacao;
    }

    const statusLoteTexto = loteFinalizadoAtual?.status === 'FINALIZADO'
      ? 'LOTE FINALIZADO'
      : (loteFinalizadoAtual?.status === 'EM_ABERTO' ? 'LOTE REABERTO' : rel.status || 'EM ABERTO');

    const clienteNome = rel.cliente.includes('VIA VAREJO') ? 'VIA VAREJO' : (rel.cliente || 'SAMSUNG');
    const regionalNome = rel.cliente.replace(/VIA VAREJO\s*/i, '').trim() || rel.cliente;
    const colaboradorFechamento = loteFinalizadoAtual?.colaborador_fechamento || rel.colaboradorResponsavel || 'Operador';
    const numeroLoteFormatado = rel.lote.startsWith('LOTE') ? rel.lote : `LOTE ${rel.lote}`;

    // Aba 1 (Principal): Produtos do Lote Completo (Abre diretamente ao carregar o arquivo no Excel)
    const pendentesDoLote = loteFinalizadoAtual?.produtos_pendentes || [];

    const produtosData = rel.produtos.map((p, idx) => {
      let dataHoraLancamento = p.data_auditoria;
      if (p.data_cadastro) {
        try {
          const d = new Date(p.data_cadastro);
          if (!isNaN(d.getTime())) {
            dataHoraLancamento = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
          }
        } catch {}
      }

      return {
        'Nº': idx + 1,
        'Número do Lote': p.numero_lote || numeroLoteFormatado,
        'Caixa': p.numero_caixa,
        'Número do Lacre': p.lacre_seguranca || db.obterLacreCaixa(p.numero_caixa, p.regional || rel.cliente) || '-',
        'Cliente': clienteNome,
        'Regional': p.regional || regionalNome,
        'Fabricante': p.fabricante || 'SAMSUNG',
        'Modelo Produto': p.modelo_produto,
        'EAN': p.ean,
        'IMEI / Serial': p.imei || p.serial,
        'Produto Lacrado': p.produto_lacrado,
        'NF Conferida': p.nf_conferida || 'SIM',
        'Kit Completo': p.kit_completo || '-',
        'Marcas de Uso': p.aparelho_marcas_uso || '-',
        'Observações': p.observacao || '-',
        'Data/Hora Lançamento': dataHoraLancamento,
        'Colaborador Lançamento': p.usuario_cadastro || 'Operador',
        'Data Fechamento': dataFechamento,
        'Hora Fechamento': horaFechamento,
        'Colaborador Fechamento': colaboradorFechamento,
        'Status do Lote': statusLoteTexto,
        'Status Sincronização':
          p.status_sincronizacao === 'ENVIADO'
            ? 'Enviado para Online'
            : p.status_sincronizacao === 'ERRO_DUPLICADO'
            ? 'Duplicado Servidor'
            : 'Aguardando envio para Online',
      };
    });

    // Requisito: Produtos pendentes devem aparecer no relatório identificados como 'Não lançado' ou 'Não entregue pelo cliente' com Caixa = 0
    const produtosPendentesData = pendentesDoLote.map((item, pIdx) => {
      const motivoIdentificacao = item.motivo || loteFinalizadoAtual?.motivo_pendencias || 'Não lançado';
      return {
        'Nº': rel.produtos.length + pIdx + 1,
        'Número do Lote': numeroLoteFormatado,
        'Caixa': '0',
        'Número do Lacre': '-',
        'Cliente': clienteNome,
        'Regional': rel.cliente || regionalNome,
        'Fabricante': item.fabricante || 'SAMSUNG',
        'Modelo Produto': item.modelo || 'Modelo não especificado',
        'EAN': item.sku || '-',
        'IMEI / Serial': item.imei,
        'Produto Lacrado': motivoIdentificacao,
        'NF Conferida': 'NÃO',
        'Kit Completo': '-',
        'Marcas de Uso': '-',
        'Observações': loteFinalizadoAtual?.motivo_pendencias || item.motivo || 'Não entregue pelo cliente',
        'Data/Hora Lançamento': '-',
        'Colaborador Lançamento': '-',
        'Data Fechamento': dataFechamento,
        'Hora Fechamento': horaFechamento,
        'Colaborador Fechamento': colaboradorFechamento,
        'Status do Lote': statusLoteTexto,
        'Status Sincronização': motivoIdentificacao,
      };
    });

    const todosProdutosData = [...produtosData, ...produtosPendentesData];
    const wsProdutos = XLSX.utils.json_to_sheet(todosProdutosData);
    wsProdutos['!cols'] = [
      { wch: 6 },  // Nº
      { wch: 16 }, // Número do Lote
      { wch: 12 }, // Caixa
      { wch: 18 }, // Número do Lacre
      { wch: 16 }, // Cliente
      { wch: 18 }, // Regional
      { wch: 14 }, // Fabricante
      { wch: 26 }, // Modelo Produto
      { wch: 16 }, // EAN
      { wch: 18 }, // IMEI / Serial
      { wch: 18 }, // Produto Lacrado
      { wch: 16 }, // NF Conferida
      { wch: 14 }, // Kit Completo
      { wch: 14 }, // Marcas de Uso
      { wch: 22 }, // Observações
      { wch: 22 }, // Data/Hora Lançamento
      { wch: 24 }, // Colaborador Lançamento
      { wch: 16 }, // Data Fechamento
      { wch: 16 }, // Hora Fechamento
      { wch: 24 }, // Colaborador Fechamento
      { wch: 20 }, // Status do Lote
      { wch: 22 }, // Status Sincronização
    ];
    XLSX.utils.book_append_sheet(wb, wsProdutos, 'Produtos do Lote');

    // Aba 2: Resumo do Lote (Tabela com colunas completas)
    const resumoData = [
      {
        'Número do Lote': numeroLoteFormatado,
        'Cliente': clienteNome,
        'Regional': regionalNome,
        'Status do Lote': statusLoteTexto,
        'Data do Fechamento': dataFechamento,
        'Hora do Fechamento': horaFechamento,
        'Colaborador Responsável': colaboradorFechamento,
        'Quantidade de Caixas': rel.totalCaixas,
        'Quantidade Total de Produtos': rel.totalProdutos + pendentesDoLote.length,
        'Produtos Auditados': rel.totalProdutos,
        'Produtos Pendentes': pendentesDoLote.length,
        'Motivo Pendências': loteFinalizadoAtual?.motivo_pendencias || '-',
      },
    ];
    const wsResumo = XLSX.utils.json_to_sheet(resumoData);
    wsResumo['!cols'] = [
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 25 },
      { wch: 22 },
      { wch: 26 },
      { wch: 20 },
      { wch: 20 },
      { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo do Lote');

    // Aba 3: Caixas que Compõem o Lote
    const caixasData: Record<string, string | number>[] = rel.caixas.map((c, idx) => ({
      'Nº': idx + 1,
      'Número do Lote': numeroLoteFormatado,
      'Volume / Caixa': c.caixa,
      'Número do Lacre': db.obterLacreCaixa(c.caixa, rel.cliente) || '-',
      'Total de Produtos': c.totalProdutos,
      'Produtos Lacrados': c.lacrados,
      'Produtos Abertos': c.naoLacrados,
      'Status de Envio': c.statusEnvio,
    }));

    if (pendentesDoLote.length > 0) {
      caixasData.push({
        'Nº': caixasData.length + 1,
        'Número do Lote': numeroLoteFormatado,
        'Volume / Caixa': '0 (Pendentes / Não Lançados)',
        'Número do Lacre': '-',
        'Total de Produtos': pendentesDoLote.length,
        'Produtos Lacrados': 0,
        'Produtos Abertos': 0,
        'Status de Envio': loteFinalizadoAtual?.motivo_pendencias || 'Não lançado',
      });
    }

    const wsCaixas = XLSX.utils.json_to_sheet(caixasData);
    wsCaixas['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 26 },
      { wch: 18 }, // Número do Lacre
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCaixas, 'Caixas do Lote');

    XLSX.writeFile(wb, `Relatorio_Consolidado_Lote_${rel.lote}_${rel.cliente.replace(/\s+/g, '_')}.xlsx`);
  };

  const exportarPDFLote = (rel: RelatorioLoteInfo) => {
    const doc = new jsPDF('landscape');

    try {
      doc.addImage(LOGO_SOLUTIONS_BASE64, 'PNG', 14, 8, 36, 11.8);
      doc.addImage(LOGO_SAMSUNG_BASE64, 'PNG', 246, 8, 36, 15.4);
    } catch {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO SOLUTIONS - PAINEL DE GESTÃO E AUDITORIA', 14, 25);

    doc.setFontSize(11);
    doc.setTextColor(217, 119, 6);
    doc.text(`RELATÓRIO CONSOLIDADO POR LOTE • LOTE ${rel.lote}`, 14, 31);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Emissão: ${new Date().toLocaleString('pt-BR')} | Cliente: ${rel.cliente} | Responsável: ${loteFinalizadoAtual?.colaborador_fechamento || rel.colaboradorResponsavel} | Status: ${loteFinalizadoAtual?.status === 'FINALIZADO' ? 'LOTE FINALIZADO' : rel.status}`,
      14,
      37
    );

    // Summary Box
    doc.setDrawColor(217, 119, 6);
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(14, 41, 268, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 53, 15);
    doc.text(`NÚMERO DO LOTE: ${rel.lote}`, 18, 48);
    doc.text(`CLIENTE (REGIONAL): ${rel.cliente}`, 18, 54);

    doc.text(`QUANTIDADE DE CAIXAS: ${rel.totalCaixas}`, 105, 48);
    doc.text(`TOTAL DE PRODUTOS: ${rel.totalProdutos} unidades`, 105, 54);

    doc.text(`DATA CRIAÇÃO: ${rel.dataCriacao}`, 190, 48);
    doc.text(`STATUS: ${loteFinalizadoAtual?.status === 'FINALIZADO' ? 'LOTE FINALIZADO' : rel.status.toUpperCase()}`, 190, 54);

    const pendentesDoLote = loteFinalizadoAtual?.produtos_pendentes || [];

    // Table of Boxes
    const tableCaixas: string[][] = rel.caixas.map((c, idx) => [
      (idx + 1).toString(),
      c.caixa,
      db.obterLacreCaixa(c.caixa, rel.cliente) || '-',
      `${c.totalProdutos} produtos`,
      `${c.lacrados} lacrados`,
      `${c.naoLacrados} abertos`,
      c.statusEnvio,
    ]);

    if (pendentesDoLote.length > 0) {
      tableCaixas.push([
        (tableCaixas.length + 1).toString(),
        '0 (Pendentes / Não Lançados)',
        '-',
        `${pendentesDoLote.length} produtos`,
        '0 lacrados',
        '0 abertos',
        loteFinalizadoAtual?.motivo_pendencias || 'Não lançado',
      ]);
    }

    autoTable(doc, {
      startY: 64,
      head: [['#', 'Volume / Caixa', 'Número do Lacre', 'Qtd Produtos', 'Lacrados', 'Não Lacrados', 'Status Envio']],
      body: tableCaixas.length > 0 ? tableCaixas : [['-', 'Nenhuma caixa vinculada', '-', '-', '-', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: [217, 119, 6],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { fontStyle: 'bold' },
        2: { halign: 'center', fontStyle: 'bold' },
        3: { halign: 'center', fontStyle: 'bold' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center', fontStyle: 'bold' },
      },
    });

    let currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Table of Products com Lote | Caixa | Número do Lacre | Modelo | IMEI | Status / Lacrado | NF Conferida
    const tableProds: string[][] = rel.produtos.map((p, idx) => {
      let dataHoraLancamento = p.data_auditoria;
      if (p.data_cadastro) {
        try {
          const d = new Date(p.data_cadastro);
          if (!isNaN(d.getTime())) {
            dataHoraLancamento = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
          }
        } catch {}
      }

      return [
        (idx + 1).toString(),
        p.numero_lote || rel.lote,
        p.numero_caixa,
        p.lacre_seguranca || db.obterLacreCaixa(p.numero_caixa, p.regional || rel.cliente) || '-',
        p.modelo_produto,
        p.imei || p.serial,
        p.produto_lacrado,
        p.nf_conferida || 'SIM',
        dataHoraLancamento,
        p.usuario_cadastro || 'Operador',
      ];
    });

    // Inserir produtos pendentes com numeração de Caixa = 0 e motivo
    if (pendentesDoLote.length > 0) {
      for (let i = 0; i < pendentesDoLote.length; i++) {
        const item = pendentesDoLote[i];
        const motivoIdentificacao = item.motivo || loteFinalizadoAtual?.motivo_pendencias || 'Não lançado';
        tableProds.push([
          (rel.produtos.length + i + 1).toString(),
          rel.lote,
          '0',
          '-',
          item.modelo || 'Modelo não especificado',
          item.imei,
          motivoIdentificacao,
          'NÃO',
          '-',
          '-',
        ]);
      }
    }

    if (currentY > 170) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const totalAparelhosGeral = rel.produtos.length + pendentesDoLote.length;
    doc.text(
      `RELAÇÃO DE PRODUTOS DO LOTE ${rel.lote} (${totalAparelhosGeral} APARELHOS${pendentesDoLote.length > 0 ? ` • ${pendentesDoLote.length} PENDENTES` : ''})`,
      14,
      currentY
    );

    autoTable(doc, {
      startY: currentY + 4,
      head: [['#', 'Lote', 'Caixa', 'Número do Lacre', 'Modelo Produto', 'IMEI', 'Status / Lacrado', 'NF Conferida', 'Data/Hora', 'Colaborador']],
      body: tableProds.length > 0 ? tableProds : [['-', '-', '-', '-', 'Nenhum produto neste lote', '-', '-', '-', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    if (finalY < 190) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.line(18, finalY + 10, 110, finalY + 10);
      doc.text(`Responsável Operacional: ${rel.colaboradorResponsavel}`, 18, finalY + 15);

      doc.line(170, finalY + 10, 265, finalY + 10);
      doc.text('Supervisão Geral de Qualidade Samsung / Solutions', 170, finalY + 15);
    }

    doc.save(`Relatorio_Lote_${rel.lote}_${rel.cliente.replace(/\s+/g, '_')}.pdf`);
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header do Painel Administrativo */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-xs no-print">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-purple-200">
                Acesso Exclusivo Administrador
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Servidor Central Online
              </span>
              {ultimaAtualizacaoServidor && (
                <span className="text-[10px] text-slate-400 font-bold">
                  • Atualizado às {ultimaAtualizacaoServidor}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              <Building2 className="w-6 h-6 text-purple-600" />
              Servidor Central • Painel Administrativo
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Base consolidada do servidor central online: recepção de lotes, indicadores por regional, estações e fotos Samsung.
            </p>
          </div>

          {/* Botões de Ação Rápida no Topo */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Botão de Atualização em Tempo Real do Servidor */}
            <button
              onClick={async () => {
                setAtualizandoServidor(true);
                await db.puxarAtualizacoesServidor();
                setUltimaAtualizacaoServidor(new Date().toLocaleTimeString('pt-BR'));
                setForcarAtualizacao((v) => v + 1);
                setAtualizandoServidor(false);
              }}
              disabled={atualizandoServidor}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-60 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Consultar e sincronizar os lançamentos mais recentes das bancadas no servidor central"
            >
              <RefreshCw className={`w-4 h-4 ${atualizandoServidor ? 'animate-spin' : ''}`} />
              <span>{atualizandoServidor ? 'Atualizando...' : 'Atualizar Dados do Servidor'}</span>
            </button>
            {regionalAtiva !== 'CONSOLIDADO' && (
              <button
                onClick={() => setRegionalAtiva('CONSOLIDADO')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Consolidado
              </button>
            )}

            {/* Botão de Limpeza da Base de Testes (Requisito 2 do Prompt) */}
            <button
              onClick={() => setMostrarModalLimpeza(true)}
              className="bg-rose-700 hover:bg-rose-800 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Limpar todos os produtos, caixas, fotos e sincronizações para início dos testes"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Base de Testes
            </button>

            {/* Importar Planilha Regional de Referência (ADMIN ONLY) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setRegionalParaImportar(regionalAtiva !== 'CONSOLIDADO' ? regionalAtiva : 'VIA VAREJO BA');
                  setMostrarModalImportarPlanilha(true);
                }}
                className="bg-blue-900 hover:bg-blue-800 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Importar planilha de referência regional de IMEI e configurar lotes dinâmicos"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Importar Planilha Regional
              </button>
            )}

            <button
              onClick={() => exportarExcelRegional(regionalAtiva)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Baixar planilha completa em Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>

            <button
              onClick={() => exportarPDFRegional(regionalAtiva)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Baixar relatório profissional em PDF com logos"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>

            <button
              onClick={handleImprimir}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </div>

        {/* Alternador de Visão: Painel Operacional vs Galeria de Evidências em Pastas */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setAbaPrincipal('visao_geral')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
              abaPrincipal === 'visao_geral'
                ? 'bg-purple-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Painel Geral & Planilha
          </button>
          <button
            type="button"
            onClick={() => setAbaPrincipal('galeria_fotos')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
              abaPrincipal === 'galeria_fotos'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Camera className="w-4 h-4" />
            Galeria de Evidências por Pasta ({totalFotosGerais} fotos)
          </button>
          <button
            type="button"
            onClick={() => setAbaPrincipal('relatorio_lote')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
              abaPrincipal === 'relatorio_lote'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Lock className="w-4 h-4" />
            Consulta de Lote Finalizado
          </button>
        </div>

        {/* Barra de Navegação entre Regionais (visível no painel geral) */}
        {abaPrincipal === 'visao_geral' && (
        <div className="flex items-center gap-2 mt-4 pt-2 overflow-x-auto pb-1">
          {/* Botão com Destaque: REGIONAIS (Item 8 do Prompt) */}
          <button
            onClick={() => { setRegionalAtiva('CONSOLIDADO'); setPaginaAtual(1); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-2 cursor-pointer border-2 ${
              regionalAtiva === 'CONSOLIDADO'
                ? 'bg-purple-700 text-white border-purple-500 shadow-md ring-2 ring-purple-300'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-300'
            }`}
          >
            <Building2 className="w-4 h-4 text-purple-300" />
            <span>REGIONAIS</span>
            <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              4 Polos
            </span>
          </button>

          <div className="h-6 w-px bg-slate-200 shrink-0 mx-1" />

          {REGIONAIS_PADRAO.map((reg) => {
            const stats = estatisticasRegionais.find((e) => e.regional === reg);
            const total = stats?.totalProdutos || 0;
            const isAtivo = regionalAtiva === reg;

            return (
              <button
                key={reg}
                onClick={() => { setRegionalAtiva(reg); setPaginaAtual(1); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-2 cursor-pointer border ${
                  isAtivo
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <span>📍 {reg}</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                    isAtivo ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {total}
                </span>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {alertaLimpeza && (
        <div className="bg-emerald-100 border-2 border-emerald-500 text-emerald-950 rounded-2xl p-4 flex items-center gap-3 shadow-md animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-black">{alertaLimpeza}</span>
        </div>
      )}

      {abaPrincipal === 'visao_geral' && (
        <>
          {/* ======================================================================= */}
          {/* 1. SEÇÃO CONSOLIDADA GERAL (SELECIONADA QUANDO 'CONSOLIDADO') */}
          {/* ======================================================================= */}
          {regionalAtiva === 'CONSOLIDADO' && (
        <div className="space-y-6">
          {/* CARDS DAS REGIONAIS CONFORME ITEM 8 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                REGIONAIS ATIVAS (Clique em uma regional para abrir suas informações detalhadas):
              </h3>
              <span className="text-xs font-bold text-slate-400">
                {REGIONAIS_PADRAO.length} polos regionais
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {REGIONAIS_PADRAO.map((reg) => {
                const stats = estatisticasRegionais.find((e) => e.regional === reg);
                const total = stats?.totalProdutos || 0;
                const caixas = stats?.totalCaixas || 0;
                const pend = stats?.pendencias || 0;
                const taxa = stats?.taxaQualidade || 100;

                return (
                  <div
                    key={reg}
                    onClick={() => { setRegionalAtiva(reg); setPaginaAtual(1); }}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-2 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 uppercase">
                        📍 {reg}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>

                    <div className="space-y-1">
                      <div className="text-2xl font-black text-slate-900 tracking-tight">
                        {total} <span className="text-xs font-bold text-slate-400">aparelhos</span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Lotes / Caixas:</span>
                        <strong className="text-slate-800">{caixas}</strong>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>Taxa de Lacrados:</span>
                        <strong className="text-emerald-700">{taxa}%</strong>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>Pendências:</span>
                        <strong className={pend > 0 ? 'text-rose-600 font-black' : 'text-slate-700'}>
                          {pend}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TABELA CONSOLIDADA DE TODAS AS REGIONAIS (ITEM 10) */}
          <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Quadro Consolidado Comparativo de Regionais
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">Total Brasil</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Regional</th>
                    <th className="py-3 px-4 text-center">Produtos Auditados</th>
                    <th className="py-3 px-4 text-center">Caixas Auditadas</th>
                    <th className="py-3 px-4 text-center">Produtos Lacrados</th>
                    <th className="py-3 px-4 text-center">Não Lacrados</th>
                    <th className="py-3 px-4 text-center">Pendentes (Envio)</th>
                    <th className="py-3 px-4 text-center">% Qualidade</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {estatisticasRegionais.map((e) => (
                    <tr key={e.regional} className="hover:bg-slate-50 font-medium transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900 text-xs">
                        📍 {e.regional}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-blue-700 text-sm">
                        {e.totalProdutos}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700">
                        {e.totalCaixas}
                      </td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-bold">
                        {e.produtosLacrados}
                      </td>
                      <td className="py-3 px-4 text-center text-amber-700 font-bold">
                        {e.produtosNaoLacrados}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-black ${
                            e.pendencias > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {e.pendencias}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${e.taxaQualidade}%` }}
                            />
                          </div>
                          <span className="text-slate-700 text-[11px]">{e.taxaQualidade}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => { setRegionalAtiva(e.regional); setPaginaAtual(1); }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Ver Detalhes →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td className="py-3 px-4 uppercase tracking-wide text-xs">Total Consolidado:</td>
                    <td className="py-3 px-4 text-center text-blue-800 text-sm font-black">
                      {metricasGerais.totalAuditados}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-900">
                      {metricasGerais.totalCaixas}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-700">
                      {metricasGerais.produtosLacrados}
                    </td>
                    <td className="py-3 px-4 text-center text-amber-700">
                      {metricasGerais.produtosNaoLacrados}
                    </td>
                    <td className="py-3 px-4 text-center text-rose-700">
                      {metricasGerais.pendencias}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-700 font-black">
                      {metricasGerais.totalAuditados > 0
                        ? Math.round((metricasGerais.produtosLacrados / metricasGerais.totalAuditados) * 100)
                        : 100}%
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* GRÁFICOS COMPARATIVOS GERAIS (ITEM 10) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Volume por Regional */}
            <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Volume de Auditoria por Regional
                </h3>
                <span className="text-[11px] text-slate-400 font-bold">Comparativo</span>
              </div>

              <div className="space-y-3 pt-2">
                {estatisticasRegionais.map((item) => {
                  const maxTotal = Math.max(...estatisticasRegionais.map((e) => e.totalProdutos), 1);
                  const pct = Math.round((item.totalProdutos / maxTotal) * 100);

                  return (
                    <div key={item.regional} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">{item.regional}</span>
                        <span className="text-blue-700 font-black">{item.totalProdutos} produtos</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gráfico de Pendências por Regional */}
            <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Pendências de Envio Online por Regional
                </h3>
                <span className="text-[11px] text-slate-400 font-bold">Aguardando Envio</span>
              </div>

              <div className="space-y-3 pt-2">
                {estatisticasRegionais.map((item) => {
                  const maxPend = Math.max(...estatisticasRegionais.map((e) => e.pendencias), 1);
                  const pct = Math.round((item.pendencias / maxPend) * 100);

                  return (
                    <div key={item.regional} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">{item.regional}</span>
                        <span className={item.pendencias > 0 ? 'text-amber-600 font-black' : 'text-slate-400'}>
                          {item.pendencias} pendentes de envio
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 2. SEÇÃO DA REGIONAL SELECIONADA (ITEM 6, 7, 8, 9) */}
      {/* ======================================================================= */}
      {regionalAtiva !== 'CONSOLIDADO' && (
        <div className="space-y-6">
          {/* Banner da Regional com Indicadores (Item 6) */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                      Regional Samsung Solutions
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      Auditorias & Rastreabilidade
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase mt-1">
                    📍 {regionalAtiva}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportarExcelRegional(regionalAtiva)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel {regionalAtiva.replace('VIA VAREJO ', '')}
                  </button>
                  <button
                    onClick={() => exportarPDFRegional(regionalAtiva)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    PDF {regionalAtiva.replace('VIA VAREJO ', '')}
                  </button>
                </div>
              </div>

              {/* KPIs da Regional Selecionada (Item 6) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-300 uppercase block">Total Produtos</span>
                  <span className="text-2xl font-black text-white">{metricasRegional.totalAuditados}</span>
                  <span className="text-[10px] text-blue-300 block font-semibold mt-0.5">conferidos</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-300 uppercase block">Total Caixas</span>
                  <span className="text-2xl font-black text-white">{metricasRegional.totalCaixas}</span>
                  <span className="text-[10px] text-indigo-300 block font-semibold mt-0.5">lotes ativos</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-slate-300 uppercase block">Total Modelos</span>
                  <span className="text-2xl font-black text-white">{metricasRegional.produtosPorModelo.length}</span>
                  <span className="text-[10px] text-purple-300 block font-semibold mt-0.5">diferentes</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase block">Lacrados</span>
                  <span className="text-2xl font-black text-emerald-400">{metricasRegional.produtosLacrados}</span>
                  <span className="text-[10px] text-emerald-200 block font-semibold mt-0.5">
                    {metricasRegional.totalAuditados > 0
                      ? Math.round((metricasRegional.produtosLacrados / metricasRegional.totalAuditados) * 100)
                      : 100}%
                  </span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-amber-300 uppercase block">Não Lacrados</span>
                  <span className="text-2xl font-black text-amber-400">{metricasRegional.produtosNaoLacrados}</span>
                  <span className="text-[10px] text-amber-200 block font-semibold mt-0.5">abertos</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold text-rose-300 uppercase block">Pendências</span>
                  <span className="text-2xl font-black text-rose-400">{metricasRegional.pendencias}</span>
                  <span className="text-[10px] text-rose-200 block font-semibold mt-0.5">inconformes</span>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* CARD DE INVENTÁRIO DE REFERÊNCIA REGIONAL (IMEI & LOTES DINÂMICOS) */}
          {/* ======================================================================= */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full tracking-wider border border-blue-200">
                    Inventário de Referência Regional
                  </span>
                  {batchAtivoRegional && (
                    <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Versão Ativa v{batchAtivoRegional.version}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  Lista de Referência de IMEI • {regionalAtiva}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegionalParaImportar(regionalAtiva);
                    setMostrarModalHistoricoPlanilhas(true);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <History className="w-4 h-4 text-slate-500" />
                  Histórico de Versões
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegionalParaImportar(regionalAtiva);
                      setMostrarModalImportarPlanilha(true);
                    }}
                    className="bg-blue-900 hover:bg-blue-800 text-white text-xs font-black uppercase px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    {batchAtivoRegional ? 'Importar Nova Versão' : 'Importar Planilha'}
                  </button>
                )}
              </div>
            </div>

            {batchAtivoRegional ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total de IMEIs Ativos</span>
                    <span className="text-xl font-black text-emerald-600 block mt-0.5">
                      {totalImeisAtivosRegional}
                    </span>
                    <span className="text-[10px] text-slate-500">preenchimento automático O(1)</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Arquivo Fonte</span>
                    <span className="text-sm font-black text-slate-800 truncate block mt-0.5" title={batchAtivoRegional.file_name}>
                      {batchAtivoRegional.file_name}
                    </span>
                    <span className="text-[10px] text-slate-500">{batchAtivoRegional.row_count} linhas na planilha</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Importado Por</span>
                    <span className="text-sm font-black text-slate-800 truncate block mt-0.5">
                      {batchAtivoRegional.imported_by}
                    </span>
                    <span className="text-[10px] text-slate-500">Administrador Responsável</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Data de Ativação</span>
                    <span className="text-sm font-black text-slate-800 block mt-0.5">
                      {new Date(batchAtivoRegional.imported_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-[10px] text-slate-500">{new Date(batchAtivoRegional.imported_at).toLocaleTimeString('pt-BR')}</span>
                  </div>
                </div>

                {/* Lotes Dinâmicos Cadastrados */}
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase text-indigo-950 flex items-center gap-1.5 tracking-wider">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Lotes Automáticos Vinculados à Regional ({lotesDinamicosRegional.length})
                    </span>
                    <span className="text-[10px] text-indigo-700 font-semibold">
                      Determinação automática por Dealer
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {lotesDinamicosRegional.map((lot) => (
                      <span
                        key={lot.id}
                        className="bg-white border border-indigo-200 text-indigo-900 text-xs font-bold uppercase px-2.5 py-1 rounded-xl shadow-2xs"
                      >
                        🏷️ {lot.display_name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6 text-center space-y-2">
                <p className="text-sm font-bold text-slate-700">
                  Nenhuma planilha de referência cadastrada para {regionalAtiva}.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Aparelhos bipados nesta regional serão direcionados aos lotes FORA DA LISTA até que uma lista de referência seja importada.
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegionalParaImportar(regionalAtiva);
                      setMostrarModalImportarPlanilha(true);
                    }}
                    className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-black uppercase px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs mt-2"
                  >
                    <Upload className="w-4 h-4" />
                    Importar Planilha Agora
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ======================================================================= */}
          {/* ORIGEM DOS LANÇAMENTOS POR COMPUTADOR / ESTAÇÃO (ITEM 7 DO PROMPT) */}
          {/* ======================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200 tracking-wider">
                    Item 7 • Rastreabilidade por Posto
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-indigo-600" />
                  Computadores Vinculados & Origem dos Lançamentos ({regionalAtiva})
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Visualização da produção por máquina/estação que alimentou esta regional. Clique em um computador para filtrar a tabela.
                </p>
              </div>

              {filtroComputador !== 'TODOS' && (
                <button
                  onClick={() => setFiltroComputador('TODOS')}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                >
                  Limpar filtro de PC ({filtroComputador}) ✕
                </button>
              )}
            </div>

            {detalhamentoComputadores.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                Nenhum computador registrado nesta regional até o momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {detalhamentoComputadores.map((pc) => {
                  const isSelecionado = filtroComputador === pc.computador_id;
                  return (
                    <div
                      key={pc.computador_id}
                      onClick={() => {
                        setFiltroComputador(isSelecionado ? 'TODOS' : pc.computador_id);
                        setPaginaAtual(1);
                      }}
                      className={`rounded-2xl p-4 border-2 transition-all cursor-pointer relative ${
                        isSelecionado
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-200'
                          : 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                            <Laptop className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="font-mono font-black text-sm text-slate-900 block tracking-wide">
                              {pc.computador_id}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 block truncate max-w-[170px]">
                              {pc.computador_nome}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                          {pc.percentual}%
                        </span>
                      </div>

                      {/* Contador e Barra de Progresso */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Volume auditado:</span>
                          <span className="font-black text-slate-900">
                            {pc.totalAuditados.toLocaleString('pt-BR')}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">produtos</span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(pc.percentual, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Badges de Sincronização */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-[11px]">
                        <span className="flex items-center gap-1 font-bold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {pc.produtosEnviados.toLocaleString('pt-BR')} Enviados
                        </span>
                        <span className="flex items-center gap-1 font-bold text-amber-700">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          {pc.produtosPendentes.toLocaleString('pt-BR')} Pendentes
                        </span>
                      </div>

                      <div className="text-[10px] font-bold text-right mt-2 text-indigo-600">
                        {isSelecionado ? '✓ Filtrando tabela abaixo por este PC' : 'Clique para filtrar auditorias'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* GRÁFICOS DA REGIONAL (ITEM 8) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Gráfico 1: Produtos por Caixa */}
            <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  Produtos por Caixa
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Top Caixas</span>
              </div>

              {metricasRegional.produtosPorCaixa.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">Sem caixas registradas.</div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  {metricasRegional.produtosPorCaixa.slice(0, 5).map((item) => {
                    const max = metricasRegional.produtosPorCaixa[0]?.total || 1;
                    const pct = Math.round((item.total / max) * 100);
                    return (
                      <div key={item.caixa} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 truncate max-w-[180px]">{item.caixa}</span>
                          <span className="text-blue-700">{item.total} un</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gráfico 2: Lacrados x Não Lacrados */}
            <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-emerald-600" />
                  Lacrados x Não Lacrados
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Status Físico</span>
              </div>

              <div className="pt-2 flex flex-col items-center justify-center space-y-3">
                <div className="flex items-center gap-4 w-full">
                  <div className="flex-1 bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Lacrados</span>
                    <span className="text-2xl font-black text-emerald-800">{metricasRegional.produtosLacrados}</span>
                  </div>
                  <div className="flex-1 bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                    <span className="text-[10px] font-bold uppercase text-amber-700 block">Não Lacrados</span>
                    <span className="text-2xl font-black text-amber-800">{metricasRegional.produtosNaoLacrados}</span>
                  </div>
                </div>

                <div className="w-full space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600">
                    <span>Proporção de Lacre:</span>
                    <span>
                      {metricasRegional.totalAuditados > 0
                        ? Math.round((metricasRegional.produtosLacrados / metricasRegional.totalAuditados) * 100)
                        : 100}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-amber-200 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{
                        width: `${
                          metricasRegional.totalAuditados > 0
                            ? (metricasRegional.produtosLacrados / metricasRegional.totalAuditados) * 100
                            : 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico 3: Modelos Auditados */}
            <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  Modelos Auditados
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Por Modelo</span>
              </div>

              {metricasRegional.produtosPorModelo.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">Sem modelos registrados.</div>
              ) : (
                <div className="space-y-2 pt-1">
                  {metricasRegional.produtosPorModelo.slice(0, 5).map((item) => {
                    const max = metricasRegional.produtosPorModelo[0]?.total || 1;
                    const pct = Math.round((item.total / max) * 100);
                    return (
                      <div key={item.modelo} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 truncate max-w-[170px]">{item.modelo}</span>
                          <span className="text-indigo-700">{item.total} un</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* TABELA COMPLETA DA REGIONAL ESTILO EXCEL (ITEM 7) */}
          <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    Tabela Completa de Registros ({regionalAtiva})
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {produtosFiltrados.length} aparelhos encontrados
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => exportarExcelRegional(regionalAtiva)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Exportar para Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel ({regionalAtiva})
                </button>
              </div>

              {/* Controles de Filtros e Busca */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); setPaginaAtual(1); }}
                    placeholder="Buscar IMEI, modelo, EAN..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <select
                  value={filtroCaixa}
                  onChange={(e) => { setFiltroCaixa(e.target.value); setPaginaAtual(1); }}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold uppercase text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="TODAS">Todas as Caixas</option>
                  {caixasDisponiveis.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* Filtro por Computador / Estação (Item 7) */}
                <select
                  value={filtroComputador}
                  onChange={(e) => { setFiltroComputador(e.target.value); setPaginaAtual(1); }}
                  className="bg-indigo-50 border border-indigo-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none cursor-pointer"
                  title="Filtrar lançamentos por Computador / Estação"
                >
                  <option value="TODOS">💻 Todos os Computadores</option>
                  {detalhamentoComputadores.map((pc) => (
                    <option key={pc.computador_id} value={pc.computador_id}>
                      {pc.computador_id} ({pc.totalAuditados} un)
                    </option>
                  ))}
                </select>

                <select
                  value={filtroLacrado}
                  onChange={(e) => { setFiltroLacrado(e.target.value); setPaginaAtual(1); }}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold uppercase text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="TODOS">Lacre: Todos</option>
                  <option value="SIM">Lacrado: SIM</option>
                  <option value="NÃO">Lacrado: NÃO</option>
                </select>

                {/* Filtro por Status de Sincronização */}
                <select
                  value={filtroSync}
                  onChange={(e) => { setFiltroSync(e.target.value as 'TODOS' | 'PENDENTE' | 'ENVIADO'); setPaginaAtual(1); }}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  title="Filtrar por status de envio online"
                >
                  <option value="TODOS">Sync: Todos</option>
                  <option value="ENVIADO">🟢 Enviados para Online</option>
                  <option value="PENDENTE">🟡 Aguardando envio para Online</option>
                </select>
              </div>
            </div>

            {/* Grid da Tabela Estilo Excel */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0C4DA2] text-white uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12 border-r border-blue-600">Nº</th>
                    <th className="py-2.5 px-3 border-r border-blue-600 min-w-[100px]">Estação 💻</th>
                    <th className="py-2.5 px-3 border-r border-blue-600 min-w-[110px]">Fabricante</th>
                    <th
                      onClick={() => alternarOrdem('modelo_produto')}
                      className="py-2.5 px-4 border-r border-blue-600 cursor-pointer select-none hover:bg-blue-800"
                    >
                      <div className="flex items-center gap-1">
                        <span>Modelo Produto</span>
                        <ArrowUpDown className="w-3 h-3 text-blue-200" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 font-mono border-r border-blue-600">SKU</th>
                    <th
                      onClick={() => alternarOrdem('serial')}
                      className="py-2.5 px-4 font-mono border-r border-blue-600 cursor-pointer select-none hover:bg-blue-800"
                    >
                      <div className="flex items-center gap-1">
                        <span>IMEI (Bipar / Editar)</span>
                        <ArrowUpDown className="w-3 h-3 text-blue-200" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 border-r border-blue-600 min-w-[110px]">NF Origem</th>
                    <th
                      onClick={() => alternarOrdem('data_auditoria')}
                      className="py-2.5 px-3 text-center border-r border-blue-600 cursor-pointer select-none hover:bg-blue-800"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Data Auditoria</span>
                        <ArrowUpDown className="w-3 h-3 text-blue-200" />
                      </div>
                    </th>
                    <th
                      onClick={() => alternarOrdem('numero_caixa')}
                      className="py-2.5 px-3 border-r border-blue-600 cursor-pointer select-none hover:bg-blue-800"
                    >
                      <div className="flex items-center gap-1">
                        <span>Caixa</span>
                        <ArrowUpDown className="w-3 h-3 text-blue-200" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-600">Lote</th>
                    <th className="py-2.5 px-3 border-r border-blue-600 min-w-[150px]">Classificação</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-600">Produto Lacrado</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-600 min-w-[110px] bg-blue-900/40">Lacre Segurança 🔒</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-600">Kit Compl.</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-600">Marcas Uso</th>
                    <th className="py-2.5 px-4 border-r border-blue-600">Observação</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-600 min-w-[95px]">Status Sync</th>
                    <th className="py-2.5 px-3 text-center min-w-[120px]">Horário Envio 🕒</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {produtosPaginados.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="py-12 text-center text-slate-400 font-sans">
                        Nenhum registro encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    produtosPaginados.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-sans border-r border-slate-200">
                          {(paginaAtual - 1) * itensPorPagina + idx + 1}
                        </td>
                        <td className="py-2 px-3 font-sans border-r border-slate-200 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-200 block">
                            💻 {p.computador_id || 'PC-01'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {p.brand || p.fabricante || 'SAMSUNG'}
                        </td>
                        <td className="py-2 px-4 font-sans font-bold text-slate-900 border-r border-slate-200 min-w-[180px]">
                          {p.modelo_produto || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 border-r border-slate-200 font-bold whitespace-nowrap">
                          {p.sku || p.ean || '-'}
                        </td>
                        <td className="py-2 px-4 font-black text-slate-900 tracking-wider border-r border-slate-200 whitespace-nowrap">
                          <div>{p.imei || p.serial}</div>
                          {p.source_type === 'LISTED' && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 inline-block mt-0.5">
                              ✓ {p.dealer || 'PRODUTO NA LISTA SAMSUNG'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-sans text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {p.origin_invoice || p.nf_origem || p.numero_nf || p.nf_conferida || '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-sans text-slate-500 border-r border-slate-200 whitespace-nowrap">
                          {p.data_auditoria}
                        </td>
                        <td className="py-2 px-3 font-sans font-bold text-blue-700 uppercase border-r border-slate-200 whitespace-nowrap">
                          {p.box_name || p.numero_caixa}
                        </td>
                        <td className="py-2 px-3 text-center font-sans border-r border-slate-200 whitespace-nowrap">
                          <span className="bg-amber-50 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                            LOTE {p.numero_lote || '01'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans text-xs border-r border-slate-200">
                          <span className="font-bold px-2 py-0.5 rounded text-[10px] border bg-blue-50 text-blue-900 border-blue-200 whitespace-nowrap block truncate max-w-[200px]" title={p.classificacao_produto || p.product_classification || p.box_classification || '-'}>
                            {p.classificacao_produto || p.product_classification || p.box_classification || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-sans border-r border-slate-200">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              p.produto_lacrado === 'SIM'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.produto_lacrado}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono border-r border-slate-200 bg-indigo-50/20 whitespace-nowrap">
                          {p.lacre_seguranca || db.obterLacreCaixa(p.box_name || p.numero_caixa, p.regional) ? (
                            <span className="font-mono font-black px-2 py-0.5 rounded text-[10px] border bg-indigo-100 text-indigo-900 border-indigo-300">
                              {p.lacre_seguranca || db.obterLacreCaixa(p.box_name || p.numero_caixa, p.regional)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-sans border-r border-slate-200 text-slate-600">
                          {p.kit_completo || '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-sans border-r border-slate-200">
                          <span
                            className={`font-bold ${
                              p.aparelho_marcas_uso === 'SIM' ? 'text-rose-600' : 'text-slate-500'
                            }`}
                          >
                            {p.aparelho_marcas_uso || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-4 font-sans text-slate-600 max-w-xs truncate border-r border-slate-200">
                          {p.observacao || '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-sans border-r border-slate-200">
                          <span
                            className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                              p.status_sincronizacao === 'ENVIADO'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : p.status_sincronizacao === 'ERRO_DUPLICADO'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.status_sincronizacao === 'ENVIADO'
                                  ? 'bg-emerald-600'
                                  : 'bg-amber-600 animate-pulse'
                              }`}
                            />
                            {p.status_sincronizacao === 'ENVIADO'
                              ? 'Enviado para Online'
                              : p.status_sincronizacao === 'ERRO_DUPLICADO'
                              ? 'Duplicado Servidor'
                              : 'Aguardando envio para Online'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-sans whitespace-nowrap">
                          {p.status_sincronizacao === 'ENVIADO' && p.data_sincronizacao ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{formatarHora(p.data_sincronizacao)}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação da Tabela Estilo Excel */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Itens por página:</span>
                <select
                  value={itensPorPagina}
                  onChange={(e) => { setItensPorPagina(Number(e.target.value)); setPaginaAtual(1); }}
                  className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-800 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  Mostrando {(paginaAtual - 1) * itensPorPagina + 1} a{' '}
                  {Math.min(paginaAtual * itensPorPagina, produtosFiltrados.length)} de{' '}
                  {produtosFiltrados.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))}
                  disabled={paginaAtual === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 font-bold text-slate-800">
                  Página {paginaAtual} de {totalPaginas}
                </span>
                <button
                  onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))}
                  disabled={paginaAtual >= totalPaginas}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* ======================================================================= */}
      {/* 2. ÁREA DE CONSULTA DE FOTOS EM PASTAS (ITEM 10 DO PROMPT) */}
      {/* ======================================================================= */}
      {abaPrincipal === 'galeria_fotos' && (
        <AbaGaleriaFotos
          totalFotosGerais={totalFotosGerais}
          arvoreFotos={arvoreFotos}
          pastaRegionalAberta={pastaRegionalAberta}
          setPastaRegionalAberta={setPastaRegionalAberta}
          pastaCaixaAberta={pastaCaixaAberta}
          setPastaCaixaAberta={setPastaCaixaAberta}
          setFotoAmpliada={setFotoAmpliada}
          formatarDataHora={formatarDataHora}
        />
      )}

      {/* ======================================================================= */}
      {/* 3. ABA CONSULTA DE LOTE FINALIZADO (REQUISITOS 7 e 8 DO PROMPT) */}
      {/* ======================================================================= */}
      {abaPrincipal === 'relatorio_lote' && (
        <div className="space-y-6">
          {/* Notificação de Sucesso para Ações Administrativas */}
          {sucessoReabertura && (
            <div className="bg-emerald-100 border-2 border-emerald-500 text-emerald-900 rounded-2xl p-4 flex items-center gap-3 shadow-md animate-in fade-in">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <span className="font-black text-sm block">Ação Administrativa Concluída com Sucesso:</span>
                <span className="text-xs font-semibold">{sucessoReabertura}</span>
              </div>
            </div>
          )}

          {sucessoExclusaoLote && (
            <div className="bg-emerald-100 border-2 border-emerald-500 text-emerald-900 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md animate-in fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-black text-sm block">Lote Excluído com Sucesso:</span>
                  <span className="text-xs font-semibold">{sucessoExclusaoLote}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSucessoExclusaoLote(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1.5 rounded-lg cursor-pointer"
                title="Fechar notificação"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Card de Filtros e Seleção do Lote (5 Filtros Obrigatórios: Lote, Cliente, Data, Colaborador, Status) */}
          <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-amber-200 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    Controle e Auditoria de Lote
                  </span>
                  {loteFinalizadoAtual && (
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                        loteFinalizadoAtual.status === 'FINALIZADO'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-blue-100 text-blue-800 border-blue-300'
                      }`}
                    >
                      {loteFinalizadoAtual.status === 'FINALIZADO' ? '🔒 Lote Finalizado' : '🔓 Lote Reaberto'}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-600" />
                  Consulta de Lote Finalizado
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Audite lotes fechados, inspecione a galeria com as 3 fotos obrigatórias (Caixa Fechada, Espelho, Lacre) e gerencie permissões administrativas.
                </p>
              </div>

              {/* Botões de Ação do Lote */}
              <div className="flex flex-wrap items-center gap-2">
                {loteFinalizadoAtual?.status === 'FINALIZADO' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMotivoReabertura('');
                      setErroReabertura(null);
                      setMostrarModalReabertura(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase px-3.5 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer ring-1 ring-amber-400 active:scale-95"
                    title="Reabrir este lote para permitir novos lançamentos pelo operador (Ação Exclusiva de Administrador)"
                  >
                    <Unlock className="w-4 h-4 text-slate-950" />
                    Reabrir Lote
                  </button>
                )}

                {loteFinalizadoAtual?.status === 'EM_ABERTO' && (
                  <button
                    type="button"
                    onClick={handleFinalizarLoteAdmin}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-3.5 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer ring-1 ring-emerald-400 active:scale-95"
                    title="Finalizar este lote novamente com status de bloqueio"
                  >
                    <Lock className="w-4 h-4 text-white" />
                    Finalizar Lote Novamente
                  </button>
                )}

                {(loteFinalizadoAtual || loteSelecionado) && (
                  <button
                    type="button"
                    onClick={() => {
                      setErroExclusaoLote(null);
                      setMostrarModalExcluirLote(true);
                    }}
                    className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs uppercase px-3.5 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer ring-1 ring-rose-500 active:scale-95"
                    title="Excluir este lote, todas as suas fotos e produtos associados permanentemente (Exclusivo Administrador)"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                    Excluir Lote
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => exportarExcelLote(relatorioLote)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-3.5 py-2 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Exportar dados consolidados do lote para planilha Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => exportarPDFLote(relatorioLote)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase px-3.5 py-2 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Gerar PDF executivo do lote com cabeçalho oficial"
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </button>
                <button
                  type="button"
                  onClick={handleImprimir}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase px-3.5 py-2 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Imprimir relatório do lote"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
              </div>
            </div>

            {/* Campo e Botão Dedicado: PESQUISAR LOTE (Requisito 3) */}
            <div className="bg-amber-100/70 border-2 border-amber-400 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-end gap-3 shadow-2xs">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-amber-700" />
                  Número do Lote:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputPesquisaLote}
                    onChange={(e) => {
                      setInputPesquisaLote(e.target.value.toUpperCase());
                      setLoteSelecionado(e.target.value.toUpperCase());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePesquisarLote();
                    }}
                    placeholder="Digite o número do lote (Ex: 01, LOTE 02)..."
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-amber-400 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase placeholder:text-slate-400 shadow-inner"
                  />
                  {inputPesquisaLote && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputPesquisaLote('');
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      title="Limpar campo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handlePesquisarLote()}
                className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs uppercase px-6 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0 border border-amber-400"
                title="Carregar todas as informações do lote selecionado"
              >
                <Search className="w-4 h-4" />
                🔎 PESQUISAR LOTE
              </button>
            </div>

            {/* Controles de Filtro: 1. Número do Lote, 2. Cliente, 3. Data, 4. Colaborador, 5. Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
              {/* Filtro 1: Número do Lote */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-amber-600" />
                  Número do Lote
                </label>
                <input
                  type="text"
                  value={loteSelecionado}
                  onChange={(e) => {
                    setLoteSelecionado(e.target.value.toUpperCase());
                    setInputPesquisaLote(e.target.value.toUpperCase());
                  }}
                  placeholder="Ex: 01, LOTE 02..."
                  className="w-full px-3 py-2 bg-white border-2 border-amber-300 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase"
                />
              </div>

              {/* Filtro 2: Cliente / Regional */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  Cliente / Regional
                </label>
                <select
                  value={regionalFiltroLote}
                  onChange={(e) => setRegionalFiltroLote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="TODAS">TODAS AS REGIONAIS (Geral)</option>
                  {REGIONAIS_PADRAO.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro 3: Data Fechamento */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  Data Fechamento
                </label>
                <input
                  type="text"
                  value={filtroDataLote}
                  onChange={(e) => setFiltroDataLote(e.target.value)}
                  placeholder="Ex: 15/09/2026"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Filtro 4: Colaborador Responsável */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  Colaborador
                </label>
                <input
                  type="text"
                  value={filtroColaboradorLote}
                  onChange={(e) => setFiltroColaboradorLote(e.target.value)}
                  placeholder="Ex: João da Silva..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Filtro 5: Status do Lote */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-amber-600" />
                  Status
                </label>
                <div className="flex gap-2">
                  <select
                    value={filtroStatusLote}
                    onChange={(e) => setFiltroStatusLote(e.target.value as 'TODOS' | StatusLote)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="TODOS">Todos os Status</option>
                    <option value="FINALIZADO">🔒 Finalizados</option>
                    <option value="EM_ABERTO">🔓 Reabertos / Em Aberto</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setLoteSelecionado('01');
                      setRegionalFiltroLote('TODAS');
                      setFiltroDataLote('');
                      setFiltroColaboradorLote('');
                      setFiltroStatusLote('TODOS');
                    }}
                    className="px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 transition-colors cursor-pointer shrink-0"
                    title="Limpar todos os filtros"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Lotes Finalizados Registrados no Sistema */}
              {lotesFinalizadosCadastrados.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-5 pt-2 border-t border-amber-200/60 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-amber-900 mr-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-700" />
                    Lotes Finalizados:
                  </span>
                  {lotesFinalizadosCadastrados.map((fin) => (
                    <button
                      key={fin.id}
                      type="button"
                      onClick={() => {
                        setLoteSelecionado(fin.numero_lote);
                        setRegionalFiltroLote(fin.regional);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all cursor-pointer border flex items-center gap-1.5 ${
                        loteSelecionado === fin.numero_lote && (regionalFiltroLote === 'TODAS' || regionalFiltroLote === fin.regional)
                          ? 'bg-rose-700 text-white border-rose-800 shadow-xs scale-105'
                          : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      <span>{fin.status === 'FINALIZADO' ? '🔒' : '🔓'}</span>
                      <span>Lote {fin.numero_lote} ({fin.regional})</span>
                      <span className="text-[10px] opacity-75 font-normal">({fin.total_produtos} un)</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Demais Lotes Detectados */}
              {lotesDisponiveis.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-5 pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 mr-1">Todos os Lotes:</span>
                  {lotesDisponiveis.map((lt) => (
                    <button
                      key={lt}
                      type="button"
                      onClick={() => setLoteSelecionado(lt)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer border ${
                        loteSelecionado === lt
                          ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Lote {lt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resumo Consolidado do Lote Selecionado */}
          <div
            className={`rounded-3xl p-6 shadow-xl relative overflow-hidden text-white transition-all ${
              loteFinalizadoAtual?.status === 'FINALIZADO'
                ? 'bg-gradient-to-br from-rose-700 via-rose-800 to-slate-900 border-2 border-rose-500/50'
                : loteFinalizadoAtual?.status === 'EM_ABERTO'
                ? 'bg-gradient-to-br from-indigo-700 via-blue-800 to-slate-900 border-2 border-indigo-400/50'
                : 'bg-gradient-to-br from-amber-600 via-amber-700 to-slate-900 border-2 border-amber-500/50'
            }`}
          >
            <div className="relative z-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/30 text-white shadow-inner">
                    {loteFinalizadoAtual?.status === 'FINALIZADO' ? (
                      <Lock className="w-6 h-6 text-amber-300" />
                    ) : loteFinalizadoAtual?.status === 'EM_ABERTO' ? (
                      <Unlock className="w-6 h-6 text-emerald-300" />
                    ) : (
                      <Layers className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-200">
                      {loteFinalizadoAtual?.status === 'FINALIZADO'
                        ? 'LOTE AUDITADO E FINALIZADO COM SUCESSO'
                        : loteFinalizadoAtual?.status === 'EM_ABERTO'
                        ? 'LOTE REABERTO PELO ADMINISTRADOR'
                        : 'LOTE EM ANDAMENTO'}
                    </span>
                    <h2 className="text-2xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                      LOTE: {relatorioLote.lote}
                      {loteFinalizadoAtual?.status === 'FINALIZADO' && (
                        <span className="bg-rose-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Bloqueado
                        </span>
                      )}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-xs border ${
                      loteFinalizadoAtual?.status === 'FINALIZADO'
                        ? 'bg-rose-600 text-white border-rose-400'
                        : loteFinalizadoAtual?.status === 'EM_ABERTO'
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-amber-800 text-amber-100 border-amber-600'
                    }`}
                  >
                    ● {loteFinalizadoAtual ? `STATUS: LOTE ${loteFinalizadoAtual.status === 'FINALIZADO' ? 'FINALIZADO' : 'REABERTO'}` : `● ${relatorioLote.status}`}
                  </span>
                </div>
              </div>

              {/* Grid com os 6 Indicadores do Lote */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
                  <span className="text-[10px] font-bold text-amber-200 uppercase block">Cliente / Regional</span>
                  <span className="text-sm font-black text-white truncate block mt-0.5" title={relatorioLote.cliente}>
                    {relatorioLote.cliente}
                  </span>
                </div>

                <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
                  <span className="text-[10px] font-bold text-amber-200 uppercase block">Quantidade de Caixas</span>
                  <span className="text-2xl font-black text-white block mt-0.5">
                    {loteFinalizadoAtual?.total_caixas ?? relatorioLote.totalCaixas}
                  </span>
                  <span className="text-[10px] text-amber-100">volumes vinculados</span>
                </div>

                <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
                  <span className="text-[10px] font-bold text-amber-200 uppercase block">Total de Produtos</span>
                  <span className="text-2xl font-black text-white block mt-0.5">
                    {loteFinalizadoAtual?.total_produtos ?? relatorioLote.totalProdutos}
                  </span>
                  <span className="text-[10px] text-amber-100">aparelhos conferidos</span>
                </div>

                <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
                  <span className="text-[10px] font-bold text-amber-200 uppercase block">Data de Fechamento</span>
                  <span className="text-xs font-black text-white block mt-1">
                    {loteFinalizadoAtual?.data_fechamento || relatorioLote.dataCriacao}
                  </span>
                </div>

                <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
                  <span className="text-[10px] font-bold text-amber-200 uppercase block">Colaborador Resp.</span>
                  <span
                    className="text-xs font-black text-white truncate block mt-1"
                    title={loteFinalizadoAtual?.colaborador_fechamento || relatorioLote.colaboradorResponsavel}
                  >
                    {loteFinalizadoAtual?.colaborador_fechamento || relatorioLote.colaboradorResponsavel}
                  </span>
                </div>

                <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
                  <span className="text-[10px] font-bold text-amber-200 uppercase block">Evidências Oficiais</span>
                  <span className="text-xs font-black text-white truncate block mt-1">
                    {loteFinalizadoAtual?.fotos ? '✓ 3 Fotos Anexadas' : 'Pendente de Fotos'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-abas de Visualização Detalhada */}
          <div className="bg-white rounded-2xl border-2 border-slate-300 overflow-hidden shadow-xs">
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSubAbaLote('fotos')}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer border-t-2 border-x-2 -mb-px whitespace-nowrap ${
                  subAbaLote === 'fotos'
                    ? 'bg-white text-amber-700 border-slate-300 border-b-transparent shadow-xs'
                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                <Camera className="w-4 h-4" />
                Galeria 3 Fotos Oficiais {loteFinalizadoAtual ? '(3 anexadas)' : ''}
              </button>

              <button
                type="button"
                onClick={() => setSubAbaLote('caixas')}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer border-t-2 border-x-2 -mb-px whitespace-nowrap ${
                  subAbaLote === 'caixas'
                    ? 'bg-white text-amber-700 border-slate-300 border-b-transparent shadow-xs'
                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                <Boxes className="w-4 h-4" />
                Caixas do Lote ({relatorioLote.caixas.length})
              </button>

              <button
                type="button"
                onClick={() => setSubAbaLote('produtos')}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer border-t-2 border-x-2 -mb-px whitespace-nowrap ${
                  subAbaLote === 'produtos'
                    ? 'bg-white text-amber-700 border-slate-300 border-b-transparent shadow-xs'
                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                Produtos Pertencentes ({relatorioLote.produtos.length})
              </button>

              <button
                type="button"
                onClick={() => setSubAbaLote('historico')}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer border-t-2 border-x-2 -mb-px whitespace-nowrap ${
                  subAbaLote === 'historico'
                    ? 'bg-white text-amber-700 border-slate-300 border-b-transparent shadow-xs'
                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                <Clock className="w-4 h-4" />
                Histórico & Auditoria Admin ({historicoLote.length + (loteFinalizadoAtual?.historico_alteracoes?.length || 0)})
              </button>
            </div>

            <div className="p-6">
              {/* SUB-ABA 0: GALERIA COM AS 3 FOTOS OBRIGATÓRIAS (REQUISITO 7 DO PROMPT) */}
              {subAbaLote === 'fotos' && (
                <div className="space-y-4">
                  {loteFinalizadoAtual?.fotos ? (
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                            <Camera className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase">
                              Galeria de Fotos Oficiais de Fechamento do Lote {relatorioLote.lote}
                            </h4>
                            <p className="text-xs text-slate-600">
                              Fechamento validado com as 3 fotos obrigatórias anexadas pelo colaborador{' '}
                              <strong>{loteFinalizadoAtual.colaborador_fechamento}</strong> em{' '}
                              <strong>{loteFinalizadoAtual.data_fechamento}</strong>.
                            </p>
                          </div>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1.5 rounded-xl border border-emerald-300 uppercase shrink-0">
                          ✓ 3 / 3 Fotos Válidas
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* 1ª Foto: Caixa Fechada */}
                        <div className="bg-white rounded-2xl border-2 border-slate-300 overflow-hidden shadow-sm hover:border-amber-500 transition-all flex flex-col">
                          <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[11px] font-black">
                                1
                              </span>
                              Foto Caixa Fechada
                            </span>
                            <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                              Obrigatória
                            </span>
                          </div>

                          <div
                            onClick={() =>
                              setFotoVisualizar({
                                url: loteFinalizadoAtual.fotos.caixaFechada,
                                titulo: `1ª Foto: Caixa Fechada - Lote ${loteFinalizadoAtual.numero_lote}`,
                                subtitulo: `Colaborador: ${loteFinalizadoAtual.colaborador_fechamento} | Data: ${loteFinalizadoAtual.data_fechamento}`,
                              })
                            }
                            className="h-56 bg-slate-900 relative group cursor-pointer overflow-hidden flex items-center justify-center"
                          >
                            <img
                              src={loteFinalizadoAtual.fotos.caixaFechada}
                              alt="Foto da Caixa Fechada"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                              <ZoomIn className="w-6 h-6" />
                              <span className="text-xs font-black uppercase">Clique para Ampliar</span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-white space-y-2 flex-1 flex flex-col justify-between">
                            <p className="text-xs text-slate-600 font-medium">
                              Visão geral da caixa fechada antes da expedição e fita de vedação aplicada.
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setFotoVisualizar({
                                  url: loteFinalizadoAtual.fotos.caixaFechada,
                                  titulo: `1ª Foto: Caixa Fechada - Lote ${loteFinalizadoAtual.numero_lote}`,
                                  subtitulo: `Colaborador: ${loteFinalizadoAtual.colaborador_fechamento} | Data: ${loteFinalizadoAtual.data_fechamento}`,
                                })
                              }
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              Visualizar em Tela Cheia
                            </button>
                          </div>
                        </div>

                        {/* 2ª Foto: Espelho da Caixa */}
                        <div className="bg-white rounded-2xl border-2 border-slate-300 overflow-hidden shadow-sm hover:border-amber-500 transition-all flex flex-col">
                          <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[11px] font-black">
                                2
                              </span>
                              Foto Espelho da Caixa
                            </span>
                            <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                              Obrigatória
                            </span>
                          </div>

                          <div
                            onClick={() =>
                              setFotoVisualizar({
                                url: loteFinalizadoAtual.fotos.espelhoCaixa,
                                titulo: `2ª Foto: Espelho da Caixa - Lote ${loteFinalizadoAtual.numero_lote}`,
                                subtitulo: `Colaborador: ${loteFinalizadoAtual.colaborador_fechamento} | Data: ${loteFinalizadoAtual.data_fechamento}`,
                              })
                            }
                            className="h-56 bg-slate-900 relative group cursor-pointer overflow-hidden flex items-center justify-center"
                          >
                            <img
                              src={loteFinalizadoAtual.fotos.espelhoCaixa}
                              alt="Foto do Espelho da Caixa"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                              <ZoomIn className="w-6 h-6" />
                              <span className="text-xs font-black uppercase">Clique para Ampliar</span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-white space-y-2 flex-1 flex flex-col justify-between">
                            <p className="text-xs text-slate-600 font-medium">
                              Espelho da caixa impresso e fixado com os dados e conferência da caixa.
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setFotoVisualizar({
                                  url: loteFinalizadoAtual.fotos.espelhoCaixa,
                                  titulo: `2ª Foto: Espelho da Caixa - Lote ${loteFinalizadoAtual.numero_lote}`,
                                  subtitulo: `Colaborador: ${loteFinalizadoAtual.colaborador_fechamento} | Data: ${loteFinalizadoAtual.data_fechamento}`,
                                })
                              }
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              Visualizar em Tela Cheia
                            </button>
                          </div>
                        </div>

                        {/* 3ª Foto: Lacre de Segurança */}
                        <div className="bg-white rounded-2xl border-2 border-slate-300 overflow-hidden shadow-sm hover:border-amber-500 transition-all flex flex-col">
                          <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[11px] font-black">
                                3
                              </span>
                              Foto Lacre de Segurança
                            </span>
                            <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                              Obrigatória
                            </span>
                          </div>

                          <div
                            onClick={() =>
                              setFotoVisualizar({
                                url: loteFinalizadoAtual.fotos.lacreSeguranca,
                                titulo: `3ª Foto: Lacre de Segurança - Lote ${loteFinalizadoAtual.numero_lote}`,
                                subtitulo: `Colaborador: ${loteFinalizadoAtual.colaborador_fechamento} | Data: ${loteFinalizadoAtual.data_fechamento}`,
                              })
                            }
                            className="h-56 bg-slate-900 relative group cursor-pointer overflow-hidden flex items-center justify-center"
                          >
                            <img
                              src={loteFinalizadoAtual.fotos.lacreSeguranca}
                              alt="Foto do Lacre de Segurança"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                              <ZoomIn className="w-6 h-6" />
                              <span className="text-xs font-black uppercase">Clique para Ampliar</span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-white space-y-2 flex-1 flex flex-col justify-between">
                            <p className="text-xs text-slate-600 font-medium">
                              Lacre numerado de segurança inviolável aplicado sobre a fita adesiva.
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setFotoVisualizar({
                                  url: loteFinalizadoAtual.fotos.lacreSeguranca,
                                  titulo: `3ª Foto: Lacre de Segurança - Lote ${loteFinalizadoAtual.numero_lote}`,
                                  subtitulo: `Colaborador: ${loteFinalizadoAtual.colaborador_fechamento} | Data: ${loteFinalizadoAtual.data_fechamento}`,
                                })
                              }
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              Visualizar em Tela Cheia
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-300 rounded-2xl p-8">
                      <Camera className="w-14 h-14 mx-auto mb-3 text-slate-300" />
                      <h4 className="font-black text-base text-slate-700 uppercase">
                        Lote em Aberto (Sem Fotos Oficiais de Fechamento)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Este lote ainda não foi finalizado. Quando o colaborador concluir e realizar o fechamento oficial na tela de bipagem, as 3 fotos obrigatórias (Caixa Fechada, Espelho e Lacre) aparecerão nesta galeria.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-ABA 1: CAIXAS */}
              {subAbaLote === 'caixas' && (
                <div className="space-y-4">
                  {relatorioLote.caixas.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Boxes className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm">Nenhuma caixa registrada para o Lote {relatorioLote.lote}.</p>
                      <p className="text-xs mt-1">Realize a bipagem vinculando os produtos a este lote.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider border-b border-slate-200">
                            <th className="py-3 px-4">#</th>
                            <th className="py-3 px-4">Volume / Caixa</th>
                            <th className="py-3 px-4 text-center">Número do Lacre</th>
                            <th className="py-3 px-4 text-center">Total Produtos</th>
                            <th className="py-3 px-4 text-center">Lacrados</th>
                            <th className="py-3 px-4 text-center">Não Lacrados</th>
                            <th className="py-3 px-4 text-center">Status de Envio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {relatorioLote.caixas.map((c, idx) => (
                            <tr key={c.caixa} className="hover:bg-amber-50/40 transition-colors">
                              <td className="py-3 px-4 text-slate-400 font-bold">{idx + 1}</td>
                              <td className="py-3 px-4 font-black text-slate-900 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                {c.caixa}
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                                {db.obterLacreCaixa(c.caixa, relatorioLote.cliente) || '-'}
                              </td>
                              <td className="py-3 px-4 text-center font-black text-slate-800 text-sm">
                                {c.totalProdutos}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-emerald-700">
                                {c.lacrados}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-amber-700">
                                {c.naoLacrados}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                    c.statusEnvio === 'Enviado Online'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                                  }`}
                                >
                                  {c.statusEnvio}
                                </span>
                              </td>
                            </tr>
                          ))}

                          {/* Linha de Produtos Pendentes com Caixa 0 */}
                          {loteFinalizadoAtual?.produtos_pendentes && loteFinalizadoAtual.produtos_pendentes.length > 0 && (
                            <tr className="bg-rose-50/50 hover:bg-rose-50 transition-colors border-t-2 border-rose-200">
                              <td className="py-3 px-4 text-rose-500 font-bold">{relatorioLote.caixas.length + 1}</td>
                              <td className="py-3 px-4 font-black text-rose-900 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                Caixa 0 (Produtos Pendentes)
                              </td>
                              <td className="py-3 px-4 text-center font-mono text-slate-400">-</td>
                              <td className="py-3 px-4 text-center font-black text-rose-700 text-sm">
                                {loteFinalizadoAtual.produtos_pendentes.length}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-slate-400">0</td>
                              <td className="py-3 px-4 text-center font-bold text-slate-400">0</td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                                  {loteFinalizadoAtual.motivo_pendencias || 'Não lançado'}
                                </span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-ABA 2: PRODUTOS */}
              {subAbaLote === 'produtos' && (
                <div className="space-y-4">
                  {relatorioLote.produtos.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm">Nenhum produto cadastrado no Lote {relatorioLote.lote}.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider border-b border-slate-200">
                            <th className="py-3 px-3">#</th>
                            <th className="py-3 px-3">Lote</th>
                            <th className="py-3 px-3">Caixa</th>
                            <th className="py-3 px-3">Número do Lacre</th>
                            <th className="py-3 px-3">Modelo</th>
                            <th className="py-3 px-3">IMEI</th>
                            <th className="py-3 px-3 text-center">Produto Lacrado</th>
                            <th className="py-3 px-3 text-center bg-emerald-50 text-emerald-950">NF Conferida</th>
                            <th className="py-3 px-3">Data/Hora Lançamento</th>
                            <th className="py-3 px-3">Colaborador</th>
                            <th className="py-3 px-3 text-center">Status Sync</th>
                            <th className="py-3 px-3 text-center">Ações Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {relatorioLote.produtos.map((p, idx) => {
                            let dataHoraFormatada = p.data_auditoria;
                            if (p.data_cadastro) {
                              try {
                                const d = new Date(p.data_cadastro);
                                if (!isNaN(d.getTime())) {
                                  dataHoraFormatada = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                                }
                              } catch {}
                            }

                            return (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 text-slate-400 font-bold">{idx + 1}</td>
                                <td className="py-2.5 px-3">
                                  <span className="font-mono font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] border border-amber-300">
                                    LOTE {p.numero_lote || relatorioLote.lote}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-800">{p.numero_caixa}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-700 text-[11px]">
                                  {p.lacre_seguranca || db.obterLacreCaixa(p.numero_caixa, p.regional) || '-'}
                                </td>
                                <td className="py-2.5 px-3 font-black text-slate-900">{p.modelo_produto}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-700 text-[11px]">
                                  {p.imei || p.serial}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                      p.produto_lacrado === 'SIM'
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                    }`}
                                  >
                                    {p.produto_lacrado === 'SIM' ? '🟢 SIM' : 'NÃO (ABERTO)'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center bg-emerald-50/30">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                      p.nf_conferida === 'NÃO'
                                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    }`}
                                  >
                                    {p.nf_conferida === 'NÃO' ? '❌ NÃO' : '🟢 SIM (CONFERIDA)'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 font-medium text-[11px] whitespace-nowrap">
                                  {dataHoraFormatada}
                                </td>
                                <td className="py-2.5 px-3 text-slate-900 font-bold">{p.usuario_cadastro || 'Operador'}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                      p.status_sincronizacao === 'ENVIADO'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                                    }`}
                                  >
                                    {p.status_sincronizacao === 'ENVIADO' ? 'Enviado' : 'Aguardando'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => abrirEdicaoProdutoAdmin(p)}
                                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                      title="Editar item do lote (Exclusivo Administrador)"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleExcluirProdutoAdmin(p)}
                                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                      title="Excluir item do lote (Exclusivo Administrador)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {/* Produtos Pendentes com Caixa 0 e Identificação de Motivo */}
                          {loteFinalizadoAtual?.produtos_pendentes?.map((item, pIdx) => {
                            const motivoIdentificacao = item.motivo || loteFinalizadoAtual?.motivo_pendencias || 'Não lançado';
                            return (
                              <tr key={item.imei || pIdx} className="bg-rose-50/40 hover:bg-rose-50 transition-colors">
                                <td className="py-2.5 px-3 text-rose-500 font-bold">{relatorioLote.produtos.length + pIdx + 1}</td>
                                <td className="py-2.5 px-3">
                                  <span className="font-mono font-black bg-rose-100 text-rose-900 px-2 py-0.5 rounded text-[10px] border border-rose-300">
                                    LOTE {relatorioLote.lote}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-rose-800">0</td>
                                <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">-</td>
                                <td className="py-2.5 px-3 font-black text-slate-800">{item.modelo || '-'}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-rose-700 text-[11px]">
                                  {item.imei}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-rose-100 text-rose-800 border-rose-300">
                                    {motivoIdentificacao}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center bg-rose-50/20">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-rose-100 text-rose-800 border-rose-300">
                                    ❌ NÃO
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 font-medium text-[11px]">-</td>
                                <td className="py-2.5 px-3 text-slate-400 font-medium">-</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                                    Pendente
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-500 text-[10px]">
                                  {loteFinalizadoAtual.motivo_pendencias || item.motivo || 'Não lançado'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-ABA 3: HISTÓRICO DE MOVIMENTAÇÃO & AUDITORIA ADMIN */}
              {subAbaLote === 'historico' && (
                <div className="space-y-6">
                  {/* Seção 1: Histórico de Alterações e Reaberturas Administrativas */}
                  {loteFinalizadoAtual?.historico_alteracoes && loteFinalizadoAtual.historico_alteracoes.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-amber-600" />
                        <h4 className="text-sm font-black uppercase text-slate-900">
                          Auditoria de Ações Administrativas (Exclusivo Administrador)
                        </h4>
                      </div>
                      <div className="overflow-x-auto border-2 border-amber-300 rounded-xl bg-amber-50/40">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-amber-100 text-amber-950 uppercase font-black tracking-wider border-b border-amber-300">
                              <th className="py-2.5 px-3">Data / Hora</th>
                              <th className="py-2.5 px-3">Ação Realizada</th>
                              <th className="py-2.5 px-3">Usuário Responsável</th>
                              <th className="py-2.5 px-3">Detalhes / Justificativa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-200 font-medium">
                            {loteFinalizadoAtual.historico_alteracoes.map((alt) => (
                              <tr key={alt.id} className="hover:bg-amber-100/50 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-slate-700 text-[11px] whitespace-nowrap">
                                  {formatarDataHora(alt.dataHora)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded font-black text-[10px] uppercase border ${
                                      alt.acao === 'REABERTURA'
                                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                                        : alt.acao === 'FECHAMENTO'
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                    }`}
                                  >
                                    {alt.acao === 'REABERTURA'
                                      ? '🔓 REABERTURA DE LOTE'
                                      : alt.acao === 'FECHAMENTO'
                                      ? '🔒 FECHAMENTO'
                                      : alt.acao}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-900">
                                  {alt.usuario} <span className="text-[10px] font-semibold text-slate-500">({alt.perfil})</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 text-xs font-medium">{alt.detalhes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Seção 2: Histórico Geral de Movimentação do Lote */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-slate-600" />
                      <h4 className="text-sm font-black uppercase text-slate-900">
                        Histórico Geral de Movimentação do Lote {relatorioLote.lote}
                      </h4>
                    </div>

                    {historicoLote.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 border border-slate-200 rounded-xl">
                        <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-sm">Nenhum evento registrado no histórico para o Lote {relatorioLote.lote}.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider border-b border-slate-200">
                              <th className="py-3 px-3">Data / Hora</th>
                              <th className="py-3 px-3">Ação</th>
                              <th className="py-3 px-3">Usuário</th>
                              <th className="py-3 px-3">Estação</th>
                              <th className="py-3 px-3">Detalhes do Evento</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {historicoLote.map((h) => (
                              <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                                  {formatarDataHora(h.data_hora)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-black text-[10px] uppercase">
                                    {h.acao}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-800">{h.usuario}</td>
                                <td className="py-2.5 px-3 font-mono text-indigo-600 text-[11px]">
                                  {h.computador_id || 'PC-001'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 font-medium">{h.detalhes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom da Foto */}
      {fotoAmpliada && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-foto-ampliada"
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn"
          onClick={() => setFotoAmpliada(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <span id="titulo-foto-ampliada" className="text-sm font-black uppercase tracking-wider block">
                  📷 {fotoAmpliada.grupoRotulo} ({fotoAmpliada.caixa} - {fotoAmpliada.regional})
                </span>
                <span className="text-xs text-slate-400">
                  {fotoAmpliada.totalNoGrupo} aparelhos organizados • Registrado em{' '}
                  {formatarDataHora(fotoAmpliada.dataCriacao)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFotoAmpliada(null)}
                aria-label="Fechar ampliação da evidência fotográfica"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={fotoAmpliada.fotoDataUri}
                alt={fotoAmpliada.grupoRotulo}
                className="max-h-[68vh] w-auto object-contain rounded-xl shadow-lg"
              />
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-slate-600 font-bold">
                <span>Regional: <strong className="text-slate-900">{fotoAmpliada.regional}</strong></span>
                <span>Caixa: <strong className="text-slate-900">{fotoAmpliada.caixa}</strong></span>
                <span>Estação: <strong className="text-indigo-700">{fotoAmpliada.computador_id || 'PC-001'}</strong></span>
                <span>Auditor: <strong className="text-slate-900">{fotoAmpliada.usuario || 'Operador'}</strong></span>
              </div>
              <a
                href={fotoAmpliada.fotoDataUri}
                download={`Foto_${fotoAmpliada.caixa}_${fotoAmpliada.grupoRotulo}.jpg`}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2.5 min-h-[44px] rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" /> Baixar Imagem
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Limpeza da Base de Testes (Requisito 2 do Prompt) */}
      {mostrarModalLimpeza && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border-2 border-rose-500 space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-950 uppercase tracking-tight">
                    Limpar Base para Início dos Testes
                  </h3>
                  <span className="text-xs font-bold text-rose-600">
                    Ação Administrativa Irreversível
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalLimpeza(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 text-rose-950 text-xs font-medium space-y-2">
              <p className="font-bold text-rose-900">
                Esta ação preparará o sistema para início oficial dos testes operacionais com as seguintes regras:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-white/80 p-2 rounded-lg border border-rose-200">
                  <strong className="text-rose-700 block uppercase">Remover:</strong>
                  <span>• Produtos cadastrados</span><br />
                  <span>• Números de Série</span><br />
                  <span>• Caixas operacionais</span><br />
                  <span>• Fotos de evidência</span><br />
                  <span>• Sincronizações antigas</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-200">
                  <strong className="text-emerald-700 block uppercase">Manter:</strong>
                  <span>• Usuários & Senhas</span><br />
                  <span>• Regionais cadastradas</span><br />
                  <span>• Configurações do sistema</span><br />
                  <span>• Estrutura operacional</span>
                </div>
              </div>
              <div className="pt-2 font-black text-rose-800 text-[11px] uppercase">
                Resultado após limpeza: Produtos: 0 • Caixas: 0 • Fotos: 0 • Sincronizações: 0
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMostrarModalLimpeza(false)}
                disabled={limpandoBase}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarLimpezaBase}
                disabled={limpandoBase}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {limpandoBase ? 'Limpando Base...' : 'Confirmar e Limpar Toda a Base'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Administrativo de Reabertura de Lote (Exclusivo Administrador - Requisito 8) */}
      {mostrarModalReabertura && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-amber-400 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-inner">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase">
                    Reabrir Lote {loteFinalizadoAtual?.numero_lote || loteSelecionado}
                  </h3>
                  <span className="text-xs font-bold text-amber-700">
                    Ação Exclusiva do Administrador
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalReabertura(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-2 text-slate-700">
              <div className="flex items-center justify-between border-b border-amber-200/70 pb-2">
                <span className="font-bold text-slate-600 uppercase text-[10px]">Cliente / Regional:</span>
                <span className="font-black text-slate-900">{loteFinalizadoAtual?.regional || regionalFiltroLote}</span>
              </div>
              <div className="flex items-center justify-between border-b border-amber-200/70 pb-2">
                <span className="font-bold text-slate-600 uppercase text-[10px]">Fechado por:</span>
                <span className="font-black text-slate-900">{loteFinalizadoAtual?.colaborador_fechamento || 'Colaborador'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600 uppercase text-[10px]">Data de Fechamento:</span>
                <span className="font-black text-slate-900">{loteFinalizadoAtual?.data_fechamento ? formatarDataHora(loteFinalizadoAtual.data_fechamento) : '-'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Motivo / Justificativa da Reabertura <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={4}
                value={motivoReabertura}
                onChange={(e) => setMotivoReabertura(e.target.value)}
                placeholder="Informe detalhadamente o motivo da reabertura deste lote para registro no histórico de auditoria..."
                className="w-full text-xs font-semibold p-3 border-2 border-amber-300 rounded-2xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-slate-50 focus:bg-white"
              />
              <p className="text-[11px] text-slate-500">
                Esta ação desbloqueará o lote para os operadores e registrará seu nome, data/hora e justificativa no histórico permanente.
              </p>
            </div>

            {erroReabertura && (
              <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {erroReabertura}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMostrarModalReabertura(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReabrirLote}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer ring-1 ring-amber-400"
              >
                <Unlock className="w-4 h-4" />
                Confirmar Reabertura do Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Produto pelo Administrador (Requisito 10) */}
      {produtoParaEditar && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm sm:text-base uppercase">Editar Produto (Exclusivo Administrador)</h3>
                  <span className="text-[10px] text-slate-300 block">
                    Regional: {produtoParaEditar.regional} • ID Local: {produtoParaEditar.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProdutoParaEditar(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {erroEdicaoAdmin && (
                <div className="p-3 bg-rose-50 border-2 border-rose-400 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  {erroEdicaoAdmin}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">Fabricante:</label>
                  <input
                    type="text"
                    value={editFabricanteAdmin}
                    onChange={(e) => setEditFabricanteAdmin(e.target.value.toUpperCase())}
                    placeholder="Ex: SAMSUNG, MOTOROLA, APPLE..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-black uppercase text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">Modelo do Produto:</label>
                  <input
                    type="text"
                    value={editModeloAdmin}
                    onChange={(e) => setEditModeloAdmin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">EAN:</label>
                  <input
                    type="text"
                    value={editEanAdmin}
                    onChange={(e) => setEditEanAdmin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">IMEI (15 dígitos):</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={editImeiAdmin}
                    onChange={(e) => setEditImeiAdmin(e.target.value.replace(/\D/g, '').slice(0, 15))}
                    className="w-full px-3 py-2 border-2 border-blue-500 rounded-xl text-xs font-mono font-black text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">Caixa:</label>
                  <input
                    type="text"
                    value={editCaixaAdmin}
                    onChange={(e) => setEditCaixaAdmin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">Número do Lote:</label>
                  <input
                    type="text"
                    value={editLoteAdmin}
                    onChange={(e) => setEditLoteAdmin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">Produto Lacrado?</label>
                  <select
                    value={editLacreAdmin}
                    onChange={(e) => setEditLacreAdmin(e.target.value as SimNao)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="SIM">SIM (Lacrado)</option>
                    <option value="NÃO">NÃO (Aberto)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">NF foi Conferida?</label>
                  <select
                    value={editNfAdmin}
                    onChange={(e) => setEditNfAdmin(e.target.value as SimNao)}
                    className="w-full px-3 py-2 border-2 border-emerald-400 rounded-xl text-xs font-black text-emerald-950 bg-emerald-50/40 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="SIM">🟢 SIM (Conferida)</option>
                    <option value="NÃO">❌ NÃO (Pendente)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">Kit Completo:</label>
                  <select
                    disabled={editLacreAdmin === 'SIM'}
                    value={editKitAdmin}
                    onChange={(e) => setEditKitAdmin(e.target.value as SimNao)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">Não aplicável</option>
                    <option value="SIM">SIM</option>
                    <option value="NÃO">NÃO</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">Observação do Produto:</label>
                  <input
                    type="text"
                    value={editObsAdmin}
                    onChange={(e) => setEditObsAdmin(e.target.value)}
                    placeholder="Ex: Avaria leve na embalagem, cabo conferido..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 bg-amber-50 p-3.5 rounded-2xl border-2 border-amber-300">
                  <label className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Motivo / Justificativa da Alteração (Trilha de Auditoria Obrigatória):
                  </label>
                  <input
                    type="text"
                    value={motivoEdicaoAdmin}
                    onChange={(e) => setMotivoEdicaoAdmin(e.target.value)}
                    placeholder="Ex: Correção de digitação de IMEI solicitado pela supervisão..."
                    className="w-full px-3 py-2 border border-amber-400 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setProdutoParaEditar(null)}
                className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl transition-colors cursor-pointer border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicaoProdutoAdmin}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Salvar Alteração com Auditoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lightbox de Visualização de Foto de Fechamento (Requisito 7) */}
      {fotoVisualizar && (
        <ModalVisualizarFotoLote
          isOpen={!!fotoVisualizar}
          fotoDataUri={fotoVisualizar.url}
          titulo={fotoVisualizar.titulo}
          subtitulo={fotoVisualizar.subtitulo}
          onClose={() => setFotoVisualizar(null)}
        />
      )}

      {/* Modal de Confirmação para Exclusão Definitiva de Lote e Fotos */}
      {mostrarModalExcluirLote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-excluir-lote"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            if (!excluindoLote) setMostrarModalExcluirLote(false);
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border-2 border-rose-500 space-y-0 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 text-white p-5 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner shrink-0">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 id="titulo-modal-excluir-lote" className="text-lg font-black uppercase tracking-tight text-white">
                    Excluir Lote {loteSelecionado || loteFinalizadoAtual?.numero_lote}
                  </h3>
                  <span className="text-[11px] font-bold text-rose-100 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-200 shrink-0" />
                    Exclusivo Administrador • Ação Definitiva e Irreversível
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!excluindoLote) setMostrarModalExcluirLote(false);
                }}
                disabled={excluindoLote}
                aria-label="Fechar modal de confirmação de exclusão"
                className="p-1.5 text-rose-100 hover:text-white rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Imagem / Ilustração Gráfica de Alerta e Confirmação */}
              <div className="flex flex-col items-center justify-center text-center p-5 bg-gradient-to-b from-rose-50 to-rose-100/60 rounded-3xl border-2 border-rose-200 shadow-inner">
                <div className="relative mb-3.5">
                  <div className="w-20 h-20 rounded-3xl bg-rose-100 border-2 border-rose-300 flex items-center justify-center text-rose-600 shadow-lg">
                    <Trash2 className="w-10 h-10 text-rose-600 animate-pulse" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-black border-2 border-white shadow-md">
                    <AlertTriangle className="w-4 h-4 text-slate-950" />
                  </div>
                </div>

                <h4 className="text-base sm:text-lg font-black text-rose-950 uppercase tracking-tight">
                  Tem certeza que deseja excluir este lote?
                </h4>
                <p className="text-xs text-rose-800 font-medium mt-1.5 max-w-sm leading-relaxed">
                  Ao confirmar, <strong>todos os registros do lote, fotos de evidência arquivadas e produtos associados</strong> serão apagados definitivamente do sistema.
                </p>
              </div>

              {/* Detalhes do Lote Selecionado para Exclusão */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Identificação do Lote:</span>
                  <span className="font-black text-slate-900 bg-slate-200 px-2.5 py-0.5 rounded-lg text-xs">
                    {loteSelecionado || loteFinalizadoAtual?.numero_lote || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Regional:</span>
                  <span className="font-black text-slate-900">
                    {loteFinalizadoAtual?.regional || (regionalFiltroLote === 'TODAS' ? 'Todas as Regionais' : regionalFiltroLote)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Produtos Vinculados:</span>
                  <span className="font-black text-rose-600">
                    {relatorioLote.totalProdutos} produtos cadastrados
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Fotos de Evidência Anexadas:</span>
                  <span className="font-black text-rose-600 flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-rose-500" />
                    {loteFinalizadoAtual?.fotos
                      ? [
                          loteFinalizadoAtual.fotos.caixaFechada ? 'Caixa Fechada' : null,
                          loteFinalizadoAtual.fotos.espelhoCaixa ? 'Espelho' : null,
                          loteFinalizadoAtual.fotos.lacreSeguranca ? 'Lacre' : null,
                        ].filter(Boolean).length + ' fotos arquivadas'
                      : 'Todas as evidências do lote'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Status do Lote:</span>
                  <span className="font-black text-slate-700">
                    {loteFinalizadoAtual?.status === 'FINALIZADO' ? 'Fechado / Bloqueado' : 'Em Aberto'}
                  </span>
                </div>
              </div>

              {/* Mensagem de Erro, se houver */}
              {erroExclusaoLote && (
                <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{erroExclusaoLote}</span>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalExcluirLote(false)}
                  disabled={excluindoLote}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExcluirLote}
                  disabled={excluindoLote}
                  className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 ring-2 ring-rose-500"
                >
                  <Trash2 className="w-4 h-4" />
                  {excluindoLote ? 'Excluindo Lote e Fotos...' : 'Sim, Excluir Lote e Fotos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação de Planilha Regional (ADMIN ONLY) */}
      {mostrarModalImportarPlanilha && (
        <ModalImportarPlanilhaRegional
          regionalInicial={regionalParaImportar}
          onFechar={() => setMostrarModalImportarPlanilha(false)}
          onSucesso={(_res) => {
            setForcarAtualizacao((v) => v + 1);
          }}
        />
      )}

      {/* Modal de Histórico de Versões da Planilha Regional */}
      {mostrarModalHistoricoPlanilhas && (
        <ModalHistoricoVersoesPlanilha
          regional={regionalParaImportar}
          onFechar={() => setMostrarModalHistoricoPlanilhas(false)}
          onImportarNova={() => {
            setMostrarModalHistoricoPlanilhas(false);
            setMostrarModalImportarPlanilha(true);
          }}
          onBaseExcluida={() => {
            setForcarAtualizacao((v) => v + 1);
          }}
        />
      )}
    </div>
  );
};

export default PainelAdmin;

