import {
  ProdutoAuditoria,
  Usuario,
  HistoricoAuditoria,
  ContadoresCaixa,
  MetricasDashboard,
  FiltroConsulta,
  SimNao,
} from '../types';

const STORAGE_KEY_PRODUTOS = 'solutions_auditoria_produtos_v1';
const STORAGE_KEY_USUARIOS = 'solutions_auditoria_usuarios_v1';
const STORAGE_KEY_HISTORICO = 'solutions_auditoria_historico_v1';
const STORAGE_KEY_CONFIG = 'solutions_auditoria_config_v1';

// Seed initial users
const DEFAULT_USUARIOS: Usuario[] = [
  {
    id: 1,
    nome: 'Administrador Solutions',
    login: 'admin',
    senha: 'admin123',
    perfil: 'ADMINISTRADOR',
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 2,
    nome: 'Operador Bipagem',
    login: 'operador',
    senha: 'operador123',
    perfil: 'OPERADOR',
    ativo: true,
    criado_em: new Date().toISOString(),
  },
];

// Presets for Samsung devices for fast autocomplete & recognition
export const SAMSUNG_MODELOS_PRESET = [
  { modelo: 'Galaxy S24 Ultra', ean: '7892509133456' },
  { modelo: 'Galaxy S24+', ean: '7892509133463' },
  { modelo: 'Galaxy S24', ean: '7892509133470' },
  { modelo: 'Galaxy S23 FE', ean: '7892509129848' },
  { modelo: 'Galaxy A55 5G', ean: '7892509134125' },
  { modelo: 'Galaxy A35 5G', ean: '7892509134132' },
  { modelo: 'Galaxy A15 5G', ean: '7892509134149' },
  { modelo: 'Galaxy A05s', ean: '7892509134156' },
  { modelo: 'Galaxy Z Fold5', ean: '7892509130110' },
  { modelo: 'Galaxy Z Flip5', ean: '7892509130226' },
  { modelo: 'Galaxy Tab S9 FE', ean: '7892509131452' },
  { modelo: 'Galaxy Tab A9+', ean: '7892509131568' },
  { modelo: 'Galaxy Watch6', ean: '7892509132107' },
  { modelo: 'Galaxy Buds2 Pro', ean: '7892509125581' },
];

class AuditoriaDatabase {
  private produtos: ProdutoAuditoria[] = [];
  private usuarios: Usuario[] = [];
  private historico: HistoricoAuditoria[] = [];
  private usuarioAtual: Usuario | null = null;
  private serialMap: Map<string, ProdutoAuditoria> = new Map();

  constructor() {
    this.carregarDados();
  }

  private carregarDados() {
    try {
      const prodRaw = localStorage.getItem(STORAGE_KEY_PRODUTOS);
      this.produtos = prodRaw ? JSON.parse(prodRaw) : [];

      const userRaw = localStorage.getItem(STORAGE_KEY_USUARIOS);
      this.usuarios = userRaw ? JSON.parse(userRaw) : DEFAULT_USUARIOS;

      const histRaw = localStorage.getItem(STORAGE_KEY_HISTORICO);
      this.historico = histRaw ? JSON.parse(histRaw) : [];

      // Rebuild high-speed serial index (O(1) lookups)
      this.serialMap.clear();
      for (const p of this.produtos) {
        this.serialMap.set(p.serial.trim().toUpperCase(), p);
      }

      // Check session
      const sess = localStorage.getItem('solutions_auditoria_sessao');
      if (sess) {
        this.usuarioAtual = JSON.parse(sess);
      } else {
        this.usuarioAtual = this.usuarios[0]; // default admin for convenience
      }
    } catch (e) {
      console.error('Erro ao carregar banco local:', e);
      this.produtos = [];
      this.usuarios = DEFAULT_USUARIOS;
      this.historico = [];
    }
  }

  private salvarTudo() {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(this.produtos));
      localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(this.usuarios));
      localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(this.historico));
    } catch (e) {
      console.error('Erro ao salvar no storage:', e);
    }
  }

  // Auth
  getUsuarioAtual(): Usuario | null {
    return this.usuarioAtual;
  }

  setUsuarioAtual(u: Usuario | null) {
    this.usuarioAtual = u;
    if (u) {
      localStorage.setItem('solutions_auditoria_sessao', JSON.stringify(u));
    } else {
      localStorage.removeItem('solutions_auditoria_sessao');
    }
  }

  autenticar(login: string, pass: string): { sucesso: boolean; usuario?: Usuario; erro?: string } {
    const user = this.usuarios.find(
      (u) => u.login.toLowerCase() === login.trim().toLowerCase() && u.senha === pass && u.ativo
    );
    if (!user) {
      return { sucesso: false, erro: 'Usuário ou senha incorretos, ou usuário inativo.' };
    }
    this.setUsuarioAtual(user);
    this.registrarHistorico(user.nome, 'LOGIN', `Usuário ${user.nome} acessou o sistema.`);
    return { sucesso: true, usuario: user };
  }

  // Audit History
  registrarHistorico(usuario: string, acao: string, detalhes: string) {
    const log: HistoricoAuditoria = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      usuario,
      acao,
      detalhes,
      data_hora: new Date().toLocaleString('pt-BR'),
    };
    this.historico.unshift(log);
    // Limit in-memory history to 2000 records
    if (this.historico.length > 2000) {
      this.historico = this.historico.slice(0, 2000);
    }
    this.salvarTudo();
  }

  listarHistorico(limite = 200): HistoricoAuditoria[] {
    return this.historico.slice(0, limite);
  }

  // Product Audit Core
  buscarPorSerial(serial: string): ProdutoAuditoria | undefined {
    return this.serialMap.get(serial.trim().toUpperCase());
  }

  validarDuplicidade(serial: string): { duplicado: boolean; produto?: ProdutoAuditoria } {
    const norm = serial.trim().toUpperCase();
    const existing = this.serialMap.get(norm);
    if (existing) {
      return { duplicado: true, produto: existing };
    }
    return { duplicado: false };
  }

  inserirProduto(item: {
    modelo_produto: string;
    ean: string;
    serial: string;
    data_auditoria: string;
    numero_caixa: string;
    produto_lacrado: SimNao;
    kit_completo?: SimNao | null;
    aparelho_marcas_uso?: SimNao | null;
    observacao?: string;
  }): { sucesso: boolean; produto?: ProdutoAuditoria; erro?: string } {
    const serialNorm = item.serial.trim().toUpperCase();

    // 1. Validate mandatory fields
    if (!item.modelo_produto.trim()) {
      return { sucesso: false, erro: 'O modelo do produto é obrigatório.' };
    }
    if (!item.ean.trim()) {
      return { sucesso: false, erro: 'O código EAN é obrigatório.' };
    }
    if (!serialNorm) {
      return { sucesso: false, erro: 'O número de série é obrigatório.' };
    }
    if (!item.numero_caixa.trim()) {
      return { sucesso: false, erro: 'O número da caixa é obrigatório.' };
    }
    if (!item.produto_lacrado) {
      return { sucesso: false, erro: 'Informe se o produto está lacrado (SIM ou NÃO).' };
    }

    // 2. Validate unsealed rules
    if (item.produto_lacrado === 'NÃO') {
      if (!item.kit_completo) {
        return { sucesso: false, erro: 'Para produtos NÃO lacrados, o campo Kit Completo é obrigatório.' };
      }
      if (!item.aparelho_marcas_uso) {
        return { sucesso: false, erro: 'Para produtos NÃO lacrados, o campo Aparelho com Marcas de Uso é obrigatório.' };
      }
    }

    // 3. Duplicate check
    const check = this.validarDuplicidade(serialNorm);
    if (check.duplicado && check.produto) {
      return {
        sucesso: false,
        erro: `Este número de série já foi auditado na ${check.produto.numero_caixa} em ${check.produto.data_auditoria}.`,
        produto: check.produto,
      };
    }

    const agora = new Date();
    const usuarioNome = this.usuarioAtual?.nome || 'Operador';

    const novoProduto: ProdutoAuditoria = {
      id: Date.now(),
      uuid: crypto.randomUUID ? crypto.randomUUID() : `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fabricante: 'SAMSUNG', // Fixado
      modelo_produto: item.modelo_produto.trim(),
      ean: item.ean.trim(),
      serial: serialNorm,
      data_auditoria: item.data_auditoria.trim(),
      numero_caixa: item.numero_caixa.trim().toUpperCase(),
      produto_lacrado: item.produto_lacrado,
      kit_completo: item.produto_lacrado === 'SIM' ? 'SIM' : item.kit_completo || null,
      aparelho_marcas_uso: item.produto_lacrado === 'SIM' ? 'NÃO' : item.aparelho_marcas_uso || null,
      observacao: (item.observacao || '').trim(),
      data_cadastro: agora.toISOString(),
      usuario_cadastro: usuarioNome,
      data_alteracao: null,
      sync_status: 'PENDENTE',
      sync_data: null,
    };

    this.produtos.unshift(novoProduto);
    this.serialMap.set(serialNorm, novoProduto);
    this.salvarTudo();

    this.registrarHistorico(
      usuarioNome,
      'CADASTRO',
      `Usuário ${usuarioNome} cadastrou serial ${serialNorm} na ${novoProduto.numero_caixa}`
    );

    return { sucesso: true, produto: novoProduto };
  }

  atualizarProduto(
    id: number,
    dados: Partial<ProdutoAuditoria>
  ): { sucesso: boolean; produto?: ProdutoAuditoria; erro?: string } {
    const idx = this.produtos.findIndex((p) => p.id === id);
    if (idx === -1) {
      return { sucesso: false, erro: 'Produto não encontrado.' };
    }

    const anterior = this.produtos[idx];
    const serialNovo = dados.serial ? dados.serial.trim().toUpperCase() : anterior.serial;

    // Check serial uniqueness if changing serial
    if (serialNovo !== anterior.serial && this.serialMap.has(serialNovo)) {
      return { sucesso: false, erro: 'Este número de série já foi auditado em outro registro.' };
    }

    // Remove old serial from map if changed
    if (serialNovo !== anterior.serial) {
      this.serialMap.delete(anterior.serial);
    }

    const atualizado: ProdutoAuditoria = {
      ...anterior,
      ...dados,
      serial: serialNovo,
      data_alteracao: new Date().toISOString(),
      sync_status: 'PENDENTE',
    };

    this.produtos[idx] = atualizado;
    this.serialMap.set(serialNovo, atualizado);
    this.salvarTudo();

    const usuarioNome = this.usuarioAtual?.nome || 'Administrador';
    this.registrarHistorico(
      usuarioNome,
      'ALTERACAO',
      `Usuário ${usuarioNome} alterou produto serial ${serialNovo} (${anterior.numero_caixa})`
    );

    return { sucesso: true, produto: atualizado };
  }

  excluirProduto(id: number): { sucesso: boolean; erro?: string } {
    const idx = this.produtos.findIndex((p) => p.id === id);
    if (idx === -1) {
      return { sucesso: false, erro: 'Produto não encontrado.' };
    }

    const removido = this.produtos[idx];
    this.produtos.splice(idx, 1);
    this.serialMap.delete(removido.serial);
    this.salvarTudo();

    const usuarioNome = this.usuarioAtual?.nome || 'Administrador';
    this.registrarHistorico(
      usuarioNome,
      'EXCLUSAO',
      `Usuário ${usuarioNome} excluiu serial ${removido.serial} da ${removido.numero_caixa}`
    );

    return { sucesso: true };
  }

  listarProdutos(filtro?: FiltroConsulta): ProdutoAuditoria[] {
    if (!filtro) return [...this.produtos];

    return this.produtos.filter((p) => {
      if (filtro.termoBusca) {
        const termo = filtro.termoBusca.toLowerCase().trim();
        const match =
          p.serial.toLowerCase().includes(termo) ||
          p.modelo_produto.toLowerCase().includes(termo) ||
          p.ean.toLowerCase().includes(termo) ||
          p.numero_caixa.toLowerCase().includes(termo) ||
          p.observacao.toLowerCase().includes(termo);
        if (!match) return false;
      }
      if (filtro.modelo && filtro.modelo !== 'TODOS' && p.modelo_produto !== filtro.modelo) {
        return false;
      }
      if (filtro.ean && !p.ean.includes(filtro.ean.trim())) {
        return false;
      }
      if (filtro.serial && !p.serial.includes(filtro.serial.trim().toUpperCase())) {
        return false;
      }
      if (filtro.caixa && filtro.caixa !== 'TODOS' && p.numero_caixa !== filtro.caixa) {
        return false;
      }
      if (filtro.data && p.data_auditoria !== filtro.data) {
        return false;
      }
      if (filtro.produtoLacrado && filtro.produtoLacrado !== 'TODOS' && p.produto_lacrado !== filtro.produtoLacrado) {
        return false;
      }
      if (filtro.marcasUso && filtro.marcasUso !== 'TODOS' && p.aparelho_marcas_uso !== filtro.marcasUso) {
        return false;
      }
      return true;
    });
  }

  listarCaixas(): string[] {
    const set = new Set<string>();
    for (const p of this.produtos) {
      if (p.numero_caixa) set.add(p.numero_caixa);
    }
    return Array.from(set).sort();
  }

  obterContadoresCaixa(numeroCaixa: string): ContadoresCaixa {
    const caixaNorm = numeroCaixa.trim().toUpperCase();
    const itens = this.produtos.filter((p) => p.numero_caixa.toUpperCase() === caixaNorm);

    const totalAuditados = itens.length;
    const produtosLacrados = itens.filter((p) => p.produto_lacrado === 'SIM').length;
    const produtosNaoLacrados = itens.filter((p) => p.produto_lacrado === 'NÃO').length;
    const comMarcasUso = itens.filter((p) => p.aparelho_marcas_uso === 'SIM').length;
    // Pendências = não lacrados com marcas de uso ou avaria
    const pendencias = itens.filter(
      (p) => p.produto_lacrado === 'NÃO' && (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO')
    ).length;

    return {
      caixa: numeroCaixa,
      totalAuditados,
      produtosLacrados,
      produtosNaoLacrados,
      comMarcasUso,
      pendencias,
    };
  }

  obterMetricasDashboard(): MetricasDashboard {
    const totalAuditados = this.produtos.length;
    const caixas = this.listarCaixas();
    const totalCaixas = caixas.length;
    const produtosLacrados = this.produtos.filter((p) => p.produto_lacrado === 'SIM').length;
    const produtosNaoLacrados = this.produtos.filter((p) => p.produto_lacrado === 'NÃO').length;
    const comMarcasUso = this.produtos.filter((p) => p.aparelho_marcas_uso === 'SIM').length;

    const ultimaAuditoria = this.produtos.length > 0 ? this.produtos[0].data_cadastro : null;

    // By Box
    const boxMap = new Map<string, number>();
    for (const p of this.produtos) {
      boxMap.set(p.numero_caixa, (boxMap.get(p.numero_caixa) || 0) + 1);
    }
    const produtosPorCaixa = Array.from(boxMap.entries())
      .map(([caixa, total]) => ({ caixa, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // By Model
    const modelMap = new Map<string, number>();
    for (const p of this.produtos) {
      modelMap.set(p.modelo_produto, (modelMap.get(p.modelo_produto) || 0) + 1);
    }
    const produtosPorModelo = Array.from(modelMap.entries())
      .map(([modelo, total]) => ({ modelo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return {
      totalAuditados,
      totalCaixas,
      produtosLacrados,
      produtosNaoLacrados,
      comMarcasUso,
      ultimaAuditoria,
      produtosPorCaixa,
      produtosPorModelo,
    };
  }

  // Backup and Restore
  gerarArquivoBackup(): string {
    const payload = {
      versao: '1.0',
      sistema: 'SISTEMA DE AUDITORIA GRUPO SOLUTIONS',
      gerado_em: new Date().toISOString(),
      total_registros: this.produtos.length,
      produtos: this.produtos,
      usuarios: this.usuarios,
      historico: this.historico,
    };
    return JSON.stringify(payload, null, 2);
  }

  restaurarDeBackup(conteudoJson: string): { sucesso: boolean; totalImportado?: number; erro?: string } {
    try {
      const parsed = JSON.parse(conteudoJson);
      if (!parsed || !Array.isArray(parsed.produtos)) {
        return { sucesso: false, erro: 'Arquivo de backup inválido ou corrompido.' };
      }

      this.produtos = parsed.produtos;
      if (Array.isArray(parsed.usuarios)) {
        this.usuarios = parsed.usuarios;
      }
      if (Array.isArray(parsed.historico)) {
        this.historico = parsed.historico;
      }

      // Rebuild index
      this.serialMap.clear();
      for (const p of this.produtos) {
        this.serialMap.set(p.serial.trim().toUpperCase(), p);
      }

      this.salvarTudo();
      this.registrarHistorico(
        this.usuarioAtual?.nome || 'Sistema',
        'RESTAURACAO',
        `Backup restaurado com ${this.produtos.length} produtos auditados.`
      );

      return { sucesso: true, totalImportado: this.produtos.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { sucesso: false, erro: `Falha ao processar arquivo: ${message}` };
    }
  }

  // Import from Excel/CSV batch
  importarPlanilha(
    linhas: {
      modelo: string;
      ean: string;
      serial: string;
      caixa: string;
      data?: string;
      lacrado?: string;
    }[]
  ): {
    totalProcessado: number;
    sucessoCount: number;
    duplicadosCount: number;
    errosCount: number;
    detalhes: string[];
  } {
    let sucessoCount = 0;
    let duplicadosCount = 0;
    let errosCount = 0;
    const detalhes: string[] = [];
    const dataHoje = new Date().toISOString().split('T')[0];

    for (let i = 0; i < linhas.length; i++) {
      const item = linhas[i];
      if (!item.serial || !item.modelo || !item.caixa) {
        errosCount++;
        detalhes.push(`Linha ${i + 1}: dados incompletos (modelo, serial e caixa obrigatórios).`);
        continue;
      }

      const res = this.inserirProduto({
        modelo_produto: item.modelo,
        ean: item.ean || '7890000000000',
        serial: item.serial,
        data_auditoria: item.data || dataHoje,
        numero_caixa: item.caixa,
        produto_lacrado: item.lacrado?.toUpperCase() === 'NÃO' ? 'NÃO' : 'SIM',
        kit_completo: item.lacrado?.toUpperCase() === 'NÃO' ? 'SIM' : null,
        aparelho_marcas_uso: item.lacrado?.toUpperCase() === 'NÃO' ? 'NÃO' : null,
      });

      if (res.sucesso) {
        sucessoCount++;
      } else if (res.erro?.includes('já foi auditado')) {
        duplicadosCount++;
        detalhes.push(`Serial duplicado: ${item.serial}`);
      } else {
        errosCount++;
        detalhes.push(`Erro no serial ${item.serial}: ${res.erro}`);
      }
    }

    return {
      totalProcessado: linhas.length,
      sucessoCount,
      duplicadosCount,
      errosCount,
      detalhes,
    };
  }

  // User management (Admin only)
  listarUsuarios(): Usuario[] {
    return [...this.usuarios];
  }

  salvarUsuario(u: Partial<Usuario> & { nome: string; login: string; senha?: string; perfil: 'ADMINISTRADOR' | 'OPERADOR' }): {
    sucesso: boolean;
    erro?: string;
  } {
    if (u.id) {
      const idx = this.usuarios.findIndex((item) => item.id === u.id);
      if (idx === -1) return { sucesso: false, erro: 'Usuário não encontrado.' };
      this.usuarios[idx] = {
        ...this.usuarios[idx],
        nome: u.nome,
        login: u.login,
        perfil: u.perfil,
        ativo: u.ativo !== undefined ? u.ativo : this.usuarios[idx].ativo,
        senha: u.senha ? u.senha : this.usuarios[idx].senha,
      };
    } else {
      // Check login uniqueness
      if (this.usuarios.some((item) => item.login.toLowerCase() === u.login.toLowerCase())) {
        return { sucesso: false, erro: 'Este login já está em uso por outro usuário.' };
      }
      this.usuarios.push({
        id: Date.now(),
        nome: u.nome,
        login: u.login,
        senha: u.senha || '123456',
        perfil: u.perfil,
        ativo: true,
        criado_em: new Date().toISOString(),
      });
    }
    this.salvarTudo();
    return { sucesso: true };
  }
}

// Global Singleton
export const db = new AuditoriaDatabase();

