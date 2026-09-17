import type { Usuario, PerfilUsuario, SessaoUsuario } from '../../types';
import { sha256Sync } from '../../utils/crypto';

export function isAdminOuSuper(perfil?: PerfilUsuario | null): boolean {
  return perfil === 'ADMINISTRADOR' || perfil === 'SUPER_ADMIN';
}

export function isSupervisor(perfil?: PerfilUsuario | null): boolean {
  return perfil === 'SUPERVISOR_REGIONAL';
}

export function podeAcessarRegional(usuario: Usuario | null, regionalAlvo: string): boolean {
  if (!usuario) return false;
  if (isAdminOuSuper(usuario.perfil)) return true;
  if (!regionalAlvo || regionalAlvo === 'TODAS' || regionalAlvo === 'GERAL') {
    return isAdminOuSuper(usuario.perfil);
  }
  return (usuario.regional || '').trim().toUpperCase() === regionalAlvo.trim().toUpperCase();
}

export function criarTokenSessao(usuario: Usuario, deviceId: string): SessaoUsuario {
  const iat = Date.now();
  const exp = iat + 8 * 60 * 60 * 1000; // 8 horas de validade
  const payloadStr = `${usuario.id}:${usuario.login}:${usuario.perfil}:${usuario.regional || 'GERAL'}:${deviceId}:${iat}:${exp}`;
  const assinatura = sha256Sync(`solutions_session_key_2026_${payloadStr}`);
  const token = `${btoa(payloadStr)}.${assinatura}`;
  return {
    token,
    user_id: usuario.id,
    login: usuario.login,
    nome: usuario.nome,
    perfil: usuario.perfil,
    regional: usuario.regional || null,
    device_id: deviceId,
    iat,
    exp,
  };
}

export function validarTokenSessao(token: string): { valido: boolean; sessao?: Partial<SessaoUsuario>; erro?: string } {
  if (!token || !token.includes('.')) return { valido: false, erro: 'Token ausente ou malformado.' };
  const [payloadB64, assinatura] = token.split('.');
  let payloadStr = '';
  try {
    payloadStr = atob(payloadB64);
  } catch {
    return { valido: false, erro: 'Codificação de token inválida.' };
  }
  const signatureExpected = sha256Sync(`solutions_session_key_2026_${payloadStr}`);
  if (assinatura !== signatureExpected) {
    return { valido: false, erro: 'Assinatura criptográfica de sessão inválida.' };
  }
  const [userIdStr, login, perfil, regional, deviceId, iatStr, expStr] = payloadStr.split(':');
  const exp = parseInt(expStr, 10);
  if (Date.now() > exp) {
    return { valido: false, erro: 'Sessão expirada. Faça login novamente.' };
  }
  return {
    valido: true,
    sessao: {
      user_id: parseInt(userIdStr, 10),
      login,
      perfil: perfil as PerfilUsuario,
      regional: regional === 'GERAL' ? null : regional,
      device_id: deviceId,
      exp,
      iat: parseInt(iatStr, 10),
    },
  };
}
