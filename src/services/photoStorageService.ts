// Serviço de Gerenciamento do Ciclo de Vida de Fotos e Evidências (Gate 7)
// Implementa os 5 estados: LOCAL_ONLY -> PENDING_UPLOAD -> UPLOADING -> UPLOADED -> FAILED

import { idb, type FotoEvidencia } from '../db/indexedDb';
import type { FotoLifecycleStatus } from '../types';
import { sha256Sync, gerarUUID } from '../utils/crypto';
import { obterApiUrl } from '../db/storage';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface CapturarFotoInput {
  entityType: 'LOTE' | 'CAIXA' | 'PRODUTO';
  entityId: string;
  rotulo: string;
  dadosBase64: string;
  descricao?: string;
}

export interface ResultadoUploadFoto {
  sucesso: boolean;
  fotoId: string;
  status: FotoLifecycleStatus;
  storage_path?: string | null;
  signed_url?: string | null;
  erro?: string;
}

/**
 * 1. Captura Local de Foto
 * Salva localmente em store dedicada no IndexedDB com status LOCAL_ONLY e calcula SHA-256
 */
export async function capturarFotoLocal(input: CapturarFotoInput): Promise<FotoEvidencia> {
  const { entityType, entityId, rotulo, dadosBase64, descricao } = input;

  if (!dadosBase64 || dadosBase64.trim().length === 0) {
    throw new Error('Evidência fotográfica inválida: Os dados da imagem estão vazios.');
  }

  // Regra 11.3: Proibição estrita de placeholders simulados
  if (
    dadosBase64.length < 50 ||
    dadosBase64.includes('<svg') ||
    dadosBase64.includes('placeholder')
  ) {
    throw new Error('Evidência fotográfica rejeitada: Imagens simuladas ou placeholders não são permitidos.');
  }

  let mimeType = 'image/jpeg';
  let conteudoPuro = dadosBase64;

  const match = dadosBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1].toLowerCase();
    conteudoPuro = match[2];
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Formato de imagem não suportado: "${mimeType}". Permitidos: ${ALLOWED_MIME_TYPES.join(', ')}.`);
  }

  const padding = (conteudoPuro.endsWith('==') ? 2 : conteudoPuro.endsWith('=') ? 1 : 0);
  const tamanhoBytes = Math.floor((conteudoPuro.length * 3) / 4) - padding;

  if (tamanhoBytes > MAX_PHOTO_SIZE_BYTES) {
    throw new Error(`A imagem excede o tamanho máximo de ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB.`);
  }

  const hash = sha256Sync(conteudoPuro);

  const novaFoto: FotoEvidencia = {
    id: gerarUUID(),
    entity_type: entityType,
    entity_id: entityId,
    rotulo,
    descricao,
    mime_type: mimeType,
    tamanho_bytes: Math.max(0, tamanhoBytes),
    sha256: hash,
    dados_base64: dadosBase64,
    sync_status: 'LOCAL_ONLY',
    storage_path: null,
    signed_url: null,
    signed_url_expires_at: null,
    upload_attempts: 0,
    last_error: null,
    criado_em: new Date().toISOString(),
    sincronizado_em: null,
  };

  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      await idb.fotos_evidencias.put(novaFoto);
    }
  } catch (err) {
    throw new Error(`Falha ao persistir evidência localmente no IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }

  return novaFoto;
}

/**
 * 2. Transição para Fila de Upload (PENDING_UPLOAD)
 */
export async function prepararUploadFoto(fotoId: string): Promise<FotoEvidencia | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  const foto = await idb.fotos_evidencias.get(fotoId);
  if (!foto) return null;

  foto.sync_status = 'PENDING_UPLOAD';
  await idb.fotos_evidencias.put(foto);
  return foto;
}

/**
 * 3. Execução do Upload Autenticado (UPLOADING -> UPLOADED ou FAILED)
 */
export async function executarUploadFoto(
  fotoId: string,
  opcoes?: {
    token?: string;
    baseUrl?: string;
    usuario?: { login: string; nome: string };
  }
): Promise<ResultadoUploadFoto> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return { sucesso: false, fotoId, status: 'FAILED', erro: 'Ambiente IndexedDB indisponível.' };
  }

  const foto = await idb.fotos_evidencias.get(fotoId);
  if (!foto) {
    return { sucesso: false, fotoId, status: 'FAILED', erro: 'Evidência fotográfica não encontrada localmente.' };
  }

  // Transição para UPLOADING
  foto.sync_status = 'UPLOADING';
  foto.upload_attempts = (foto.upload_attempts || 0) + 1;
  await idb.fotos_evidencias.put(foto);

  try {
    const url = opcoes?.baseUrl
      ? `${opcoes.baseUrl.replace(/\/$/, '')}/api/central/fotos`
      : obterApiUrl('/api/central/fotos');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (opcoes?.token) {
      headers['Authorization'] = `Bearer ${opcoes.token}`;
    }

    const payload = {
      id: foto.id,
      entity_type: foto.entity_type,
      entity_id: foto.entity_id,
      rotulo: foto.rotulo,
      mime_type: foto.mime_type,
      sha256: foto.sha256,
      dados_base64: foto.dados_base64,
      usuario: opcoes?.usuario,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.erro || `Erro no upload (HTTP ${res.status})`);
    }

    const respostaJson = await res.json();

    // Verificação de Integridade Central (Regra 11.1)
    if (respostaJson.sha256 && respostaJson.sha256 !== foto.sha256) {
      throw new Error('Falha de verificação no servidor: O SHA-256 retornado pelo central diverge da evidência local.');
    }

    // Sucesso: transição para UPLOADED
    foto.sync_status = 'UPLOADED';
    foto.storage_path = respostaJson.storage_path || null;
    foto.signed_url = respostaJson.signed_url || null;
    foto.signed_url_expires_at = respostaJson.expires_at || null;
    foto.sincronizado_em = new Date().toISOString();
    foto.last_error = null;
    await idb.fotos_evidencias.put(foto);

    return {
      sucesso: true,
      fotoId: foto.id,
      status: 'UPLOADED',
      storage_path: foto.storage_path,
      signed_url: foto.signed_url,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    foto.sync_status = 'FAILED';
    foto.last_error = msg;
    await idb.fotos_evidencias.put(foto);

    return {
      sucesso: false,
      fotoId: foto.id,
      status: 'FAILED',
      erro: msg,
    };
  }
}

/**
 * 4. Consulta de Evidência para Visualização com Prioridade Local
 */
export async function obterFotoParaVisualizacao(fotoId: string): Promise<{
  sucesso: boolean;
  dadosBase64?: string;
  signedUrl?: string;
  origem: 'LOCAL' | 'REMOTO';
  erro?: string;
}> {
  if (typeof window !== 'undefined' && window.indexedDB) {
    const fotoLocal = await idb.fotos_evidencias.get(fotoId);
    if (fotoLocal?.dados_base64) {
      return {
        sucesso: true,
        dadosBase64: fotoLocal.dados_base64,
        origem: 'LOCAL',
      };
    }
    if (fotoLocal?.signed_url) {
      return {
        sucesso: true,
        signedUrl: fotoLocal.signed_url,
        origem: 'REMOTO',
      };
    }
  }

  return { sucesso: false, origem: 'LOCAL', erro: 'Foto não encontrada.' };
}
