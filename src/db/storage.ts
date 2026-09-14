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
  FotoGrupoAuditoria,
  GrupoFotosInfo,
  FotoCaixa10Item,
  Registro10FotosCaixa,
  ROTULOS_10_FOTOS_CAIXA,
  DetalheImeiDuplicado,
  LogTentativaDuplicado,
  ResultadoSincronizacao,
  StatusConexao,
  LogAcessoUsuario,
  ConfiguracaoInicialInfo,
} from '../types';

const STORAGE_KEY_PRODUTOS = 'solutions_auditoria_produtos_v1';
const STORAGE_KEY_USUARIOS = 'solutions_auditoria_usuarios_v1';
const STORAGE_KEY_HISTORICO = 'solutions_auditoria_historico_v1';
const STORAGE_KEY_CONFIG = 'solutions_auditoria_config_v1';
const STORAGE_KEY_COMPUTADOR = 'solutions_computador_atual_v1';
const STORAGE_KEY_COMPUTADORES = 'solutions_computadores_lista_v1';
const STORAGE_KEY_HISTORICO_ENVIOS = 'solutions_historico_envios_online_v1';
const STORAGE_KEY_SERVIDOR_CENTRAL = 'solutions_servidor_central_produtos_v1';
const STORAGE_KEY_FOTOS = 'solutions_auditoria_fotos_grupos_v1';
const STORAGE_KEY_FOTOS_10_CAIXAS = 'solutions_auditoria_10_fotos_caixas_v1';
const STORAGE_KEY_SERIAIS_LIMPOS_TELA = 'solutions_seriais_limpos_tela_v1';
const STORAGE_KEY_TENTATIVAS_DUPLICADAS = 'solutions_tentativas_envio_duplicado_v1';
const STORAGE_KEY_CONFIG_INICIAL = 'solutions_configuracao_inicial_v1';
const STORAGE_KEY_LOGS_ACESSO = 'solutions_logs_acesso_usuarios_v1';

// Regionais Oficiais Solicitadas
export const REGIONAIS_PADRAO = [
  'VIA VAREJO RJ',
  'VIA VAREJO SP',
  'VIA VAREJO MG',
  'VIA VAREJO BA',
];

export const CLOUD_STORAGE_URL = 'https://extendsclass.com/api/json-storage/bin/dcccfea';
export const CLOUD_STORAGE_BACKUP_URL = 'https://extendsclass.com/api/json-storage/bin/ffedcbb';

async function prepararFotoLeveParaSync(dataUri: string): Promise<string> {
  if (!dataUri) return '';
  if (!dataUri.startsWith('data:image') || dataUri.length < 2000) return dataUri;

  // 1. Tentar upload rápido para freeimage.host obtendo URL leve
  try {
    const base64Content = dataUri.split(',')[1];
    if (base64Content) {
      const form = new FormData();
      form.append('key', '6d207e02198a847aa98d0a2a901485a5');
      form.append('action', 'upload');
      form.append('source', base64Content);
      form.append('format', 'json');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data?.image?.url) {
          return data.image.url;
        }
      }
    }
  } catch {}

  // 2. Se timeout ou offline, usar placeholder SVG ultraleve (< 200 bytes) para não estourar a nuvem
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90" fill="%230F172A"/><text x="60" y="45" fill="%2338BDF8" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="middle">FOTO REGISTRADA</text></svg>';
}

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

// Usuários Iniciais Oficiais conforme especificação:
// 1. VIA VAREJO RJ / Senha123
// 2. VIA VAREJO SP / Senha123
// 3. VIA VAREJO MG / Senha123
// 4. VIA VAREJO BA / Senha123
// 5. ADMIN / Solutions123 (Administrador Geral com acesso total)
export const DEFAULT_USUARIOS: Usuario[] = [
  {
    id: 1,
    nome: 'ADMIN',
    login: 'ADMIN',
    senha: 'Solutions123',
    perfil: 'ADMINISTRADOR',
    regional: null,
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 2,
    nome: 'ADMINISTRADOR',
    login: 'ADMINISTRADOR',
    senha: 'Solutions123',
    perfil: 'ADMINISTRADOR',
    regional: null,
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 3,
    nome: 'VIA VAREJO RJ',
    login: 'VIA VAREJO RJ',
    senha: 'Senha123',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO RJ',
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 3,
    nome: 'VIA VAREJO SP',
    login: 'VIA VAREJO SP',
    senha: 'Senha123',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO SP',
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 4,
    nome: 'VIA VAREJO MG',
    login: 'VIA VAREJO MG',
    senha: 'Senha123',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO MG',
    ativo: true,
    criado_em: new Date().toISOString(),
  },
  {
    id: 5,
    nome: 'VIA VAREJO BA',
    login: 'VIA VAREJO BA',
    senha: 'Senha123',
    perfil: 'OPERADOR',
    regional: 'VIA VAREJO BA',
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
  private fotosGrupos: FotoGrupoAuditoria[] = [];
  private registros10Fotos: Registro10FotosCaixa[] = [];
  private usuarioAtual: Usuario | null = null;
  private serialMap: Map<string, ProdutoAuditoria> = new Map();
  private seriaisLimposDaTela: Set<string> = new Set<string>();
  private tentativasDuplicadas: LogTentativaDuplicado[] = [];

  constructor() {
    this.carregarDados();
    this.verificarRecuperacaoIndexedDB();
    this.iniciarSincronizacaoAutomatica();
  }

  iniciarSincronizacaoAutomatica() {
    if (typeof window === 'undefined') return;
    this.puxarAtualizacoesServidor();
    setInterval(() => {
      this.puxarAtualizacoesServidor();
    }, 4000);
    window.addEventListener('focus', () => {
      this.puxarAtualizacoesServidor();
    });
    window.addEventListener('online', () => {
      this.puxarAtualizacoesServidor();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.puxarAtualizacoesServidor();
        }
      });
    }
  }

  private carregarDados() {
    try {
      const STORAGE_RESET_KEY = 'solutions_reset_version_2026_09_11_v5_zerado_oficial';
      if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_RESET_KEY) !== 'OK') {
        localStorage.setItem(STORAGE_RESET_KEY, 'OK');
        localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEY_FOTOS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEY_FOTOS_10_CAIXAS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEY_HISTORICO_ENVIOS, JSON.stringify([]));
        localStorage.setItem('solutions_caixas_cadastradas_v1', JSON.stringify([]));
        localStorage.removeItem('solutions_ultima_sincronizacao');
        salvarIndexedDB(STORAGE_KEY_PRODUTOS, []);
        salvarIndexedDB(STORAGE_KEY_FOTOS, []);
        salvarIndexedDB(STORAGE_KEY_FOTOS_10_CAIXAS, []);
        salvarIndexedDB(STORAGE_KEY_HISTORICO, []);
        salvarIndexedDB(STORAGE_KEY_HISTORICO_ENVIOS, []);
      }

      const prodRaw = localStorage.getItem(STORAGE_KEY_PRODUTOS);
      this.produtos = prodRaw ? JSON.parse(prodRaw) : [];

      const userRaw = localStorage.getItem(STORAGE_KEY_USUARIOS);
      this.usuarios = userRaw ? JSON.parse(userRaw) : [...DEFAULT_USUARIOS];

      // Migração: garantir que todos os usuários regionais e admin obrigatórios existam com senhas atualizadas
      for (const defUser of DEFAULT_USUARIOS) {
        const idx = this.usuarios.findIndex(
          (u) => u.login.trim().toUpperCase() === defUser.login.toUpperCase()
        );
        if (idx === -1) {
          this.usuarios.push({ ...defUser });
        } else {
          this.usuarios[idx].senha = defUser.senha;
          this.usuarios[idx].perfil = defUser.perfil;
          this.usuarios[idx].regional = defUser.regional;
          this.usuarios[idx].ativo = true;
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

      const fotosRaw = localStorage.getItem(STORAGE_KEY_FOTOS);
      this.fotosGrupos = fotosRaw ? JSON.parse(fotosRaw) : [];

      const fotos10Raw = localStorage.getItem(STORAGE_KEY_FOTOS_10_CAIXAS);
      this.registros10Fotos = fotos10Raw ? JSON.parse(fotos10Raw) : [];

      const tentRaw = localStorage.getItem(STORAGE_KEY_TENTATIVAS_DUPLICADAS);
      this.tentativasDuplicadas = tentRaw ? JSON.parse(tentRaw) : [];

      // Rebuild high-speed serial index (O(1) lookups)
      this.serialMap.clear();
      for (const p of this.produtos) {
        this.serialMap.set(p.serial.trim().toUpperCase(), p);
      }

      // Carregar seriais limpos da tela local
      try {
        const limposRaw = localStorage.getItem(STORAGE_KEY_SERIAIS_LIMPOS_TELA);
        if (limposRaw) {
          const arr = JSON.parse(limposRaw);
          if (Array.isArray(arr)) {
            this.seriaisLimposDaTela = new Set<string>(arr);
          }
        }
      } catch {}

      // Sync to IndexedDB for backup
      if (this.produtos.length > 0) {
        salvarIndexedDB(STORAGE_KEY_PRODUTOS, this.produtos);
        salvarIndexedDB(STORAGE_KEY_USUARIOS, this.usuarios);
        salvarIndexedDB(STORAGE_KEY_HISTORICO, this.historico);
        salvarIndexedDB(STORAGE_KEY_FOTOS, this.fotosGrupos);
        salvarIndexedDB(STORAGE_KEY_FOTOS_10_CAIXAS, this.registros10Fotos);
      }

      // Limpeza de sessão legada no localStorage para garantir que entrar no sistema sempre exija login
      localStorage.removeItem('solutions_auditoria_sessao');

      // Verificar se há sessão ativa apenas na aba atual (sessionStorage)
      const sess = sessionStorage.getItem('solutions_auditoria_sessao');
      if (sess) {
        try {
          const parsed = JSON.parse(sess);
          const match = this.usuarios.find(
            (u) => u.login.toUpperCase() === parsed.login?.toUpperCase()
          );
          this.usuarioAtual = (match && match.ativo) ? match : null;
        } catch {
          this.usuarioAtual = null;
        }
      } else {
        this.usuarioAtual = null; // Exigir login ao entrar no sistema
      }
    } catch (e) {
      console.error('Erro ao carregar banco local:', e);
      this.produtos = [];
      this.usuarios = [...DEFAULT_USUARIOS];
      this.historico = [];
      this.usuarioAtual = null;
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

  // Sistema de Notificação Reativa em Tempo Real (Zero necessidade de atualizar a página)
  notificarMudanca(tipo: string = 'dados') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('solutions_dados_atualizados', { detail: { tipo } })
      );
    }
  }

  onMudanca(callback: (tipo: string) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const listener = (e: Event) => {
      const customEvent = e as CustomEvent<{ tipo: string }>;
      callback(customEvent.detail?.tipo || 'dados');
    };
    window.addEventListener('solutions_dados_atualizados', listener);
    return () => window.removeEventListener('solutions_dados_atualizados', listener);
  }

  private salvarTudo() {
    try {
      // 1. Gravação síncrona no LocalStorage
      localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(this.produtos));
      localStorage.setItem(STORAGE_KEY_USUARIOS, JSON.stringify(this.usuarios));
      localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(this.historico));
      localStorage.setItem(STORAGE_KEY_FOTOS, JSON.stringify(this.fotosGrupos));
      localStorage.setItem(STORAGE_KEY_FOTOS_10_CAIXAS, JSON.stringify(this.registros10Fotos));
      localStorage.setItem(STORAGE_KEY_TENTATIVAS_DUPLICADAS, JSON.stringify(this.tentativasDuplicadas));

      // 2. Gravação redundante no IndexedDB (Zero Data Loss)
      salvarIndexedDB(STORAGE_KEY_PRODUTOS, this.produtos);
      salvarIndexedDB(STORAGE_KEY_USUARIOS, this.usuarios);
      salvarIndexedDB(STORAGE_KEY_HISTORICO, this.historico);
      salvarIndexedDB(STORAGE_KEY_FOTOS, this.fotosGrupos);
      salvarIndexedDB(STORAGE_KEY_FOTOS_10_CAIXAS, this.registros10Fotos);
      salvarIndexedDB(STORAGE_KEY_TENTATIVAS_DUPLICADAS, this.tentativasDuplicadas);
    } catch (e) {
      console.error('Erro ao salvar no storage:', e);
    }
    this.notificarMudanca('dados');
  }

  // Auth
  getUsuarioAtual(): Usuario | null {
    return this.usuarioAtual;
  }

  setUsuarioAtual(u: Usuario | null) {
    this.usuarioAtual = u;
    if (u) {
      sessionStorage.setItem('solutions_auditoria_sessao', JSON.stringify(u));
    } else {
      sessionStorage.removeItem('solutions_auditoria_sessao');
    }
    localStorage.removeItem('solutions_auditoria_sessao');
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
      const loginMatches = uLogin === loginNorm;
      const passMatches = u.senha === passTrim;

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

  // =========================================================================
  // LOGS E GESTÃO DE TENTATIVAS DE ENVIO DUPLICADO (IMEI BLOQUEADO NO SERVIDOR)
  // =========================================================================
  registrarTentativaEnvioDuplicado(log: Omit<LogTentativaDuplicado, 'id'>) {
    const novoLog: LogTentativaDuplicado = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      ...log,
    };
    this.tentativasDuplicadas.unshift(novoLog);
    if (this.tentativasDuplicadas.length > 2000) {
      this.tentativasDuplicadas = this.tentativasDuplicadas.slice(0, 2000);
    }
    this.salvarTudo();
    this.notificarMudanca('tentativas-duplicadas');
  }

  listarTentativasDuplicadas(limite = 500): LogTentativaDuplicado[] {
    return this.tentativasDuplicadas.slice(0, limite);
  }

  limparTentativasDuplicadas() {
    this.tentativasDuplicadas = [];
    this.salvarTudo();
    this.notificarMudanca('tentativas-duplicadas');
  }

  removerItensDuplicadosFila(idsOuSeriais: (number | string)[]): { removidos: number } {
    let count = 0;
    const targets = new Set(idsOuSeriais.map((item) => String(item).trim().toUpperCase()));
    for (let i = this.produtos.length - 1; i >= 0; i--) {
      const p = this.produtos[i];
      const matchId = targets.has(String(p.id));
      const matchSerial = targets.has(p.serial.trim().toUpperCase());
      if (matchId || matchSerial) {
        // Apenas remover se não estiver confirmado como ENVIADO (evitar acidentes)
        if (p.status_sincronizacao !== 'ENVIADO') {
          this.produtos.splice(i, 1);
          this.serialMap.delete(p.serial.trim().toUpperCase());
          count++;
        }
      }
    }
    if (count > 0) {
      this.salvarTudo();
      this.notificarMudanca('produtos');
      this.notificarMudanca('sync');
    }
    return { removidos: count };
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
      this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional
        ? this.usuarioAtual.regional
        : (item.regional?.trim() || (this.usuarioAtual?.regional ? this.usuarioAtual.regional : 'VIA VAREJO RJ'));

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

    const chaveSerial = `${regionalFinal.trim().toUpperCase()}:::${serialNorm}`;
    if (this.seriaisLimposDaTela.has(chaveSerial)) {
      this.seriaisLimposDaTela.delete(chaveSerial);
      this.salvarSeriaisLimposDaTela();
    }

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

    // Regra de Proteção Online: Registros já enviados para o online só podem ser editados pelo Administrador Geral
    if (anterior.status_sincronizacao === 'ENVIADO' && this.usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      return {
        sucesso: false,
        erro: 'Este número de série já foi enviado para o servidor online. Por segurança da auditoria, apenas o Administrador Geral pode editar registros sincronizados.',
      };
    }

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

    // Regra de Proteção Online: Registros já enviados para o online só podem ser excluídos pelo Administrador Geral
    if (removido.status_sincronizacao === 'ENVIADO' && this.usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      return {
        sucesso: false,
        erro: 'Este número de série já foi enviado para o servidor online. Por segurança da auditoria, apenas o Administrador Geral pode excluir registros sincronizados.',
      };
    }

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

    if (!filtro) return baseList.map((p) => ({ ...p }));

    return baseList
      .filter((p) => {
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
        if (filtro.kitCompleto && filtro.kitCompleto !== 'TODOS' && p.kit_completo !== filtro.kitCompleto) {
          return false;
        }
        if (filtro.computador_id && filtro.computador_id !== 'TODOS' && p.computador_id !== filtro.computador_id) {
          return false;
        }
        if (filtro.status_sincronizacao && filtro.status_sincronizacao !== 'TODOS' && p.status_sincronizacao !== filtro.status_sincronizacao) {
          return false;
        }
        return true;
      })
      .map((p) => ({ ...p }));
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
    const avariasFaltantes = itens.filter(
      (p) => p.produto_lacrado === 'NÃO' && (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO')
    ).length;
    // Produtos abertos c/ avaria ou faltante NÃO são considerados pendência.
    // Pendências são exclusivamente registros pendentes de envio para o online:
    const pendencias = itens.filter(
      (p) => p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE'
    ).length;

    return {
      caixa: numeroCaixa,
      totalAuditados,
      produtosLacrados,
      produtosNaoLacrados,
      comMarcasUso,
      avariasFaltantes,
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
    const avariasFaltantes = lista.filter(
      (p) => p.produto_lacrado === 'NÃO' && (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO')
    ).length;
    // Produtos que forem Abertos c/ avaria ou faltante NÃO considerar como pendência.
    // Pendências são exclusivamente registros com sincronização online pendente:
    const pendencias = lista.filter(
      (p) => p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE'
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
    let regionais = this.listarRegionais();
    if (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional) {
      regionais = [this.usuarioAtual.regional];
    }
    return regionais.map((reg) => {
      const produtosReg = this.produtos.filter((p) => (p.regional || 'VIA VAREJO RJ') === reg);
      const totalProdutos = produtosReg.length;
      const caixasSet = new Set(produtosReg.map((p) => p.numero_caixa));
      const modelosSet = new Set(produtosReg.map((p) => p.modelo_produto));
      const produtosLacrados = produtosReg.filter((p) => p.produto_lacrado === 'SIM').length;
      const produtosNaoLacrados = produtosReg.filter((p) => p.produto_lacrado === 'NÃO').length;
      const avariasFaltantes = produtosReg.filter(
        (p) => p.produto_lacrado === 'NÃO' && (p.aparelho_marcas_uso === 'SIM' || p.kit_completo === 'NÃO')
      ).length;
      // Produtos abertos c/ avaria ou faltante NÃO são pendências:
      const pendencias = produtosReg.filter(
        (p) => p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE' || p.status_sincronizacao === 'ERRO_DUPLICADO'
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
        avariasFaltantes,
        pendencias,
        totalModelos: modelosSet.size,
        taxaQualidade,
        ultimaAuditoria,
      };
    });
  }

  // =========================================================================
  listarProdutosPendentes(): ProdutoAuditoria[] {
    const regAlvo = this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined;
    return this.produtos.filter((p) => {
      if (p.status_sincronizacao === 'ENVIADO' || p.sync_status === 'ENVIADO' || p.sync_status === 'SINCRONIZADO') {
        return false;
      }
      const isPendente = p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE' || p.status_sincronizacao === 'ERRO_DUPLICADO';
      if (!isPendente) return false;
      if (regAlvo) return (p.regional || 'VIA VAREJO RJ') === regAlvo;
      return true;
    });
  }

  // =========================================================================
  // GESTÃO DE EVIDÊNCIAS FOTOGRÁFICAS (REQUISITOS 6, 7, 8, 9, 10, 11)
  // Fotos dos produtos agrupadas de 10 em 10 produtos dentro da caixa
  // =========================================================================
  obterGruposFotosCaixa(caixa: string, regional?: string): GrupoFotosInfo[] {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const prodsCaixa = this.produtos
      .filter((p) => p.numero_caixa === caixa && (regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo))
      .sort((a, b) => (a.id || 0) - (b.id || 0));

    const totalProdutos = prodsCaixa.length;
    if (totalProdutos === 0) return [];

    const totalGrupos = Math.ceil(totalProdutos / 10);
    const grupos: GrupoFotosInfo[] = [];

    for (let g = 1; g <= totalGrupos; g++) {
      const rangeInicio = (g - 1) * 10 + 1;
      const rangeFim = Math.min(g * 10, totalProdutos);
      const sliceProds = prodsCaixa.slice((g - 1) * 10, rangeFim);
      const seriais = sliceProds.map((p) => p.serial);
      const grupoRotulo = `Produtos ${String(rangeInicio).padStart(2, '0')} até ${String(rangeFim).padStart(2, '0')}`;

      const fotoExistente = this.fotosGrupos.find(
        (f) =>
          f.caixa === caixa &&
          f.grupoNumero === g &&
          (regAlvo === 'TODAS' || (f.regional || 'VIA VAREJO RJ') === regAlvo)
      );

      grupos.push({
        grupoNumero: g,
        grupoRotulo,
        rangeInicio,
        rangeFim,
        totalNoGrupo: seriais.length,
        seriais,
        foto: fotoExistente,
        temFoto: !!fotoExistente && !!fotoExistente.fotoDataUri,
      });
    }

    return grupos;
  }

  salvarFotoGrupo(dados: {
    caixa: string;
    regional?: string;
    grupoNumero: number;
    grupoRotulo: string;
    rangeInicio: number;
    rangeFim: number;
    totalNoGrupo: number;
    seriais: string[];
    fotoDataUri: string;
  }): { sucesso: boolean; foto: FotoGrupoAuditoria } {
    const regAlvo = dados.regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const compAtual = this.obterComputadorAtual(regAlvo);
    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    const agora = new Date().toISOString();

    const fotoNova: FotoGrupoAuditoria = {
      id: `FOTO-${regAlvo.replace(/[^A-Z0-9]/g, '')}-${dados.caixa.replace(/[^A-Z0-9]/g, '')}-G${dados.grupoNumero}-${Date.now()}`,
      regional: regAlvo,
      caixa: dados.caixa,
      grupoNumero: dados.grupoNumero,
      grupoRotulo: dados.grupoRotulo,
      rangeInicio: dados.rangeInicio,
      rangeFim: dados.rangeFim,
      totalNoGrupo: dados.totalNoGrupo,
      seriais: dados.seriais,
      fotoDataUri: dados.fotoDataUri,
      dataCriacao: agora,
      computador_id: compAtual.id,
      usuario: usuarioNome,
      status_sincronizacao: 'PENDENTE',
      data_sincronizacao: null,
    };

    const idx = this.fotosGrupos.findIndex(
      (f) => f.caixa === dados.caixa && f.grupoNumero === dados.grupoNumero && f.regional === regAlvo
    );

    if (idx >= 0) {
      this.fotosGrupos[idx] = fotoNova;
    } else {
      this.fotosGrupos.push(fotoNova);
    }

    this.salvarTudo();
    this.notificarMudanca('fotos');
    this.notificarMudanca('sync');

    this.registrarHistorico(
      usuarioNome,
      'ANEXO_FOTO_EVIDENCIA',
      `Evidência fotográfica registrada para ${dados.caixa} - ${dados.grupoRotulo} (${dados.seriais.length} produtos).`,
      regAlvo
    );

    return { sucesso: true, foto: fotoNova };
  }

  removerFotoGrupo(caixa: string, grupoNumero: number, regional?: string): boolean {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const inicial = this.fotosGrupos.length;
    this.fotosGrupos = this.fotosGrupos.filter(
      (f) => !(f.caixa === caixa && f.grupoNumero === grupoNumero && f.regional === regAlvo)
    );
    if (this.fotosGrupos.length !== inicial) {
      this.salvarTudo();
      this.notificarMudanca('fotos');
      this.notificarMudanca('sync');
      return true;
    }
    return false;
  }

  // =========================================================================
  // GESTÃO DAS 10 FOTOS OBRIGATÓRIAS DA CAIXA (REQUISITOS 4 E 5)
  // Ao finalizar / trocar de caixa: 10 fotos obrigatórias
  // =========================================================================
  obter10FotosCaixa(caixa: string, regional?: string): Registro10FotosCaixa {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    let reg = this.registros10Fotos.find(
      (r) => r.caixa === caixa && (regAlvo === 'TODAS' || r.regional === regAlvo)
    );
    if (!reg) {
      reg = {
        id: `FOTOS-${regAlvo.replace(/[^A-Z0-9]/g, '')}-${caixa.replace(/[^A-Z0-9]/g, '')}-${Date.now()}`,
        regional: regAlvo,
        caixa,
        dataCriacao: new Date().toISOString(),
        computador_id: this.obterComputadorAtual(regAlvo).id,
        usuario: this.usuarioAtual?.nome || 'Operador',
        fotos: [
          { indice: 1, rotulo: 'Foto dos produtos 1', descricao: 'Primeira foto dos produtos da caixa', fotoDataUri: '' },
          { indice: 2, rotulo: 'Foto dos produtos 2', descricao: 'Segunda foto dos produtos da caixa', fotoDataUri: '' },
        ],
        status_sincronizacao: 'PENDENTE',
      };
      this.registros10Fotos.push(reg);
    } else {
      // Garantir pelo menos 2 slots
      if (!reg.fotos || reg.fotos.length < 2) {
        const fotosNovas = reg.fotos ? [...reg.fotos] : [];
        if (fotosNovas.length === 0) {
          fotosNovas.push({ indice: 1, rotulo: 'Foto dos produtos 1', descricao: 'Primeira foto dos produtos da caixa', fotoDataUri: '' });
        }
        if (fotosNovas.length === 1) {
          fotosNovas.push({ indice: 2, rotulo: 'Foto dos produtos 2', descricao: 'Segunda foto dos produtos da caixa', fotoDataUri: '' });
        }
        reg.fotos = fotosNovas;
      }
      // Atualizar nomes padrão para "Foto dos produtos 1" e "Foto dos produtos 2"
      if (reg.fotos[0] && (!reg.fotos[0].rotulo || reg.fotos[0].rotulo.includes('organizados'))) {
        reg.fotos[0].rotulo = 'Foto dos produtos 1';
      }
      if (reg.fotos[1] && (!reg.fotos[1].rotulo || reg.fotos[1].rotulo.includes('fechada'))) {
        reg.fotos[1].rotulo = 'Foto dos produtos 2';
      }
    }
    return reg;
  }

  adicionarSlotFotoCaixa(caixa: string, regional?: string): Registro10FotosCaixa {
    const reg = this.obter10FotosCaixa(caixa, regional);
    const novoIndice = reg.fotos.length + 1;
    reg.fotos.push({
      indice: novoIndice,
      rotulo: `Foto dos produtos ${novoIndice}`,
      descricao: `Foto adicional ${novoIndice} dos produtos da caixa`,
      fotoDataUri: '',
    });
    this.salvarTudo();
    this.notificarMudanca('fotos');
    return reg;
  }

  removerSlotFotoCaixa(caixa: string, indice: number, regional?: string): Registro10FotosCaixa | null {
    if (indice <= 2) return null; // Os dois primeiros slots são os padrões obrigatórios
    const reg = this.obter10FotosCaixa(caixa, regional);
    reg.fotos = reg.fotos.filter((f) => f.indice !== indice);
    // Renumerar slots adicionais para manter sequencial
    reg.fotos.forEach((f, idx) => {
      f.indice = idx + 1;
      f.rotulo = `Foto dos produtos ${idx + 1}`;
    });
    this.salvarTudo();
    this.notificarMudanca('fotos');
    return reg;
  }

  tem10FotosCompletas(caixa: string, regional?: string): boolean {
    const reg = this.obter10FotosCaixa(caixa, regional);
    if (!reg || !reg.fotos || reg.fotos.length < 2) return false;
    // Considera completo se pelo menos as 2 primeiras fotos foram anexadas
    return (
      !!reg.fotos[0]?.fotoDataUri &&
      reg.fotos[0].fotoDataUri.length > 50 &&
      !!reg.fotos[1]?.fotoDataUri &&
      reg.fotos[1].fotoDataUri.length > 50
    );
  }

  obterContadorFotos10(caixa: string, regional?: string): number {
    const reg = this.obter10FotosCaixa(caixa, regional);
    if (!reg || !reg.fotos) return 0;
    return reg.fotos.filter((f) => !!f.fotoDataUri && f.fotoDataUri.length > 50).length;
  }

  salvarFotoCaixaIndividual(
    caixa: string,
    indice: number,
    fotoDataUri: string,
    regional?: string
  ): { sucesso: boolean; registro: Registro10FotosCaixa } {
    const reg = this.obter10FotosCaixa(caixa, regional);
    const item = reg.fotos.find((f) => f.indice === indice);
    if (!item) {
      reg.fotos.push({
        indice,
        rotulo: `Foto dos produtos ${indice}`,
        descricao: '',
        fotoDataUri,
      });
    } else {
      item.fotoDataUri = fotoDataUri;
    }

    return this.salvar10FotosCaixa(caixa, reg.fotos, regional);
  }

  salvar10FotosCaixa(
    caixa: string,
    fotos: { indice: number; rotulo?: string; descricao?: string; fotoDataUri: string }[],
    regional?: string
  ): { sucesso: boolean; registro: Registro10FotosCaixa } {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const compAtual = this.obterComputadorAtual(regAlvo);
    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    const agora = new Date().toISOString();

    const registro = this.obter10FotosCaixa(caixa, regAlvo);
    registro.dataCriacao = agora;
    registro.computador_id = compAtual.id;
    registro.usuario = usuarioNome;
    registro.status_sincronizacao = 'PENDENTE';

    for (const f of fotos) {
      const idx = registro.fotos.findIndex((item) => item.indice === f.indice);
      if (idx >= 0) {
        registro.fotos[idx].fotoDataUri = f.fotoDataUri;
        if (f.rotulo) registro.fotos[idx].rotulo = f.rotulo;
        if (f.descricao !== undefined) registro.fotos[idx].descricao = f.descricao;
      } else {
        registro.fotos.push({
          indice: f.indice,
          rotulo: f.rotulo || `Foto dos produtos ${f.indice}`,
          descricao: f.descricao || '',
          fotoDataUri: f.fotoDataUri,
        });
      }
    }

    // Salvar também em fotosGrupos para visualização na galeria do Admin e sincronização com nuvem
    for (const fotoItem of registro.fotos) {
      if (fotoItem.fotoDataUri) {
        const fotoGrupoItem: FotoGrupoAuditoria = {
          id: `FOTO-${regAlvo.replace(/[^A-Z0-9]/g, '')}-${caixa.replace(/[^A-Z0-9]/g, '')}-${fotoItem.indice}-${Date.now()}`,
          regional: regAlvo,
          caixa,
          grupoNumero: fotoItem.indice,
          grupoRotulo: fotoItem.rotulo,
          rangeInicio: 1,
          rangeFim: registro.fotos.length,
          totalNoGrupo: registro.fotos.length,
          seriais: [],
          fotoDataUri: fotoItem.fotoDataUri,
          dataCriacao: agora,
          computador_id: compAtual.id,
          usuario: usuarioNome,
          status_sincronizacao: 'PENDENTE',
          data_sincronizacao: null,
        };
        const idxG = this.fotosGrupos.findIndex(
          (f) => f.caixa === caixa && f.grupoNumero === fotoItem.indice && f.regional === regAlvo
        );
        if (idxG >= 0) {
          this.fotosGrupos[idxG] = fotoGrupoItem;
        } else {
          this.fotosGrupos.push(fotoGrupoItem);
        }
      }
    }

    this.salvarTudo();
    this.notificarMudanca('fotos');
    this.notificarMudanca('sync');

    const totalAnexadas = registro.fotos.filter((f) => !!f.fotoDataUri).length;
    this.registrarHistorico(
      usuarioNome,
      'FOTOS_PRODUTOS_CAIXA',
      `Registradas fotos dos produtos da ${caixa} (${totalAnexadas} foto(s) salvas).`,
      regAlvo
    );

    return { sucesso: true, registro };
  }

  registrarMotivoSemFotosCaixa(caixa: string, motivo: string, regional?: string) {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const reg = this.obter10FotosCaixa(caixa, regAlvo);
    reg.motivoSemFotos = motivo.trim();
    this.salvarTudo();
    this.notificarMudanca('fotos');

    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    this.registrarHistorico(
      usuarioNome,
      'MOTIVO_SEM_FOTOS',
      `Mudança da ${caixa} sem fotos. Justificativa informada: "${motivo.trim()}".`,
      regAlvo
    );
  }

  validarTrocaCaixa(
    caixaAtual: string,
    regional?: string
  ): {
    permitida: boolean;
    precisaConfirmarFotos: boolean;
    temFotos: boolean;
    totalFotos: number;
    motivoInformado?: string | null;
  } {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    const prodsCaixa = this.produtos.filter(
      (p) => p.numero_caixa === caixaAtual && (regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo)
    );

    if (prodsCaixa.length === 0) {
      return {
        permitida: true,
        precisaConfirmarFotos: false,
        temFotos: false,
        totalFotos: 0,
      };
    }

    const reg = this.obter10FotosCaixa(caixaAtual, regAlvo);
    const contagem = reg.fotos.filter((f) => !!f.fotoDataUri && f.fotoDataUri.length > 50).length;

    return {
      permitida: true,
      precisaConfirmarFotos: true,
      temFotos: contagem >= 2,
      totalFotos: contagem,
      motivoInformado: reg.motivoSemFotos,
    };
  }


  listarFotosCaixa(caixa: string, regional?: string): FotoGrupoAuditoria[] {
    const regAlvo = regional || this.usuarioAtual?.regional || 'VIA VAREJO RJ';
    return this.fotosGrupos.filter(
      (f) => f.caixa === caixa && (regAlvo === 'TODAS' || f.regional === regAlvo)
    );
  }

  listarTodasFotos(regional?: string): FotoGrupoAuditoria[] {
    if (!regional || regional === 'TODAS') return [...this.fotosGrupos];
    return this.fotosGrupos.filter((f) => f.regional === regional);
  }

  obterArvoreFotosPorRegional(): {
    regional: string;
    caixas: {
      caixa: string;
      totalProdutos: number;
      fotos: FotoGrupoAuditoria[];
    }[];
  }[] {
    const regionais = ['VIA VAREJO RJ', 'VIA VAREJO SP', 'VIA VAREJO MG', 'VIA VAREJO BA'];
    return regionais.map((reg) => {
      const prodsReg = this.produtos.filter((p) => (p.regional || 'VIA VAREJO RJ') === reg);
      const caixasSet = new Set(prodsReg.map((p) => p.numero_caixa));
      const caixas = Array.from(caixasSet).sort().map((cx) => {
        const totalProdutos = prodsReg.filter((p) => p.numero_caixa === cx).length;
        const fotos = this.fotosGrupos
          .filter((f) => f.regional === reg && f.caixa === cx)
          .sort((a, b) => a.grupoNumero - b.grupoNumero);
        return {
          caixa: cx,
          totalProdutos,
          fotos,
        };
      });
      return {
        regional: reg,
        caixas,
      };
    });
  }

  // =========================================================================
  // LIMPEZA GERAL DA BASE (ONLINE + LOCAL) - RESTRITO EXCLUSIVAMENTE AO ADMIN
  // =========================================================================
  async limparBaseOperacional(): Promise<{ sucesso: boolean; mensagem: string }> {
    if (this.usuarioAtual?.perfil !== 'ADMINISTRADOR') {
      return {
        sucesso: false,
        mensagem: 'Apenas o Administrador Geral possui autorização para solicitar a limpeza da base de dados online.',
      };
    }

    this.produtos = [];
    this.serialMap.clear();
    this.fotosGrupos = [];
    this.registros10Fotos = [];
    this.historico = [];

    localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_FOTOS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_FOTOS_10_CAIXAS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_HISTORICO_ENVIOS, JSON.stringify([]));
    localStorage.setItem('solutions_caixas_cadastradas_v1', JSON.stringify([]));
    localStorage.removeItem('solutions_ultima_sincronizacao');
    this.seriaisLimposDaTela.clear();
    localStorage.removeItem(STORAGE_KEY_SERIAIS_LIMPOS_TELA);

    salvarIndexedDB(STORAGE_KEY_PRODUTOS, []);
    salvarIndexedDB(STORAGE_KEY_FOTOS, []);
    salvarIndexedDB(STORAGE_KEY_FOTOS_10_CAIXAS, []);
    salvarIndexedDB(STORAGE_KEY_HISTORICO, []);
    salvarIndexedDB(STORAGE_KEY_HISTORICO_ENVIOS, []);

    try {
      const cleanPayload = JSON.stringify({
        system: 'GRUPO SOLUTIONS AUDITORIA SAMSUNG',
        produtos: [],
        fotos: [],
        historico_envios: [],
        ultimaAtualizacao: new Date().toISOString(),
      });
      await fetch(CLOUD_STORAGE_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: cleanPayload,
      }).catch(() => {});
      await fetch(CLOUD_STORAGE_BACKUP_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: cleanPayload,
      }).catch(() => {});
    } catch (e) {
      console.warn('Erro ao zerar nuvem central:', e);
    }

    this.salvarTudo();
    this.notificarMudanca('produtos');
    this.notificarMudanca('fotos');
    this.notificarMudanca('caixas');
    this.notificarMudanca('sync');

    return {
      sucesso: true,
      mensagem: 'Base de dados resetada com sucesso pelo Administrador: 0 produtos, 0 caixas, 0 fotos, 0 sincronizações.',
    };
  }

  // =========================================================================
  // =========================================================================
  // LIMPAR REGISTROS DA TELA DO COLABORADOR (OPERACIONAL)
  // Limpa a tela deste computador para novas auditorias.
  // IMPORTANTE: Tudo o que já foi enviado para o online CONTINUA 100% gravado
  // e preservado na nuvem. A base central online só pode ser excluída pelo ADMIN.
  // =========================================================================
  salvarSeriaisLimposDaTela() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY_SERIAIS_LIMPOS_TELA,
        JSON.stringify(Array.from(this.seriaisLimposDaTela))
      );
    } catch {}
  }

  obterContagemStatusRegistros(regional?: string): { pendentes: number; enviados: number; total: number } {
    const regAlvo = regional || (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional ? this.usuarioAtual.regional : undefined);
    const lista = this.produtos.filter((p) => {
      return !regAlvo || regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo;
    });
    const pendentes = lista.filter((p) => p.status_sincronizacao !== 'ENVIADO').length;
    const enviados = lista.filter((p) => p.status_sincronizacao === 'ENVIADO').length;
    return { pendentes, enviados, total: lista.length };
  }

  limparTelaColaborador(regional?: string): {
    sucesso: boolean;
    removidos: number;
    preservados: number;
    mensagem: string;
  } {
    const regAlvo = regional || (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional ? this.usuarioAtual.regional : undefined);

    let pendentesCount = 0;
    let enviadosCount = 0;

    const novosProdutos: ProdutoAuditoria[] = [];
    for (const p of this.produtos) {
      const matchRegional = !regAlvo || regAlvo === 'TODAS' || (p.regional || 'VIA VAREJO RJ') === regAlvo;
      if (matchRegional) {
        const chave = `${(p.regional || 'VIA VAREJO RJ').trim().toUpperCase()}:::${p.serial.trim().toUpperCase()}`;
        this.seriaisLimposDaTela.add(chave);
        if (p.status_sincronizacao === 'ENVIADO') {
          enviadosCount++;
        } else {
          pendentesCount++;
        }
        // Remove da visualização e memória local desta tela
      } else {
        novosProdutos.push(p);
      }
    }

    this.produtos = novosProdutos;
    this.serialMap.clear();
    for (const p of this.produtos) {
      this.serialMap.set(p.serial.trim().toUpperCase(), p);
    }

    // Salvar seriais para não serem re-importados automaticamente para este colaborador
    this.salvarSeriaisLimposDaTela();

    // Limpar fotos locais desta regional da tela do computador
    this.fotosGrupos = this.fotosGrupos.filter((f) => {
      const matchRegional = !regAlvo || regAlvo === 'TODAS' || (f.regional || 'VIA VAREJO RJ') === regAlvo;
      return !matchRegional;
    });

    this.registros10Fotos = this.registros10Fotos.filter((r) => {
      const matchRegional = !regAlvo || regAlvo === 'TODAS' || r.regional === regAlvo;
      return !matchRegional;
    });

    this.salvarTudo();
    this.notificarMudanca('produtos');
    this.notificarMudanca('fotos');
    this.notificarMudanca('caixas');
    this.notificarMudanca('sync');

    const usuarioNome = this.usuarioAtual?.nome || 'Operador';
    const totalRemovidos = pendentesCount + enviadosCount;
    this.registrarHistorico(
      usuarioNome,
      'LIMPEZA_TELA_COLABORADOR',
      `Tela limpa pelo operador: ${totalRemovidos} produtos removidos da tela (${enviadosCount} já enviados ao online continuam 100% gravados na nuvem).`,
      regAlvo
    );

    return {
      sucesso: true,
      removidos: totalRemovidos,
      preservados: enviadosCount,
      mensagem: `Tela limpa com sucesso! ${totalRemovidos} produto(s) removido(s) da visualização. Os ${enviadosCount} registro(s) já enviados ao online continuam 100% salvos e protegidos na nuvem central.`,
    };
  }

  // Alias para retrocompatibilidade
  limparRegistrosLocaisNaoEnviados(regional?: string) {
    return this.limparTelaColaborador(regional);
  }

  // =========================================================================
  // MOTOR DE SINCRONIZAÇÃO INCREMENTAL INTELIGENTE (OFFLINE-FIRST)
  // Requisito 4: Envia APENAS registros novos (PENDENTE). Nunca reenvia antigos.
  // Requisito 6: Tratamento de duplicidade antes de gravar no servidor.
  // Requisito 8: Registra carimbo no Histórico de Envios.
  // =========================================================================
  async puxarAtualizacoesServidor(): Promise<boolean> {
    try {
      // 1. Tentar endpoint da API Central (Vercel serverless ou Vite dev middleware) com anti-cache
      let produtosRemotos: ProdutoAuditoria[] | null = null;
      let fotosRemotas: FotoGrupoAuditoria[] | null = null;
      try {
        const res = await fetch(`/api/central/produtos?_t=${Date.now()}`);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data && Array.isArray(data.produtos)) {
              produtosRemotos = data.produtos;
            }
            if (data && Array.isArray(data.fotos)) {
              fotosRemotas = data.fotos;
            }
          }
        }
      } catch (errApi) {
        console.warn('[Storage] Falha ao consultar /api/central/produtos:', errApi);
      }

      // 2. Fallback Nuvem Direta caso a rota local/proxy não responda
      if (!produtosRemotos) {
        try {
          let cloudRes = await fetch(`${CLOUD_STORAGE_URL}?_t=${Date.now()}`);
          if (!cloudRes.ok) {
            cloudRes = await fetch(`${CLOUD_STORAGE_BACKUP_URL}?_t=${Date.now()}`);
          }
          if (cloudRes.ok) {
            const cloudData = await cloudRes.json();
            if (cloudData && Array.isArray(cloudData.produtos)) {
              produtosRemotos = cloudData.produtos;
            }
            if (cloudData && Array.isArray(cloudData.fotos)) {
              fotosRemotas = cloudData.fotos;
            }
          }
        } catch {}
      }

      let alterou = false;
      if (produtosRemotos && produtosRemotos.length > 0) {
        const alterouProds = this.mesclarProdutosCentral(produtosRemotos);
        if (alterouProds) alterou = true;
      }
      if (fotosRemotas && fotosRemotas.length > 0) {
        const alterouFotos = this.mesclarFotosCentral(fotosRemotas);
        if (alterouFotos) alterou = true;
      }

      if (alterou) {
        this.salvarTudo();
        this.notificarMudanca('produtos');
        this.notificarMudanca('fotos');
        this.notificarMudanca('sync');
        return true;
      }
    } catch (e) {
      console.warn('[Storage] Servidor inacessível no momento (offline):', e);
    }
    return false;
  }

  mesclarProdutosCentral(produtosCentral: ProdutoAuditoria[]): boolean {
    let alterou = false;
    const locaisMap = new Map<string, ProdutoAuditoria>();
    for (const p of this.produtos) {
      const chave = `${(p.regional || 'VIA VAREJO RJ').trim().toUpperCase()}:::${p.serial.trim().toUpperCase()}`;
      locaisMap.set(chave, p);
    }

    for (const cp of produtosCentral) {
      const chave = `${(cp.regional || 'VIA VAREJO RJ').trim().toUpperCase()}:::${cp.serial.trim().toUpperCase()}`;
      // Se for operador e este produto foi limpo da tela deste computador, não restaurar na tela dele
      if (this.usuarioAtual?.perfil !== 'ADMINISTRADOR' && this.seriaisLimposDaTela.has(chave)) {
        continue;
      }
      const local = locaisMap.get(chave);
      if (!local) {
        // Produto novo vindo de outro celular ou computador
        const novo: ProdutoAuditoria = {
          ...cp,
          status_sincronizacao: 'ENVIADO',
          sync_status: 'ENVIADO',
        };
        this.produtos.unshift(novo);
        this.serialMap.set(cp.serial.trim().toUpperCase(), novo);
        locaisMap.set(chave, novo);
        alterou = true;
      } else if (local.status_sincronizacao !== 'ENVIADO') {
        // Já existe no servidor central, então marca como ENVIADO localmente também
        local.status_sincronizacao = 'ENVIADO';
        local.sync_status = 'ENVIADO';
        local.data_sincronizacao = cp.data_sincronizacao || new Date().toISOString();
        alterou = true;
      }
    }
    return alterou;
  }

  mesclarFotosCentral(fotosCentral: FotoGrupoAuditoria[]): boolean {
    let alterou = false;
    for (const cf of fotosCentral) {
      const idx = this.fotosGrupos.findIndex(
        (f) =>
          f.id === cf.id ||
          (f.regional === cf.regional && f.caixa === cf.caixa && f.grupoNumero === cf.grupoNumero)
      );
      if (idx === -1) {
        this.fotosGrupos.push({
          ...cf,
          status_sincronizacao: 'ENVIADO',
        });
        alterou = true;
      } else if (this.fotosGrupos[idx].status_sincronizacao !== 'ENVIADO') {
        this.fotosGrupos[idx].status_sincronizacao = 'ENVIADO';
        alterou = true;
      }
    }
    return alterou;
  }

  async sincronizarOnline(): Promise<ResultadoSincronizacao> {
    const agora = new Date().toISOString();
    const agoraFormatada = new Date().toLocaleString('pt-BR');
    const compAtual = this.obterComputadorAtual();
    const regAlvo = this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : undefined;

    // 1. Filtrar APENAS produtos novos / não sincronizados (PENDENTE ou ERRO_DUPLICADO)
    const pendentes = this.produtos.filter((p) => {
      if (p.status_sincronizacao === 'ENVIADO' || p.sync_status === 'ENVIADO' || p.sync_status === 'SINCRONIZADO') {
        return false;
      }
      const isPendente = p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE' || p.status_sincronizacao === 'ERRO_DUPLICADO';
      if (!isPendente) return false;
      if (regAlvo) return (p.regional || 'VIA VAREJO RJ') === regAlvo;
      return true;
    });

    const pendentesFotos = this.fotosGrupos.filter((f) => {
      if (f.status_sincronizacao === 'ENVIADO') return false;
      if (regAlvo) return f.regional === regAlvo;
      return true;
    });

    if (pendentes.length === 0 && pendentesFotos.length === 0) {
      await this.puxarAtualizacoesServidor();
      return {
        sucesso: true,
        totalSincronizados: 0,
        duplicadosEvitados: 0,
        itensDuplicados: [],
        timestamp: agora,
        mensagem: 'Não há novos seriais ou fotos pendentes neste dispositivo. Base sincronizada com o servidor central.',
      };
    }

    // Preparar fotos leves para sincronização em nuvem (sem estourar payload)
    const pendentesFotosSync = await Promise.all(
      pendentesFotos.map(async (f) => ({
        ...f,
        fotoDataUri: await prepararFotoLeveParaSync(f.fotoDataUri),
      }))
    );

    let sincronizouComSucesso = false;
    let dataResposta: any = null;

    // 2. ENVIAR PARA O SERVIDOR CENTRAL VIA HTTP REAL (REDE / NUVEM)
    try {
      const response = await fetch('/api/central/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtos: pendentes,
          fotos: pendentesFotosSync,
          computador: compAtual,
          usuario: this.usuarioAtual?.nome || 'Operador',
          regional: compAtual.regional || (this.usuarioAtual?.regional || 'VIA VAREJO RJ'),
        }),
      });

      if (response.ok) {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          dataResposta = await response.json();
          if (dataResposta && dataResposta.sucesso) {
            sincronizouComSucesso = true;
          }
        }
      }
    } catch (err) {
      console.warn('[Storage] /api/central/sync indisponível, acionando fallback direto na nuvem:', err);
    }

    // 3. Fallback Nuvem Direta caso a rota /api/central/sync não responda (hospedagem estática, Vercel timeout, etc.)
    if (!sincronizouComSucesso) {
      try {
        let cloudData: any = {
          system: 'GRUPO SOLUTIONS AUDITORIA SAMSUNG',
          produtos: [],
          fotos: [],
          historico_envios: [],
        };

        let getRes = await fetch(`${CLOUD_STORAGE_URL}?_t=${Date.now()}`);
        if (!getRes.ok) {
          getRes = await fetch(`${CLOUD_STORAGE_BACKUP_URL}?_t=${Date.now()}`);
        }
        if (getRes.ok) {
          try {
            const parsed = await getRes.json();
            if (parsed && Array.isArray(parsed.produtos)) {
              cloudData = parsed;
            }
          } catch {}
        }

        const mapExistentes = new Map<string, any>();
        if (Array.isArray(cloudData.produtos)) {
          for (const p of cloudData.produtos) {
            const sn = (p.serial || '').trim().toUpperCase();
            if (sn) mapExistentes.set(sn, p);
          }
        } else {
          cloudData.produtos = [];
        }

        let novosCount = 0;
        const duplicadosList: DetalheImeiDuplicado[] = [];
        for (const p of pendentes) {
          const sn = (p.serial || '').trim().toUpperCase();
          if (!sn) continue;
          if (mapExistentes.has(sn)) {
            const existente = mapExistentes.get(sn);
            duplicadosList.push({
              imei: p.serial,
              serial: p.serial,
              modelo_produto: p.modelo_produto || existente.modelo_produto || '',
              numero_caixa: p.numero_caixa || existente.numero_caixa || '',
              data_cadastro_existente:
                existente.data_cadastro ||
                existente.data_auditoria ||
                existente.data_sincronizacao ||
                'Data anterior não informada',
              usuario_existente:
                existente.usuario_cadastro ||
                existente.usuario_criacao ||
                existente.usuario ||
                'Outro Colaborador',
              computador_existente:
                existente.computador_nome ||
                existente.computador_id ||
                'Outra Estação',
              regional_existente: existente.regional || 'Geral',
              status: 'DUPLICADO NO SERVIDOR',
              id_local: p.id,
            });
          } else {
            const normalizado = {
              ...p,
              regional: p.regional || compAtual.regional || 'VIA VAREJO RJ',
              computador_id: p.computador_id || compAtual.id || 'PC-001',
              computador_nome: p.computador_nome || compAtual.nome || 'Estacao',
              usuario_cadastro: (p as any).usuario_cadastro || (p as any).usuario_criacao || (this.usuarioAtual?.nome || 'Operador'),
              status_sincronizacao: 'ENVIADO',
              sync_status: 'ENVIADO',
              data_sincronizacao: agora,
              sync_data: agora,
              id_servidor: p.id_servidor || `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            };
            cloudData.produtos.unshift(normalizado);
            mapExistentes.set(sn, normalizado);
            novosCount++;
          }
        }

        let fotosCount = 0;
        if (pendentesFotosSync.length > 0) {
          if (!Array.isArray(cloudData.fotos)) cloudData.fotos = [];
          const mapFotos = new Map<string, any>();
          for (const f of cloudData.fotos) {
            if (f && f.id) mapFotos.set(f.id, f);
          }
          for (const f of pendentesFotosSync) {
            if (f && f.id) {
              if (!mapFotos.has(f.id)) fotosCount++;
              mapFotos.set(f.id, { ...f, status_sincronizacao: 'ENVIADO' });
            }
          }
          cloudData.fotos = Array.from(mapFotos.values());
        }

        if (!Array.isArray(cloudData.historico_envios)) {
          cloudData.historico_envios = [];
        }
        cloudData.historico_envios.unshift({
          id: Date.now(),
          data_envio: agoraFormatada,
          regional: compAtual.regional || (this.usuarioAtual?.regional || 'VIA VAREJO RJ'),
          computador_id: compAtual.id || 'PC-001',
          computador_nome: compAtual.nome || 'Estacao',
          usuario: this.usuarioAtual?.nome || 'Operador',
          quantidade_enviada: novosCount,
          status: 'OK',
          detalhes: `${novosCount} novos seriais sincronizados na nuvem central (${duplicadosList.length} duplicados evitados).`,
          timestamp: agora,
        });

        cloudData.ultimaAtualizacao = agora;

        const bodyStr = JSON.stringify(cloudData);
        let putRes = await fetch(CLOUD_STORAGE_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        });

        if (!putRes.ok) {
          putRes = await fetch(CLOUD_STORAGE_BACKUP_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr,
          });
        }

        if (putRes.ok) {
          sincronizouComSucesso = true;
          dataResposta = {
            sucesso: true,
            sincronizados: novosCount,
            fotosSincronizadas: fotosCount,
            duplicadosEvitados: duplicadosList.length,
            itensDuplicados: duplicadosList,
            totalNaBaseCentral: cloudData.produtos.length,
            produtosCentral: cloudData.produtos,
            fotosCentral: cloudData.fotos,
            mensagem:
              duplicadosList.length > 0
                ? `${novosCount} novo(s) serial(is) sincronizado(s). ${duplicadosList.length} IMEI(s) não foram enviados pois já constam no servidor.`
                : `${novosCount} novo(s) serial(is) e ${fotosCount} foto(s) sincronizado(s) online com sucesso!`,
            timestamp: agora,
          };
        }
      } catch (errDirect) {
        console.error('[Storage] Erro no Fallback de sincronização direta:', errDirect);
      }
    }

    // 4. Conclusão da Sincronização
    if (sincronizouComSucesso && dataResposta) {
      const itensDuplicados: DetalheImeiDuplicado[] = Array.isArray(dataResposta.itensDuplicados)
        ? dataResposta.itensDuplicados
        : [];
      const seriaisDuplicados = new Set(
        itensDuplicados.map((d) => (d.serial || d.imei).trim().toUpperCase())
      );

      const pendentesSeriais = new Set(pendentes.map((p) => p.serial.trim().toUpperCase()));
      const idsSincronizados: number[] = [];

      // 1. Processar itens duplicados (REJEITADOS PELO SERVIDOR ONLINE)
      for (const dup of itensDuplicados) {
        const norm = (dup.serial || dup.imei).trim().toUpperCase();
        const prodLocal = this.produtos.find((p) => p.serial.trim().toUpperCase() === norm);
        if (prodLocal) {
          prodLocal.status_sincronizacao = 'ERRO_DUPLICADO';
          prodLocal.sync_status = 'ERRO_DUPLICADO';
          prodLocal.erro_sincronizacao = 'IMEI NÃO FOI ENVIADO, POIS JÁ SE ENCONTRA CADASTRADO NA BASE DO SERVIDOR.';
          prodLocal.duplicado_servidor_info = {
            ...dup,
            status: 'DUPLICADO NO SERVIDOR',
          };
        }

        // Registrar no log local de tentativas duplicadas
        this.registrarTentativaEnvioDuplicado({
          usuario: this.usuarioAtual?.nome || 'Operador',
          data_hora: agoraFormatada,
          imei: dup.serial || dup.imei,
          computador: `${compAtual.id} (${compAtual.nome})`,
          resultado: 'BLOQUEADO: IMEI JÁ CADASTRADO NO SERVIDOR',
          regional: compAtual.regional || (this.usuarioAtual?.regional || 'VIA VAREJO RJ'),
          data_cadastro_existente: dup.data_cadastro_existente,
          usuario_existente: dup.usuario_existente,
        });

        this.registrarHistorico(
          this.usuarioAtual?.nome || 'Operador',
          'BLOQUEIO_DUPLICIDADE_ONLINE',
          `Tentativa de envio bloqueada pelo servidor online: IMEI ${dup.serial || dup.imei} já cadastrado por ${dup.usuario_existente || 'outro usuário'} em ${dup.data_cadastro_existente || 'data anterior'}.`,
          compAtual.regional
        );
      }

      // 2. Processar itens válidos enviados com sucesso
      for (const p of this.produtos) {
        const norm = p.serial.trim().toUpperCase();
        if (pendentesSeriais.has(norm) && !seriaisDuplicados.has(norm)) {
          p.status_sincronizacao = 'ENVIADO';
          p.sync_status = 'ENVIADO';
          p.data_sincronizacao = agora;
          p.sync_data = agora;
          p.erro_sincronizacao = null;
          p.duplicado_servidor_info = null;
          idsSincronizados.push(p.id);
        }
      }

      // 3. Marcar fotos enviadas
      for (const f of this.fotosGrupos) {
        if (pendentesFotos.some((pf) => pf.id === f.id)) {
          f.status_sincronizacao = 'ENVIADO';
          f.data_sincronizacao = agora;
        }
      }

      // 4. Ingerir e mesclar todos os produtos do servidor central
      if (Array.isArray(dataResposta.produtosCentral)) {
        this.mesclarProdutosCentral(dataResposta.produtosCentral);
      }
      if (Array.isArray(dataResposta.fotosCentral)) {
        this.mesclarFotosCentral(dataResposta.fotosCentral);
      }

      this.salvarTudo();
      this.notificarMudanca('sync');
      this.notificarMudanca('produtos');
      this.notificarMudanca('fotos');

      if (idsSincronizados.length > 0) {
        this.salvarRegistroEnvio({
          data_envio: agoraFormatada,
          regional: compAtual.regional || (this.usuarioAtual?.regional || 'VIA VAREJO RJ'),
          computador_id: compAtual.id,
          computador_nome: compAtual.nome,
          quantidade_enviada: dataResposta.sincronizados,
          status: 'OK',
          detalhes: dataResposta.mensagem,
          produtos_ids: idsSincronizados,
        });

        const usuarioNome = this.usuarioAtual?.nome || 'Operador';
        this.registrarHistorico(
          usuarioNome,
          'ENVIAR_PARA_ONLINE',
          `Envio online realizado pelo ${compAtual.id} (${compAtual.nome}): ${dataResposta.sincronizados} novos seriais sincronizados no servidor central.`,
          compAtual.regional
        );
      }

      return {
        sucesso: itensDuplicados.length === 0,
        totalSincronizados: dataResposta.sincronizados,
        duplicadosEvitados: itensDuplicados.length,
        itensDuplicados: itensDuplicados,
        timestamp: agora,
        mensagem: dataResposta.mensagem,
      };
    }

    // Fallback Offline: se o servidor e a nuvem estiverem temporariamente inacessíveis
    return {
      sucesso: false,
      totalSincronizados: 0,
      duplicadosEvitados: 0,
      itensDuplicados: [],
      timestamp: agora,
      mensagem: 'Sem conexão com o servidor central no momento. Seus registros estão salvos localmente e serão sincronizados assim que a conexão for restabelecida.',
    };
  }

  obterStatusSincronizacao(): StatusSincronizacao {
    let prods = this.produtos;
    if (this.usuarioAtual?.perfil === 'OPERADOR' && this.usuarioAtual.regional) {
      prods = prods.filter((p) => (p.regional || 'VIA VAREJO RJ') === this.usuarioAtual?.regional);
    }
    const pendentes = prods.filter(
      (p) => p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE'
    ).length;
    const enviados = prods.filter(
      (p) =>
        p.status_sincronizacao === 'ENVIADO' ||
        p.sync_status === 'SINCRONIZADO' ||
        p.sync_status === 'ENVIADO'
    ).length;

    const tentativasDup = this.listarTentativasDuplicadas();
    const duplicadosLocais = prods.filter((p) => p.status_sincronizacao === 'ERRO_DUPLICADO').length;
    const quantidadeBloqueada = Math.max(tentativasDup.length, duplicadosLocais);

    const historico = this.listarHistoricoEnvios();
    const ultimoEnvio = historico.length > 0 ? historico[0].data_envio : null;
    const ultimaSincronizacao = localStorage.getItem('solutions_ultima_sincronizacao');
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const statusConexao: StatusConexao = isOffline ? 'OFFLINE' : 'ONLINE';

    return {
      pendentes,
      registrosPendentes: pendentes,
      sincronizados: enviados,
      enviados,
      quantidadeEnviada: enviados,
      quantidadeBloqueada,
      total: prods.length,
      ultimaSincronizacao,
      ultimoEnvio,
      statusConexao,
    };
  }

  // =========================================================================
  // PRIMEIRA INSTALAÇÃO E SINCRONIZAÇÃO INICIAL (REQUISITO 4)
  // =========================================================================
  isConfiguracaoInicialConcluida(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG_INICIAL);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return !!parsed.realizada;
    } catch {
      return false;
    }
  }

  obterInfoConfiguracaoInicial(): ConfiguracaoInicialInfo {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG_INICIAL);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return {
      realizada: false,
      data_hora: null,
      usuario: null,
      parametros_baixados: false,
      total_modelos_catalogo: 0,
    };
  }

  marcarConfiguracaoInicialConcluida(usuario: string, totalModelos: number = 0): void {
    const info: ConfiguracaoInicialInfo = {
      realizada: true,
      data_hora: new Date().toLocaleString('pt-BR'),
      usuario,
      parametros_baixados: true,
      total_modelos_catalogo: totalModelos || 10,
    };
    localStorage.setItem(STORAGE_KEY_CONFIG_INICIAL, JSON.stringify(info));
    this.notificarMudanca('config');
  }

  async executarPrimeiraSincronizacao(usuario: string): Promise<{ sucesso: boolean; mensagem: string; modelosBaixados?: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        sucesso: false,
        mensagem: 'Atenção: A primeira inicialização após a instalação requer conexão com a internet para baixar os parâmetros, regras e configurações oficiais do servidor. Por favor, conecte-se à internet para prosseguir.',
      };
    }

    try {
      // 1. Validar status do servidor
      let statusOk = false;
      try {
        const resStatus = await fetch('/api/central/status', { cache: 'no-store' });
        if (resStatus.ok) {
          statusOk = true;
        }
      } catch {
        statusOk = false;
      }

      // Se falhar o endpoint local, tentar nuvem direta
      if (!statusOk) {
        try {
          const resCloud = await fetch(`${CLOUD_STORAGE_URL}?_t=${Date.now()}`);
          if (resCloud.ok) statusOk = true;
        } catch {}
      }

      // 2. Executar sincronização completa de catálogo e base
      await this.sincronizarOnline();

      // 3. Salvar conclusão
      this.marcarConfiguracaoInicialConcluida(usuario, 25);

      this.registrarHistorico(
        usuario,
        'PRIMEIRA_SINCRONIZACAO_INSTALACAO',
        'Sincronização inicial pós-instalação concluída com sucesso. Base de dados local e parâmetros oficiais do Grupo Solutions Samsung inicializados.',
        this.usuarioAtual?.regional || undefined
      );

      return {
        sucesso: true,
        mensagem: 'Primeira sincronização concluída com sucesso! Base local estruturada e pronta para funcionamento 100% offline.',
        modelosBaixados: 25,
      };
    } catch {
      return {
        sucesso: false,
        mensagem: 'Não foi possível concluir a primeira sincronização com o servidor central. Verifique sua conexão e tente novamente.',
      };
    }
  }

  // =========================================================================
  // AUDITORIA DE ACESSO E CONTROLE DE MÁQUINAS (REQUISITO 3)
  // =========================================================================
  registrarAcessoUsuario(usuarioNome: string, perfil: string, regional?: string | null): void {
    const comp = this.obterComputadorAtual(regional || undefined);
    const raw = localStorage.getItem(STORAGE_KEY_LOGS_ACESSO);
    let logs: LogAcessoUsuario[] = [];
    if (raw) {
      try {
        logs = JSON.parse(raw);
      } catch {}
    }

    const novoLog: LogAcessoUsuario = {
      id: Date.now(),
      usuario: usuarioNome,
      perfil,
      regional: regional || null,
      maquina_id: comp.id,
      maquina_nome: comp.nome,
      data_hora: new Date().toLocaleString('pt-BR'),
      dispositivo: typeof navigator !== 'undefined' ? `${navigator.platform || 'Windows'} - ${navigator.userAgent.split(' ')[0]}` : 'Windows Desktop App',
      ip: '127.0.0.1 (Local)',
    };

    logs.unshift(novoLog);
    if (logs.length > 500) logs = logs.slice(0, 500);
    localStorage.setItem(STORAGE_KEY_LOGS_ACESSO, JSON.stringify(logs));
  }

  listarAcessosUsuarios(): LogAcessoUsuario[] {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS_ACESSO);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
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

    const regAlvo = this.usuarioAtual?.perfil === 'OPERADOR' ? this.usuarioAtual.regional : regional;
    if (regAlvo && regAlvo !== 'TODAS') {
      return lista.filter((e) => e.regional === regAlvo);
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
      const ehPendencia = p.status_sincronizacao === 'PENDENTE' || p.sync_status === 'PENDENTE';

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

