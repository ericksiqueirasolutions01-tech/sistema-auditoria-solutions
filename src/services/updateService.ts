import { isDesktopApp } from '../db/storage';
import { VERSAO_LOCAL, InfoVersaoSistema } from '../version';

export interface StatusAtualizacao {
  verificando: boolean;
  temAtualizacao: boolean;
  atualizando: boolean;
  progresso?: string;
  erro?: string | null;
  infoNovaVersao?: InfoVersaoSistema | null;
}

class UpdateService {
  private status: StatusAtualizacao = {
    verificando: false,
    temAtualizacao: false,
    atualizando: false,
    progresso: '',
    erro: null,
    infoNovaVersao: null,
  };

  private listeners: Array<(s: StatusAtualizacao) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      // Checagem imediata após carregar a interface
      setTimeout(() => this.verificarAtualizacao(), 1200);

      // Checagem contínua a cada 60 segundos
      setInterval(() => this.verificarAtualizacao(), 60000);

      // Checagem ao reconectar a internet ou focar a janela
      window.addEventListener('online', () => this.verificarAtualizacao());
      window.addEventListener('focus', () => this.verificarAtualizacao());
    }
  }

  public subscrever(callback: (s: StatusAtualizacao) => void): () => void {
    this.listeners.push(callback);
    callback({ ...this.status });
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notificar() {
    const copia = { ...this.status };
    this.listeners.forEach((cb) => cb(copia));
  }

  public async verificarAtualizacao(): Promise<boolean> {
    if (this.status.verificando || this.status.atualizando) {
      return this.status.temAtualizacao;
    }

    this.status.verificando = true;
    this.notificar();

    try {
      // 1. No aplicativo desktop, verificar versão real dos arquivos locais
      let versaoLocalEmUso = VERSAO_LOCAL.versaoCodigo;
      if (isDesktopApp()) {
        try {
          const resLocal = await fetch('/api/system/version', { cache: 'no-store' });
          if (resLocal.ok) {
            const dataLocal = await resLocal.json();
            if (dataLocal && typeof dataLocal.versaoCodigo === 'number') {
              versaoLocalEmUso = dataLocal.versaoCodigo;
            }
          }
        } catch {
          // Se falhar o endpoint, mantém versaoLocalEmUso
        }
      }

      // 2. Consultar version.json oficial da nuvem com timestamp anti-cache
      const urlVersion = `https://sistema-auditoria-solutions.vercel.app/version.json?_t=${Date.now()}`;
      const res = await fetch(urlVersion, { cache: 'no-store' });

      if (res.ok) {
        const dataRemota: InfoVersaoSistema = await res.json();
        if (dataRemota && typeof dataRemota.versaoCodigo === 'number') {
          // Se a versão remota for maior que a local instalada
          const precisaAtualizar = dataRemota.versaoCodigo > versaoLocalEmUso;
          if (precisaAtualizar) {
            this.status.temAtualizacao = true;
            this.status.infoNovaVersao = dataRemota;
            this.status.verificando = false;
            this.notificar();
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('[UpdateService] Falha ao checar atualização online:', e);
    }

    this.status.verificando = false;
    this.notificar();
    return this.status.temAtualizacao;
  }

  public async aplicarAtualizacao(): Promise<{ sucesso: boolean; erro?: string }> {
    this.status.atualizando = true;
    this.status.erro = null;
    this.status.progresso = 'Conectando ao servidor de atualização...';
    this.notificar();

    if (isDesktopApp()) {
      try {
        this.status.progresso = 'Baixando pacote oficial atualizado do sistema...';
        this.notificar();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const res = await fetch('/api/system/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          this.status.progresso = 'Download concluído! Aplicando nova versão e reiniciando o aplicativo...';
          this.notificar();

          // Aguarda o instalador C# fechar e reiniciar
          return { sucesso: true };
        } else {
          throw new Error('O servidor local não respondeu ao comando de atualização.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.status.atualizando = false;
        this.status.erro = `Falha na atualização automática (${msg}). Clique no botão abaixo para baixar o instalador manualmente.`;
        this.notificar();

        // Fallback: abrir download manual
        const urlDownload =
          this.status.infoNovaVersao?.downloadUrl ||
          'https://sistema-auditoria-solutions.vercel.app/downloads/Sistema-Auditoria-Solutions-Setup.exe';
        window.open(urlDownload, '_blank');
        return { sucesso: false, erro: msg };
      }
    } else {
      // Modo Web Online: Limpar caches e recarregar
      try {
        this.status.progresso = 'Atualizando aplicação Web com os novos módulos...';
        this.notificar();
        if ('caches' in window) {
          const chs = await caches.keys();
          await Promise.all(chs.map((c) => caches.delete(c)));
        }
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return { sucesso: true };
      } catch {
        window.location.reload();
        return { sucesso: true };
      }
    }
  }
}

export const updateService = new UpdateService();
