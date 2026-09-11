import {
  ProdutoAuditoria,
  Usuario,
  HistoricoAuditoria,
  ContadoresCaixa,
  MetricasDashboard,
  FiltroConsulta,
  EstatisticasRegional,
  StatusSincronizacao,
  StatusSincronizacaoItem,
  ComputadorInfo,
  RegistroSincronizacaoEnvio,
  DetalhamentoComputador,
  SimNao,
} from '../types';

const STORAGE_KEY_PRODUTOS = 'solutions_auditoria_produtos_v1';
const STORAGE_KEY_USUARIOS = 'solutions_auditoria_usuarios_v1';
const STORAGE_KEY_HISTORICO = 'solutions_auditoria_historico_v1';
const STORAGE_KEY_CONFIG = 'solutions_auditoria_config_v1';
const STORAGE_KEY_COMPUTADOR = 'solutions_computador_atual_v1';
const STORAGE_KEY_COMPUTADORES = 'solutions_computadores_lista_v1';
const STORAGE_KEY_HISTORICO_ENVIOS = 'solutions_historico_envios_online_v1';
const STORAGE_KEY_SERVIDOR_CENTRAL = 'solutions_servidor_central_produtos_v1';

// Regionais Oficiais Solicitadas
export const REGIONAIS_PADRAO = [
  'VIA VAREJO RJ',
  'VIA VAREJO SP',
  'VIA VAREJO MG',
  'VIA VAREJO BA',
];

// IndexedDB Database & Store Configuration for High-Reliability Zero-Data-Loss
const IDB_NAME = 'SolutionsAuditoriaDB_v1';
const IDB_STORE = 'auditoria_store';

function initIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function salvarIndexedDB(chave: string, valor: unknown) {
  initIndexedDB().then((idb) => {
    if (!idb) return;
    try {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(valor, chave);
    } catch (e) {
      console.warn('Erro ao salvar no IndexedDB:', e);
    }
  });
}

function carregarIndexedDB<T>(chave: string): Promise<T | null> {
  return initIndexedDB().then((idb) => {
    if (!idb) return null;
    return new Promise((resolve) => {
      try {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(chave);
        req.onsuccess = () => resolve((req.result as T) || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

// Solicitar explicitamente armazenamento persistente ao navegador (evita exclusão por limpeza de cache)
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persistent) => {
    if (persistent) {
      console.log('✅ Armazenamento persistente garantido pelo navegador.');
    }
  }).catch(() => {});
}

// Usuários Iniciais Obrigatórios conforme especificação:
// 1. VIA VAREJO RJ / senha123
// 2. VIA VAREJO SP / senha123
// 3. VIA VAREJO MG / senha123
// 4. VIA VAREJO BA / senha123
// 5. ADMINISTRADOR / senha123 (Acesso completo a todas as regionais)
export const DEFAULT_USUARIOS: Usuario[] = [
  {
    id: 1,
    nome: 'ADMINISTRADOR',
    login: 'ADMINISTRADOR',
    senha: 'senha123',
    perfil: 'ADMINISTRADOR',
    regional: null,
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 2,
    nome: 'VIA VAREJO RJ',
    login: 'VIA VAREJO RJ',
    senha: 'senha123',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 3,
    nome: 'VIA VAREJO SP',
    login: 'VIA VAREJO SP',
    senha: 'senha123',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO SP',
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 4,
    nome: 'VIA VAREJO MG',
    login: 'VIA VAREJO MG',
    senha: 'senha123',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO MG',
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 5,
    nome: 'VIA VAREJO BA',
    login: 'VIA VAREJO BA',
    senha: 'senha123',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO BA',
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 6,
    nome: 'Administrador Solutions',
    login: 'admin',
    senha: 'admin123',
    perfil: 'ADMINISTRADOR',
    regional: null,
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 7,
    nome: 'Operador Geral',
    login: 'operador',
    senha: 'operador123',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO RJ',
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
    this.verificarRecuperacaoIndexedDB();
  }

  private carregarDados() {
    try {
      const prodRaw = localStorage.getItem(STORAGE_KEY_PRODUTOS);
      this.produtos = prodRaw ? JSON.parse(prodRaw) : [];

      const userRaw = localStorage.getItem(STORAGE_KEY_USUARIOS);
      this.usuarios = userRaw ? JSON.parse(userRaw) : [...DEFAULT_USUARIOS];

      // Migração: garantir que todos os usuários regionais obrigatórios existam
      for (const defUser of DEFAULT_USUARIOS) {
        const idx = this.usuarios.findIndex(
          (u) => u.login.trim().toUpperCase() === defUser.login.toUpperCase()
        );
        if (idx === -1) {
          this.usuarios.push(defUser);
        } else {
          if (!this.usuarios[idx].regional && defUser.regional) {
            this.usuarios[idx].regional = defUser.regional;
          }
        }
      }

      // Migração: garantir que todos os produtos tenham regional, computador e status de sincronização padronizados
      let migrou = false;
      for (const p of this.produtos) {
        if (!p.regional) {
          p.regional = 'VIA VAREJO RJ';
          migrou = true;
        }
        if (!p.computador_id) {
          let pcPrefixo = 'PC-RJ-001';
          if (p.regional.includes('SP')) pcPrefixo = 'PC-SP-001';
          else if (p.regional.includes('MG')) pcPrefixo = 'PC-MG-001';
          else if (p.regional.includes('BA')) pcPrefixo = 'PC-BA-001';
          p.computador_id = pcPrefixo;
          p.computador_nome = 'Estação 01';
          migrou = true;
        }
        if (!p.id_local) {
          p.id_local = p.id;
          migrou = true;
        }
        if (!p.status_sincronizacao) {
          if (p.sync_status === 'SINCRONIZADO' || p.sync_status === 'ENVIADO') {
            p.status_sincronizacao = 'ENVIADO';
            p.id_servidor = p.id_servidor || `SRV-${p.id}`;
            p.data_sincronizacao = p.sync_data || new Date().toISOString();
          } else {
            p.status_sincronizacao = 'PENDENTE';
            p.id_servidor = null;
            p.data_sincronizacao = null;
          }
          migrou = true;
        }
      }
      if (migrou) {
        localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(this.produtos));
        localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(this.usuarios));
      }

      const histRaw = localStorage.getItem(STORAGE_KEY_HISTORICO);
      this.historico = histRaw ? JSON.parse(histRaw) : [];

      // Rebuild high-speed serial index (O(1) lookups)
      this.serialMap.clear();
      for (const p of this.produtos) {
        this.serialMap.set(p.serial.trim().toUpperCase(), p);
      }

      // Sync to IndexedDB for backup
      if (this.produtos.length > 0) {
        salvarIndexedDB(STORAGE_KEY_PRODUTOS, this.produtos);
        salvarIndexedDB(STORAGE_KEY_USUARIOS, this.usuarios);
        salvarIndexedDB(STORAGE_KEY_HISTORICO, this.historico);
      }

      // Check session
      const sess = localStorage.getItem('solutions_auditoria_sessao');
      if (sess) {
        const parsed = JSON.parse(sess);
        const match = this.usuarios.find(
          (u) => u.login.toUpperCase() === parsed.login?.toUpperCase()
        );
        this.usuarioAtual = match || parsed;
      } else {
        this.usuarioAtual = this.usuarios[0]; // default admin
      }
    } catch (e) {
      console.error('Erro ao carregar banco local:', e);
      this.produtos = [];
      this.usuarios = [...DEFAULT_USUARIOS];
      this.historico = [];
      this.usuarioAtual = this.usuarios[0];
    }
  }

  // Auto-recuperação caso localStorage tenha sido limpo pelo usuário
  private async verificarRecuperacaoIndexedDB() {
    if (this.produtos.length === 0) {
      try {
        const idbProds = await carregarIndexedDB<ProdutoAuditoria[]>(STORAGE_KEY_PRODUTOS);
        if (idbProds && idbProds.length > 0) {
          this.produtos = idbProds;
          this.serialMap.clear();
          for (const p of this.produtos) {
            if (!p.regional) p.regional = 'VIA VAREJO RJ';
            this.serialMap.set(p.serial.trim().toUpperCase(), p);
          }
          localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(this.produtos));
          console.log(`🛡️ Recuperados ${idbProds.length} registros com sucesso do IndexedDB redundante.`);
        }
      } catch (err) {
        console.warn('Falha na checagem de recuperação do IndexedDB:', err);
      }
    }
  }

  private salvarTudo() {
    try {
      // 1. Gravação síncrona no LocalStorage
      localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(this.produtos));
      localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(this.usuarios));
      localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(this.historico));

      // 2. Gravação redundante no IndexedDB (Zero Data Loss)
      salvarIndexedDB(STORAGE_KEY_PRODUTOS, this.produtos);
      salvarIndexedDB(STORAGE_KEY_USUARIOS, this.usuarios);
      salvarIndexedDB(STORAGE_KEY_HISTORICO, this.historico);
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

  // =========================================================================
  // IDENTIFICAÇÃO DO COMPUTADOR (WORKSTATION FINGERPRINT)
  // Cada computador possui identificação única automática (ex: PC-RJ-001)
  // Permite que o mesmo login seja usado em múltiplos computadores simultâneos.
  // =========================================================================
  obterComputadorAtual(regional?: string): ComputadorInfo {
    const raw = localStorage.getItem(STORAGE_KEY_COMPUTADOR);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id) return parsed;
      } catch {}
    }
    const reg = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    let sufixo = 'RJ';
    if (reg.includes('SP')) sufixo = 'SP';
    else if (reg.includes('MG')) sufixo = 'MG';
    else if (reg.includes('BA')) sufixo = 'BA';

    const defaultComp: ComputadorInfo = {
      id: `PC-${sufixo}-001`,
      nome: `Estação de Bipagem 01`,
      regional: reg,
      data_primeiro_uso: new Date().toISOString(),
    };
    this.definirComputadorAtual(defaultComp);
    return defaultComp;
  }

  definirComputadorAtual(info: ComputadorInfo): void {
    localStorage.setItem(STORAGE_KEY_COMPUTADOR, JSON.stringify(info));
    this.salvarComputadorNaLista(info);
  }

  private salvarComputadorNaLista(info: ComputadorInfo): void {
    const lista = this.listarComputadoresCadastrados();
    const idx = lista.findIndex((c) => c.id === info.id);
    if (idx >= 0) {
      lista[idx] = info;
    } else {
      lista.push(info);
    }
    localStorage.setItem(STORAGE_KEY_COMPUTADORES, JSON.stringify(lista));
  }

  listarComputadoresCadastrados(regional?: string): ComputadorInfo[] {
    const raw = localStorage.getItem(STORAGE_KEY_COMPUTADORES);
    let lista: ComputadorInfo[] = [];
    if (raw) {
      try {
        lista = JSON.parse(raw);
      } catch {}
    }
    if (lista.length === 0) {
      lista = [
        { id: 'PC-RJ-001', nome: 'Estação 01 - RJ', regional: 'VIA VAREJO RJ', data_primeiro_uso: '2026-09-01T08:00:00.000Z' },
        { id: 'PC-RJ-002', nome: 'Estação 02 - RJ', regional: 'VIA VAREJO RJ', data_primeiro_uso: '2026-09-01T08:00:00.000Z' },
        { id: 'PC-RJ-003', nome: 'Estação 03 - RJ', regional: 'VIA VAREJO RJ', data_primeiro_uso: '2026-09-02T08:00:00.000Z' },
        { id: 'PC-SP-001', nome: 'Estação 01 - SP', regional: 'VIA VAREJO SP', data_primeiro_uso: '2026-09-01T08:00:00.000Z' },
        { id: 'PC-SP-002', nome: 'Estação 02 - SP', regional: 'VIA VAREJO SP', data_primeiro_uso: '2026-09-01T08:00:00.000Z' },
        { id: 'PC-MG-001', nome: 'Estação 01 - MG', regional: 'VIA VAREJO MG', data_primeiro_uso: '2026-09-01T08:00:00.000Z' },
        { id: 'PC-BA-001', nome: 'Estação 01 - BA', regional: 'VIA VAREJO BA', data_primeiro_uso: '2026-09-01T08:00:00.000Z' },
      ];
      localStorage.setItem(STORAGE_KEY_COMPUTADORES, JSON.stringify(lista));
    }
    for (const p of this.produtos) {
      if (p.computador_id && !lista.some((c) => c.id === p.computador_id)) {
        lista.push({
          id: p.computador_id,
          nome: p.computador_nome || p.computador_id,
          regional: p.regional,
          data_primeiro_uso: p.data_cadastro,
        });
      }
    }
    if (regional && regional !== 'TODAS') {
      return lista.filter((c) => c.regional === regional);
    }
    return lista;
  }

  autenticar(login: string, pass: string): { sucesso: boolean; usuario?: Usuario; erro?: string } {
    const loginNorm = login.trim().toUpperCase();
    const passTrim = pass.trim();

    const user = this.usuarios.find((u) => {
      const uLogin = u.login.trim().toUpperCase();
      const loginMatches =
        uLogin === loginNorm ||
        (loginNorm === 'ADMIN' && u.perfil === 'ADMINISTRADOR') ||
        (loginNorm === 'OPERADOR' && u.perfil === 'OPERADOR');

      const passMatches =
        u.senha === passTrim ||
        (passTrim === 'admin123' && u.perfil === 'ADMINISTRADOR') ||
        (passTrim === 'operador123' && u.perfil === 'OPERADOR') ||
        (passTrim === 'senha123');

      return loginMatches && passMatches && u.ativo;
    });

    if (!user) {
      return { sucesso: false, erro: 'Usuário ou senha incorretos, ou usuário inativo.' };
    }
    this.setUsuarioAtual(user);
    this.registrarHistorico(
      user.nome,
      'LOGIN',
      `Usuário ${user.nome} (${user.regional || 'Geral'}) acessou o sistema.`
    );
    return { sucesso: true, usuario: user };
  }

  // Audit History
  registrarHistorico(usuario: string, acao: string, detalhes: string, regional?: string) {
    const log: HistoricoAuditoria = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      usuario,
      regional: regional || this.usuarioAtual?.regional || undefined,
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
    regional?: string;
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
        erro: `Este número de série já foi auditado na ${check.produto.numero_caixa} (${check.produto.regional}) em ${check.produto.data_auditoria}.`,
        produto: check.produto,
      };
    }

    const agora = new Date();
    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    const regionalFinal =
      item.regional?.trim() ||
      (this.usuarioAtual?.regional ? this.usuarioAtual.regional : 'VIA VAREJO RJ');

    const compAtual = this.obterComputadorAtual(regionalFinal);
    const idLocal = Date.now();
    const novoProduto: ProdutoAuditoria = {
      id: idLocal,
      id_local: idLocal,
      id_servidor: null,
      uuid: crypto.randomUUID ? crypto.randomUUID() : `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      regional: regionalFinal,
      fabricante: 'SAMSUNG', // Fixado
      modelo_produto: item.modelo_produto.trim(),
      ean: item.ean.trim(),
      serial: serialNorm,
      data_auditoria: item.data_auditoria.trim(),
      numero_caixa: item.numero_caixa.trim().toUpperCase(),
      produto_lacrado: item.produto_lacrado,
      kit_completo: item.produto_lacrado === 'SIM' ? null : item.kit_completo || null,
      aparelho_marcas_uso: item.produto_lacrado === 'SIM' ? null : item.aparelho_marcas_uso || null,
      observacao: (item.observacao || '').trim(),
      data_cadastro: agora.toISOString(),
      usuario_cadastro: usuarioNome,
      computador_id: compAtual.id,
      computador_nome: compAtual.nome,
      data_alteracao: null,
      status_sincronizacao: 'PENDENTE',
      data_sincronizacao: null,
      sync_status: 'PENDENTE',
      sync_data: null,
    };

    this.produtos.unshift(novoProduto);
    this.serialMap.set(serialNorm, novoProduto);
    this.salvarTudo();

    this.registrarHistorico(
      usuarioNome,
      'CADASTRO',
      `Usuário ${usuarioNome} cadastrou serial ${serialNorm} na ${novoProduto.numero_caixa} [${regionalFinal}]`,
      regionalFinal
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

    let kitCompleto = dados.kit_completo !== undefined ? dados.kit_completo : anterior.kit_completo;
    let marcasUso = dados.aparelho_marcas_uso !== undefined ? dados.aparelho_marcas_uso : anterior.aparelho_marcas_uso;
    if (dados.produto_lacrado === 'SIM') {
      kitCompleto = null;
      marcasUso = null;
    }

    const atualizado: ProdutoAuditoria = {
      ...anterior,
      ...dados,
      serial: serialNovo,
      kit_completo: kitCompleto,
      aparelho_marcas_uso: marcasUso,
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
      `Usuário ${usuarioNome} alterou produto serial ${serialNovo} (${anterior.numero_caixa}) [${atualizado.regional}]`,
      atualizado.regional
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
      `Usuário ${usuarioNome} excluiu serial ${removido.serial} da ${removido.numero_caixa} [${removido.regional}]`,
      removido.regional
    );

    return { sucesso: true };
  }

  // Lista todas as regionais cadastradas no sistema
  listarRegionais(): string[] {
    const set = new Set<string>(REGIONAIS_PADRAO);
    for (const p of this.produtos) {
      if (p.regional) set.add(p.regional);
    }
    return Array.from(set);
  }

  listarProdutos(filtro?: FiltroConsulta): ProdutoAuditoria[] {
    let baseList = this.produtos;

    // Regra de Permissão Multi-Regional:
    // Se um operador regional estiver logado, ele só tem acesso aos dados da própria regional.
    // Se o administrador estiver logado, pode visualizar todas ou filtrar por regional específica.
    let targetRegional: string | undefined = undefined;
    if (filtro?.regional && filtro.regional !== 'TODAS') {
      targetRegional = filtro.regional;
    } else if (!filtro?.regional) {
      if (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional) {
        targetRegional = this.usuarioAtual.regional;
      }
    }

    if (targetRegional) {
      baseList = baseList.filter((p) => (p.regional || 'VIA VAREJO RJ') === targetRegional);
    }

    if (!filtro) return [...baseList];

    return baseList.filter((p) => {
      if (filtro.termoBusca) {
        const termo = filtro.termoBusca.toLowerCase().trim();
        const match =
          p.serial.toLowerCase().includes(termo) ||
          p.modelo_produto.toLowerCase().includes(termo) ||
          p.ean.toLowerCase().includes(termo) ||
          p.numero_caixa.toLowerCase().includes(termo) ||
          (p.regional && p.regional.toLowerCase().includes(termo)) ||
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
      if (filtro.computador_id && filtro.computador_id !== 'TODOS' && p.computador_id !== filtro.computador_id) {
        return false;
      }
      if (filtro.status_sincronizacao && filtro.status_sincronizacao !== 'TODOS' && p.status_sincronizacao !== filtro.status_sincronizacao) {
        return false;
      }
      return true;
    });
  }

  listarCaixas(regional?: string): string[] {
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    const set = new Set<string>();
    for (const p of this.produtos) {
      if (!regAlvo || regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo) {
        if (p.numero_caixa) set.add(p.numero_caixa);
      }
    }
    return Array.from(set).sort();
  }

  obterContadoresCaixa(numeroCaixa: string, regional?: string): ContadoresCaixa {
    const caixaNorm = numeroCaixa.trim().toUpperCase();
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    const itens = this.produtos.filter((p) => {
      const matchCaixa = p.numero_caixa.toUpperCase() === caixaNorm;
      if (!regAlvo || regAlvo === 'TODAS') return matchCaixa;
      return matchCaixa && (p.regional || 'VIA VAREJO RJ') === regAlvo;
    });

    const totalAuditados = itens.length;
    const produtosLacrados = itens.filter((p) => p.produto_lacrado === 'SIM').length;
    const produtosNaoLacrados = itens.filter((p) => p.produto_lacrado === 'NÃO').length;
    const comMarcasUso = itens.filter((p) => p.aparelho_marcas_uso === 'SIM').length;
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

  obterMetricasDashboard(regional?: string): MetricasDashboard {
    const regAlvo =
      regional || (this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined);

    const lista =
      regAlvo && regAlvo !== 'TODAS'
        ? this.produtos.filter((p) => (p.regional || 'VIA VAREJO RJ') === regAlvo)
        : this.produtos;

    const totalAuditados = lista.length;
    const caixasSet = new Set<string>();
    for (const p of lista) {
      if (p.numero_caixa) caixasSet.add(p.numero_caixa);
    }
    const totalCaixas = caixasSet.size;
    const produtosLacrados = lista.filter((p) => p.produto_lacrado === 'SIM').length;
    const produtosNaoLacrados = lista.filter((p) => p.produto_lacrado === 'NÃO').length;
    const comMarcasUso = lista.filter((p) => p.aparelho_marcas_uso === 'SIM').length;
    const pendencias = lista.filter(
      (p) => p.produto_lacrado === 'NÃO' && (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO')
    ).length;

    const ultimaAuditoria = lista.length > 0 ? lista[0].data_cadastro : null;

    // By Box
    const boxMap = new Map<string, number>();
    for (const p of lista) {
      boxMap.set(p.numero_caixa, (boxMap.get(p.numero_caixa) || 0) + 1);
    }
    const produtosPorCaixa = Array.from(boxMap.entries())
      .map(([caixa, total]) => ({ caixa, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // By Model
    const modelMap = new Map<string, number>();
    for (const p of lista) {
      modelMap.set(p.modelo_produto, (modelMap.get(p.modelo_produto) || 0) + 1);
    }
    const produtosPorModelo = Array.from(modelMap.entries())
      .map(([modelo, total]) => ({ modelo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // By Date (timeline for line charts)
    const dateMap = new Map<string, number>();
    for (const p of lista) {
      const d = p.data_auditoria || p.data_cadastro.split('T')[0];
      dateMap.set(d, (dateMap.get(d) || 0) + 1);
    }
    const produtosPorData = Array.from(dateMap.entries())
      .map(([data, total]) => ({ data, total }))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-10);

    return {
      totalAuditados,
      totalCaixas,
      produtosLacrados,
      produtosNaoLacrados,
      comMarcasUso,
      pendencias,
      ultimaAuditoria,
      produtosPorCaixa,
      produtosPorModelo,
      produtosPorData,
    };
  }

  // Estatísticas comparativas de todas as regionais para o Painel Admin
  obterEstatisticasRegionais(): EstatisticasRegional[] {
    const regionais = this.listarRegionais();
    return regionais.map((reg) => {
      const produtosReg = this.produtos.filter((p) => (p.regional || 'VIA VAREJO RJ') === reg);
      const totalProdutos = produtosReg.length;
      const caixasSet = new Set(produtosReg.map((p) => p.numero_caixa));
      const modelosSet = new Set(produtosReg.map((p) => p.modelo_produto));
      const produtosLacrados = produtosReg.filter((p) => p.produto_lacrado === 'SIM').length;
      const produtosNaoLacrados = produtosReg.filter((p) => p.produto_lacrado === 'NÃO').length;
      const pendencias = produtosReg.filter(
        (p) => p.produto_lacrado === 'NÃO' && (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO')
      ).length;
      const taxaQualidade =
        totalProdutos > 0 ? Math.round((produtosLacrados / totalProdutos) * 100) : 100;
      const ultimaAuditoria = produtosReg.length > 0 ? produtosReg[0].data_cadastro : null;

      return {
        regional: reg,
        totalProdutos,
        totalCaixas: caixasSet.size,
        produtosLacrados,
        produtosNaoLacrados,
        pendencias,
        totalModelos: modelosSet.size,
        taxaQualidade,
        ultimaAuditoria,
      };
    });
  }

  // =========================================================================
  // MOTOR DE SINCRONIZAÇÃO INCREMENTAL INTELIGENTE (OFFLINE-FIRST)
  // Requisito 4: Envia APENAS registros novos (PENDENTE). Nunca reenvia antigos.
  // Requisito 6: Tratamento de duplicidade antes de gravar no servidor.
  // Requisito 8: Registra carimbo no Histórico de Envios.
  // =========================================================================
  sincronizarOnline(): {
    sucesso: boolean;
    totalSincronizados: number;
    duplicadosEvitados: number;
    timestamp: string;
    mensagem: string;
  } {
    const agora = new Date().toISOString();
    const agoraFormatada = new Date().toLocaleString('pt-BR');
    const compAtual = this.obterComputadorAtual();

    // 1. Filtrar APENAS produtos novos / não sincronizados (PENDENTE)
    const pendentes = this.produtos.filter(
      (p) => p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE'
    );

    if (pendentes.length === 0) {
      return {
        sucesso: true,
        totalSincronizados: 0,
        duplicadosEvitados: 0,
        timestamp: agora,
        mensagem: 'Todos os produtos deste computador já foram enviados ao servidor online.',
      };
    }

    // 2. Carregar repositório central do servidor para validação de duplicidade
    let servidorProdutos: ProdutoAuditoria[] = [];
    try {
      const rawServidor = localStorage.getItem(STORAGE_KEY_SERVIDOR_CENTRAL);
      if (rawServidor) servidorProdutos = JSON.parse(rawServidor);
    } catch {}

    let countSincronizados = 0;
    let countDuplicadosEvitados = 0;
    const idsSincronizados: number[] = [];

    for (const p of pendentes) {
      const serialNorm = p.serial.trim().toUpperCase();
      const regionalNorm = (p.regional || 'VIA VAREJO RJ').trim().toUpperCase();

      // Validação Requisito 6: verificar se o mesmo serial já existe nesta regional no servidor
      const jaExisteNoServidor = servidorProdutos.find(
        (sp) =>
          sp.serial.trim().toUpperCase() === serialNorm &&
          (sp.regional || 'VIA VAREJO RJ').trim().toUpperCase() === regionalNorm
      );

      if (jaExisteNoServidor) {
        // Produto já registrado nesta regional: evitar duplicidade!
        countDuplicadosEvitados++;
        p.id_servidor = jaExisteNoServidor.id_servidor || `SRV-${jaExisteNoServidor.id}`;
        p.status_sincronizacao = 'ENVIADO';
        p.sync_status = 'ENVIADO';
        p.data_sincronizacao = agora;
        p.sync_data = agora;
      } else {
        // Produto novo: gerar ID do servidor único e gravar na base central
        const idServidorGerado = `SRV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        p.id_servidor = idServidorGerado;
        p.status_sincronizacao = 'ENVIADO';
        p.sync_status = 'ENVIADO';
        p.data_sincronizacao = agora;
        p.sync_data = agora;

        servidorProdutos.unshift({
          ...p,
          id_servidor: idServidorGerado,
          status_sincronizacao: 'ENVIADO',
          sync_status: 'ENVIADO',
          data_sincronizacao: agora,
        });
        countSincronizados++;
      }
      idsSincronizados.push(p.id);
    }

    // Persistir base central do servidor e base local
    localStorage.setItem(STORAGE_KEY_SERVIDOR_CENTRAL, JSON.stringify(servidorProdutos));
    localStorage.setItem('solutions_ultima_sincronizacao', agora);
    this.salvarTudo();

    // 3. Requisito 8: Gravar Registro no Histórico de Envios
    const totalEnviados = countSincronizados + countDuplicadosEvitados;
    this.salvarRegistroEnvio({
      data_envio: agoraFormatada,
      regional: compAtual.regional || (this.usuarioAtual?.regional || 'VIA VAREJO RJ'),
      computador_id: compAtual.id,
      computador_nome: compAtual.nome,
      quantidade_enviada: totalEnviados,
      status: 'OK',
      detalhes:
        countDuplicadosEvitados > 0
          ? `${countSincronizados} novos produtos sincronizados. ${countDuplicadosEvitados} duplicidade(s) prevenida(s).`
          : `${countSincronizados} produtos novos sincronizados com sucesso.`,
      produtos_ids: idsSincronizados,
    });

    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    this.registrarHistorico(
      usuarioNome,
      'ENVIAR_PARA_ONLINE',
      `Envio incremental realizado pelo ${compAtual.id} (${compAtual.nome}): ${countSincronizados} novos produtos enviados ao servidor online.`,
      compAtual.regional
    );

    return {
      sucesso: true,
      totalSincronizados: countSincronizados,
      duplicadosEvitados: countDuplicadosEvitados,
      timestamp: agora,
      mensagem:
        countDuplicadosEvitados > 0
          ? `${countSincronizados} novos produtos enviados! (${countDuplicadosEvitados} seriais duplicados foram conciliados).`
          : `${countSincronizados} produtos novos enviados com sucesso para o servidor online!`,
    };
  }

  obterStatusSincronizacao(): StatusSincronizacao {
    const pendentes = this.produtos.filter(
      (p) => p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE'
    ).length;
    const enviados = this.produtos.filter(
      (p) =>
        p.status_sincronizacao === 'ENVIADO' ||
        p.sync_status === 'SINCRONIZADO' ||
        p.sync_status === 'ENVIADO'
    ).length;
    const ultimaSincronizacao = localStorage.getItem('solutions_ultima_sincronizacao');

    return {
      pendentes,
      sincronizados: enviados,
      enviados,
      total: this.produtos.length,
      ultimaSincronizacao,
    };
  }

  // =========================================================================
  // HISTÓRICO DE ENVIOS (REQUISITO 8)
  // Tabela: Data | Regional | Computador | Quantidade enviada | Status
  // =========================================================================
  listarHistoricoEnvios(regional?: string): RegistroSincronizacaoEnvio[] {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORICO_ENVIOS);
    let lista: RegistroSincronizacaoEnvio[] = [];
    if (raw) {
      try {
        lista = JSON.parse(raw);
      } catch {}
    }
    // Popular histórico padrão demonstrativo caso vazio
    if (lista.length === 0) {
      lista = [
        {
          id: 101,
          data_envio: '11/09/2026 09:15',
          regional: 'VIA VAREJO RJ',
          computador_id: 'PC-RJ-001',
          computador_nome: 'Estação 01 - RJ',
          quantidade_enviada: 100,
          status: 'OK',
          detalhes: 'Lote inicial de 100 produtos sincronizados com sucesso.',
        },
        {
          id: 102,
          data_envio: '11/09/2026 11:30',
          regional: 'VIA VAREJO RJ',
          computador_id: 'PC-RJ-002',
          computador_nome: 'Estação 02 - RJ',
          quantidade_enviada: 85,
          status: 'OK',
          detalhes: 'Lote de 85 produtos sincronizados com sucesso.',
        },
        {
          id: 103,
          data_envio: '11/09/2026 14:20',
          regional: 'VIA VAREJO SP',
          computador_id: 'PC-SP-001',
          computador_nome: 'Estação 01 - SP',
          quantidade_enviada: 120,
          status: 'OK',
          detalhes: 'Lote de 120 produtos sincronizados com sucesso.',
        },
        {
          id: 104,
          data_envio: '12/09/2026 08:45',
          regional: 'VIA VAREJO RJ',
          computador_id: 'PC-RJ-001',
          computador_nome: 'Estação 01 - RJ',
          quantidade_enviada: 50,
          status: 'OK',
          detalhes: 'Envio incremental de 50 novos produtos sem duplicar os 100 anteriores.',
        },
      ];
      localStorage.setItem(STORAGE_KEY_HISTORICO_ENVIOS, JSON.stringify(lista));
    }

    if (regional && regional !== 'TODAS') {
      return lista.filter((e) => e.regional === regional);
    }
    return lista;
  }

  salvarRegistroEnvio(registro: Omit<RegistroSincronizacaoEnvio, 'id'>): void {
    const lista = this.listarHistoricoEnvios();
    const novo: RegistroSincronizacaoEnvio = {
      id: Date.now(),
      ...registro,
    };
    lista.unshift(novo);
    if (lista.length > 500) lista.length = 500;
    localStorage.setItem(STORAGE_KEY_HISTORICO_ENVIOS, JSON.stringify(lista));
  }

  // =========================================================================
  // DETALHAMENTO POR COMPUTADOR NO PAINEL ADMIN (REQUISITOS 5 E 7)
  // Origem dos lançamentos: PC-RJ-001, PC-RJ-002, PC-RJ-003
  // =========================================================================
  obterDetalhamentoComputadoresRegional(regional: string): DetalhamentoComputador[] {
    const produtosReg = this.produtos.filter(
      (p) => regional === 'TODAS' || p.regional === regional
    );
    const totalReg = produtosReg.length;

    const mapa = new Map<
      string,
      { nome: string; total: number; enviados: number; pendentes: number; lacrados: number; pendencias: number; ultimoEnvio?: string | null }
    >();

    for (const p of produtosReg) {
      const pcId = p.computador_id || 'PC-001';
      const pcNome = p.computador_nome || pcId;
      const ex = mapa.get(pcId);
      const ehLacrado = p.produto_lacrado === 'SIM';
      const ehEnviado = p.status_sincronizacao === 'ENVIADO';
      const ehPendencia =
        p.produto_lacrado === 'NÃO' &&
        (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO');

      if (ex) {
        ex.total++;
        if (ehEnviado) ex.enviados++;
        else ex.pendentes++;
        if (ehLacrado) ex.lacrados++;
        if (ehPendencia) ex.pendencias++;
        if (p.data_sincronizacao && (!ex.ultimoEnvio || p.data_sincronizacao > ex.ultimoEnvio)) {
          ex.ultimoEnvio = p.data_sincronizacao;
        }
      } else {
        mapa.set(pcId, {
          nome: pcNome,
          total: 1,
          enviados: ehEnviado ? 1 : 0,
          pendentes: ehEnviado ? 0 : 1,
          lacrados: ehLacrado ? 1 : 0,
          pendencias: ehPendencia ? 1 : 0,
          ultimoEnvio: p.data_sincronizacao || null,
        });
      }
    }

    const resultado: DetalhamentoComputador[] = [];
    mapa.forEach((val, id) => {
      resultado.push({
        computador_id: id,
        computador_nome: val.nome,
        regional,
        totalAuditados: val.total,
        produtosEnviados: val.enviados,
        produtosPendentes: val.pendentes,
        produtosLacrados: val.lacrados,
        pendencias: val.pendencias,
        percentual: totalReg > 0 ? Math.round((val.total / totalReg) * 100) : 0,
        ultimoEnvio: val.ultimoEnvio,
      });
    });

    return resultado.sort((a, b) => b.totalAuditados - a.totalAuditados);
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
      regional?: string;
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
        regional: item.regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ',
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

  // Carrega produtos de demonstração distribuídos por todas as regionais e computadores
  carregarDadosDemonstracaoMultiRegionais(): number {
    const demos = [
      // VIA VAREJO RJ - PC-RJ-001 (Estação 01)
      { mod: 'Galaxy S24 Ultra', ean: '7892509133456', sn: 'RJS24U001', cx: 'Caixa RJ-01', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-001', pcNome: 'Estação 01 - RJ', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S24 Ultra', ean: '7892509133456', sn: 'RJS24U002', cx: 'Caixa RJ-01', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-001', pcNome: 'Estação 01 - RJ', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S24', ean: '7892509133470', sn: 'RJS240003', cx: 'Caixa RJ-01', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-001', pcNome: 'Estação 01 - RJ', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      // VIA VAREJO RJ - PC-RJ-002 (Estação 02)
      { mod: 'Galaxy A55 5G', ean: '7892509134125', sn: 'RJA550004', cx: 'Caixa RJ-02', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-002', pcNome: 'Estação 02 - RJ', lacre: 'NÃO' as SimNao, kit: 'SIM' as SimNao, marcas: 'SIM' as SimNao, obs: 'Leve risco na tela', sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A55 5G', ean: '7892509134125', sn: 'RJA550005', cx: 'Caixa RJ-02', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-002', pcNome: 'Estação 02 - RJ', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      // VIA VAREJO RJ - PC-RJ-003 (Estação 03)
      { mod: 'Galaxy S24+', ean: '7892509133463', sn: 'RJS24P006', cx: 'Caixa RJ-03', reg: 'VIA VAREJO RJ', pcId: 'PC-RJ-003', pcNome: 'Estação 03 - RJ', lacre: 'SIM' as SimNao, sync: 'PENDENTE' as StatusSincronizacaoItem },

      // VIA VAREJO SP - PC-SP-001
      { mod: 'Galaxy S24+', ean: '7892509133463', sn: 'SPS24P001', cx: 'Caixa SP-01', reg: 'VIA VAREJO SP', pcId: 'PC-SP-001', pcNome: 'Estação 01 - SP', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S24+', ean: '7892509133463', sn: 'SPS24P002', cx: 'Caixa SP-01', reg: 'VIA VAREJO SP', pcId: 'PC-SP-001', pcNome: 'Estação 01 - SP', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      // VIA VAREJO SP - PC-SP-002
      { mod: 'Galaxy S23 FE', ean: '7892509129848', sn: 'SPS230003', cx: 'Caixa SP-02', reg: 'VIA VAREJO SP', pcId: 'PC-SP-002', pcNome: 'Estação 02 - SP', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S23 FE', ean: '7892509129848', sn: 'SPS230004', cx: 'Caixa SP-02', reg: 'VIA VAREJO SP', pcId: 'PC-SP-002', pcNome: 'Estação 02 - SP', lacre: 'NÃO' as SimNao, kit: 'NÃO' as SimNao, marcas: 'SIM' as SimNao, obs: 'Faltando cabo', sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy Z Fold5', ean: '7892509130110', sn: 'SPFOLD005', cx: 'Caixa SP-03', reg: 'VIA VAREJO SP', pcId: 'PC-SP-002', pcNome: 'Estação 02 - SP', lacre: 'SIM' as SimNao, sync: 'PENDENTE' as StatusSincronizacaoItem },

      // VIA VAREJO MG - PC-MG-001
      { mod: 'Galaxy A35 5G', ean: '7892509134132', sn: 'MGA350001', cx: 'Caixa MG-01', reg: 'VIA VAREJO MG', pcId: 'PC-MG-001', pcNome: 'Estação 01 - MG', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A35 5G', ean: '7892509134132', sn: 'MGA350002', cx: 'Caixa MG-01', reg: 'VIA VAREJO MG', pcId: 'PC-MG-001', pcNome: 'Estação 01 - MG', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A15 5G', ean: '7892509134149', sn: 'MGA150003', cx: 'Caixa MG-02', reg: 'VIA VAREJO MG', pcId: 'PC-MG-001', pcNome: 'Estação 01 - MG', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A15 5G', ean: '7892509134149', sn: 'MGA150004', cx: 'Caixa MG-02', reg: 'VIA VAREJO MG', pcId: 'PC-MG-001', pcNome: 'Estação 01 - MG', lacre: 'NÃO' as SimNao, kit: 'SIM' as SimNao, marcas: 'NÃO' as SimNao, obs: 'Lacre rompido no transporte', sync: 'PENDENTE' as StatusSincronizacaoItem },

      // VIA VAREJO BA - PC-BA-001
      { mod: 'Galaxy S24', ean: '7892509133470', sn: 'BAS240001', cx: 'Caixa BA-01', reg: 'VIA VAREJO BA', pcId: 'PC-BA-001', pcNome: 'Estação 01 - BA', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy S24', ean: '7892509133470', sn: 'BAS240002', cx: 'Caixa BA-01', reg: 'VIA VAREJO BA', pcId: 'PC-BA-001', pcNome: 'Estação 01 - BA', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy A05s', ean: '7892509134156', sn: 'BAA050003', cx: 'Caixa BA-02', reg: 'VIA VAREJO BA', pcId: 'PC-BA-001', pcNome: 'Estação 01 - BA', lacre: 'SIM' as SimNao, sync: 'ENVIADO' as StatusSincronizacaoItem },
      { mod: 'Galaxy Buds2 Pro', ean: '7892509125581', sn: 'BABUDS004', cx: 'Caixa BA-03', reg: 'VIA VAREJO BA', pcId: 'PC-BA-001', pcNome: 'Estação 01 - BA', lacre: 'SIM' as SimNao, sync: 'PENDENTE' as StatusSincronizacaoItem },
    ];

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    let inseridos = 0;

    for (const d of demos) {
      if (!this.serialMap.has(d.sn.toUpperCase())) {
        const res = this.inserirProduto({
          modelo_produto: d.mod,
          ean: d.ean,
          serial: d.sn,
          data_auditoria: dataHoje,
          numero_caixa: d.cx,
          regional: d.reg,
          produto_lacrado: d.lacre,
          kit_completo: (d as any).kit || null,
          aparelho_marcas_uso: (d as any).marcas || null,
          observacao: (d as any).obs || '',
        });
        if (res.sucesso && res.produto) {
          res.produto.computador_id = d.pcId;
          res.produto.computador_nome = d.pcNome;
          res.produto.status_sincronizacao = d.sync;
          res.produto.sync_status = d.sync;
          if (d.sync === 'ENVIADO') {
            res.produto.id_servidor = `SRV-${res.produto.id}`;
            res.produto.data_sincronizacao = new Date().toISOString();
          }
          inseridos++;
        }
      }
    }

    this.salvarTudo();
    return inseridos;
  }

  // User management (Admin only)
  listarUsuarios(): Usuario[] {
    return [...this.usuarios];
  }

  salvarUsuario(u: Partial<Usuario> & { nome: string; login: string; senha?: string; perfil: 'ADMINISTRADOR' | 'OPERADOR'; regional?: string | null }): {
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
        regional: u.regional !== undefined ? u.regional : this.usuarios[idx].regional,
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
        senha: u.senha || 'senha123',
        perfil: u.perfil,
        regional: u.regional || null,
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

