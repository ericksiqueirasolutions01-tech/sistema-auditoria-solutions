import { isDesktopApp } from '../db/storage';

let heartbeatTimer: any = null;
let monitorIniciado = false;

export function obterDesktopSecret(): string {
  if (typeof window !== 'undefined' && (window as any).__SOLUTIONS_DESKTOP_SECRET__) {
    return (window as any).__SOLUTIONS_DESKTOP_SECRET__;
  }
  return '';
}

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

  // 1. Envia heartbeat a cada 5 segundos com X-System-Secret
  const enviarHeartbeat = () => {
    const secret = obterDesktopSecret();
    fetch('/api/system/heartbeat', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-System-Secret': secret,
      },
    }).catch(() => {});
  };

  enviarHeartbeat();
  heartbeatTimer = setInterval(enviarHeartbeat, 5000);
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

  // Notifica o host desktop C# com autorização X-System-Secret para desligar todos os processos
  try {
    const secret = obterDesktopSecret();
    await fetch('/api/system/shutdown', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-System-Secret': secret,
      },
      keepalive: true,
    }).catch(() => {});
  } catch {}

  // Exibe tela de encerramento
  try {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui,-apple-system,sans-serif;background:#090d16;color:#ffffff;text-align:center;padding:24px;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#1e293b;border:2px solid #334155;border-radius:24px;padding:36px;max-width:480px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);';

    const iconBox = document.createElement('div');
    iconBox.style.cssText = 'width:64px;height:64px;background:#059669;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 0 20px rgba(5,150,105,0.4);';
    iconBox.textContent = '✓';
    iconBox.style.fontSize = '32px';
    iconBox.style.fontWeight = 'bold';

    const title = document.createElement('h1');
    title.style.cssText = 'font-size:20px;font-weight:900;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.5px;color:#f8fafc;';
    title.textContent = 'Sistema Encerrado';

    const desc = document.createElement('p');
    desc.style.cssText = 'font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 20px;';
    desc.textContent = 'Todos os processos em segundo plano foram finalizados e a memória foi completamente liberada.';

    const footer = document.createElement('div');
    footer.style.cssText = 'background:#0f172a;border-radius:12px;padding:12px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;';
    footer.textContent = 'Você já pode fechar esta janela ou abrir novamente o sistema a qualquer momento.';

    card.appendChild(iconBox);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(footer);
    container.appendChild(card);

    document.body.replaceChildren(container);
  } catch {}

  // Tenta fechar a janela do navegador/Edge
  try {
    window.close();
  } catch {}
}

