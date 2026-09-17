import type { Usuario, SimNao } from '../../types';
import { sha256Sync } from '../../utils/crypto';
import { isAdminOuSuper } from '../auth/authRules';

export const CAPACIDADE_MAXIMA_CAIXA = 20;

/**
 * Validação de integridade de Nota Fiscal / Chave de Acesso NF-e (Gate 6)
 * Aceita:
 * - Número de NF convencional: 1 a 9 dígitos numéricos
 * - Chave de acesso NF-e: exatamente 44 dígitos numéricos
 */
export function validarNumeroOuChaveNfe(nf: string): {
  valido: boolean;
  tipo?: 'NUMERO' | 'CHAVE_ACESSO';
  erro?: string;
  identificadorLimpo?: string;
} {
  if (!nf || !nf.trim()) {
    return { valido: false, erro: 'Número ou chave de acesso da NF não informado.' };
  }
  const limpo = nf.trim().replace(/[^\d]/g, '');
  if (!limpo) {
    return { valido: false, erro: 'A identificação da NF deve conter dígitos numéricos.' };
  }
  if (limpo.length === 44) {
    return { valido: true, tipo: 'CHAVE_ACESSO', identificadorLimpo: limpo };
  }
  if (limpo.length >= 1 && limpo.length <= 9) {
    return { valido: true, tipo: 'NUMERO', identificadorLimpo: limpo };
  }
  return {
    valido: false,
    erro: `Identificação da NF inválida: informe o número da NF (1 a 9 dígitos) ou chave de acesso de 44 dígitos (informado: ${limpo.length} dígitos numéricos).`,
    identificadorLimpo: limpo,
  };
}

/**
 * Regras de Capacidade de Caixa (Gate 6.2)
 */
export function isCaixaCompletaQtd(total: number): boolean {
  return total >= CAPACIDADE_MAXIMA_CAIXA;
}

export function podeFecharCaixaQtd(total: number): { pode: boolean; total: number; motivo?: string } {
  if (total === CAPACIDADE_MAXIMA_CAIXA) {
    return { pode: true, total };
  }
  if (total < CAPACIDADE_MAXIMA_CAIXA) {
    return {
      pode: false,
      total,
      motivo: `A caixa possui apenas ${total} de ${CAPACIDADE_MAXIMA_CAIXA} produtos (capacidade incompleta). O padrão esperado por caixa é de ${CAPACIDADE_MAXIMA_CAIXA} aparelhos.`,
    };
  }
  return {
    pode: false,
    total,
    motivo: `A caixa excedeu a capacidade máxima de ${CAPACIDADE_MAXIMA_CAIXA} produtos (${total} aparelhos registrados).`,
  };
}

/**
 * Cálculo determinístico de Checksum SHA-256 do lote finalizado (Gate 6.3)
 */
export function calcularChecksumLote(dados: {
  lote: string;
  regional: string;
  colaborador: string;
  total_caixas: number;
  total_produtos: number;
  seriais: string[];
  timestamp: string;
}): string {
  const seriaisOrdenados = [...dados.seriais]
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .sort();

  const payloadChecksum = JSON.stringify({
    lote: dados.lote.trim().toUpperCase(),
    regional: dados.regional.trim().toUpperCase(),
    colaborador: dados.colaborador.trim(),
    total_caixas: dados.total_caixas,
    total_produtos: dados.total_produtos,
    seriais: seriaisOrdenados,
    timestamp: dados.timestamp,
  });

  return sha256Sync(payloadChecksum);
}

/**
 * Validação de permissão e motivo para reabertura de lote (Gate 6.4)
 */
export function validarReaberturaLote(
  usuario: Usuario | null,
  motivo?: string | null
): { autorizado: boolean; erro?: string } {
  if (!usuario || !isAdminOuSuper(usuario.perfil)) {
    return {
      autorizado: false,
      erro: 'Acesso negado: Somente administradores do sistema possuem permissão para reabrir lotes finalizados.',
    };
  }

  if (!motivo || !motivo.trim() || motivo.trim().length < 5) {
    return {
      autorizado: false,
      erro: 'Justificativa obrigatória: Informe o motivo da reabertura com no mínimo 5 caracteres.',
    };
  }

  return { autorizado: true };
}

/**
 * Conformidade e Divergência de NF (Gate 6.1)
 */
export function calcularConformidadeProduto(
  produtoLacrado: SimNao | string,
  nfConferida?: SimNao | null
): { status_conformidade: string; divergencia_nf: SimNao } {
  const divergencia_nf: SimNao = nfConferida === 'NÃO' ? 'SIM' : 'NÃO';
  let status_conformidade = 'CONFORME';

  if (divergencia_nf === 'SIM' || produtoLacrado === 'NÃO') {
    status_conformidade = 'DIVERGENTE';
  }

  return { status_conformidade, divergencia_nf };
}

