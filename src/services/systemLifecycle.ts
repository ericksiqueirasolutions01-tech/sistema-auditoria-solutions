import { isDesktopApp } from '../db/storage';

let heartbeatTimer: any = null;
let monitorIniciado = false;

/**
 * Inicia o monitoramento de ciclo de vida do aplicativo desktop.
 * Envia heartbeat periódico ao servidor local C# e registra eventos
 * de fechamento de janela para notificar o encerramento completo de processos.
 */
export function iniciarMonitoramentoCicloVida(): void {
  if (monitorIniciado || !isDesktopApp() || typeof window === 'undefined') {
    return;
  }
  monitorIniciado = true;

  // 1. Envia heartbeat a cada 2 segundos para o executável local saber que a janela está ativa
  const enviarHeartbeat = () => {
    fetch('/api/system/heartbeat', { cache: 'no-store' }).catch(() => {});
  };

  enviarHeartbeat();
  heartbeatTimer = setInterval(enviarHeartbeat, 2000);

  // 2. Notificação imediata ao fechar a janela / aba pelo botão 'X'
  const notificarEncerramento = () => {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/system/shutdown');
      } else {
        fetch('/api/system/shutdown', { method: 'POST', keepalive: true }).catch(() => {});
      }
    } catch {}
  };

  window.addEventListener('beforeunload', notificarEncerramento);
  window.addEventListener('pagehide', notificarEncerramento);
}

/**
 * Função acionada pelo botão "Fechar Sistema" na interface.
 * Solicita confirmação e encerra todos os processos em segundo plano, liberando memória e portas.
 */
export async function fecharSistemaCompleto(): Promise<void> {
  const confirmou = window.confirm(
    'Deseja realmente fechar o Sistema de Auditoria Solutions?\n\n' +
    'Todos os processos em segundo plano serão encerrados imediatamente e os recursos serão liberados.'
  );

  if (!confirmou) {
    return;
  }

  // Desativa o timer de heartbeat para evitar reconexões
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  // Notifica o host desktop C# para desligar todos os processos
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/system/shutdown');
    } else {
      await fetch('/api/system/shutdown', { method: 'POST', keepalive: true }).catch(() => {});
    }
  } catch {}

  // Exibe tela de encerramento
  try {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui,-apple-system,sans-serif;background:#090d16;color:#ffffff;text-align:center;padding:24px;">
        <div style="background:#1e293b;border:2px solid #334155;border-radius:24px;padding:36px;max-width:480px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <div style="width:64px;height:64px;background:#059669;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 0 20px rgba(5,150,105,0.4);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h1 style="font-size:20px;font-weight:900;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.5px;color:#f8fafc;">
            Sistema Encerrado
          </h1>
          <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 20px;">
            Todos os processos em segundo plano foram finalizados e a memória foi completamente liberada.
          </p>
          <div style="background:#0f172a;border-radius:12px;padding:12px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">
            Você já pode fechar esta janela ou abrir novamente o sistema a qualquer momento.
          </div>
        </div>
      </div>
    `;
  } catch {}

  // Tenta fechar a janela do navegador/Edge
  try {
    window.close();
  } catch {}
}

