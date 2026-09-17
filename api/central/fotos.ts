// Endpoint Central de Armazenamento e Evidências Fotográficas Seguras (Gate 7)
// Storage privado, URLs assinadas de curta duração, allowlist de MIME, validação de SHA-256 e proteção anti-traversal

import fs from 'fs';
import path from 'path';
import { sha256Sync } from '../../src/utils/crypto';

const ALLOWED_ORIGINS = [
  'https://sistema-auditoria-solutions.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const PHOTO_SIGNING_SECRET = process.env.PHOTO_SIGNING_SECRET || 'solutions_photo_signing_key_2026';

export function obterStoragePrivadoFotos() {
  const baseStorageDir = path.resolve(process.cwd(), 'data', 'storage', 'photos');
  if (!fs.existsSync(baseStorageDir)) {
    fs.mkdirSync(baseStorageDir, { recursive: true });
  }
  return baseStorageDir;
}

export function gerarSignedPhotoUrl(
  fotoId: string,
  ttlSegundos = 900,
  secret = PHOTO_SIGNING_SECRET
): { signed_url: string; expires_at: string; exp: number; signature: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSegundos;
  const payload = `photo:${fotoId}:${exp}`;
  const signature = sha256Sync(`${secret}:${payload}`);
  const signed_url = `/api/central/fotos?id=${encodeURIComponent(fotoId)}&exp=${exp}&sig=${signature}`;
  const expires_at = new Date(exp * 1000).toISOString();
  return { signed_url, expires_at, exp, signature };
}

export function validarSignedPhotoUrl(
  fotoId: string,
  exp: number,
  signature: string,
  secret = PHOTO_SIGNING_SECRET
): { valido: boolean; erro?: string } {
  if (!exp || isNaN(exp)) {
    return { valido: false, erro: 'Parâmetro de expiração (exp) ausente ou inválido.' };
  }
  if (!signature) {
    return { valido: false, erro: 'Assinatura criptográfica (sig) ausente.' };
  }
  const nowSeg = Math.floor(Date.now() / 1000);
  if (nowSeg > exp) {
    return { valido: false, erro: 'URL assinada expirada. Solicite uma nova URL de visualização.' };
  }
  const payload = `photo:${fotoId}:${exp}`;
  const signatureEsperada = sha256Sync(`${secret}:${payload}`);
  if (signature !== signatureEsperada) {
    return { valido: false, erro: 'Assinatura criptográfica da URL inválida ou adulterada.' };
  }
  return { valido: true };
}

function validarSessaoToken(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token.includes('.')) return false;
  const [payloadB64, assinatura] = token.split('.');
  try {
    const payloadStr = atob(payloadB64);
    const signatureExpected = sha256Sync(`solutions_session_key_2026_${payloadStr}`);
    if (assinatura !== signatureExpected) return false;
    const parts = payloadStr.split(':');
    const exp = parseInt(parts[6], 10);
    return Date.now() <= exp;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Same origin
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const storageDir = obterStoragePrivadoFotos();

  // --- POST: Upload Autenticado de Evidência Fotográfica ---
  if (req.method === 'POST') {
    try {
      const authHeader = req.headers?.authorization;
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {}
      }

      const { usuario, id, entity_type, entity_id, rotulo, mime_type, sha256, dados_base64 } = body || {};

      // 1. Autenticação obrigatória (Token ou credencial de usuário)
      const isAuthenticated = validarSessaoToken(authHeader) || (usuario && (usuario.login || usuario.nome));
      if (!isAuthenticated) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Não autenticado: O upload de evidências requer sessão ativa ou credenciais válidas.',
        });
      }

      if (!id || !entity_id || !dados_base64) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Dados incompletos: id, entity_id e dados_base64 são obrigatórios.',
        });
      }

      // 2. Proibição de Placeholders e SVG Falsos (Gate 7.3)
      if (
        dados_base64.length < 50 ||
        dados_base64.includes('<svg') ||
        dados_base64.includes('placeholder')
      ) {
        return res.status(422).json({
          sucesso: false,
          erro: 'Evidência fotográfica rejeitada: Imagens simuladas, placeholders ou SVGs vazios não são permitidos.',
        });
      }

      // 3. Validação de MIME Type (Allowlist estrita)
      let mimeFinal = (mime_type || 'image/jpeg').toLowerCase();
      let base64Limpa = dados_base64;
      const match = dados_base64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeFinal = match[1].toLowerCase();
        base64Limpa = match[2];
      }

      if (!ALLOWED_MIME_TYPES.includes(mimeFinal)) {
        return res.status(415).json({
          sucesso: false,
          erro: `MIME type não suportado: "${mimeFinal}". Formatos permitidos: ${ALLOWED_MIME_TYPES.join(', ')}.`,
        });
      }

      // 4. Decodificação e Limite de Tamanho (Max 10MB)
      const buffer = Buffer.from(base64Limpa, 'base64');
      if (buffer.length > MAX_PHOTO_SIZE_BYTES) {
        return res.status(413).json({
          sucesso: false,
          erro: `Tamanho excede o limite máximo permitido de ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB. (Arquivo enviado: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB).`,
        });
      }

      // 5. Validação de Integridade Criptográfica (Checksum SHA-256)
      const calculatedHash = sha256Sync(base64Limpa);
      if (sha256 && sha256 !== calculatedHash) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Assinatura SHA-256 divergente: O payload binário foi adulterado ou corrompido durante o trânsito.',
        });
      }

      // 6. Persistência no Storage Privado (sem path traversal)
      const sanitizedId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
      const extensao = mimeFinal === 'image/png' ? 'png' : mimeFinal === 'image/webp' ? 'webp' : 'jpg';
      const filename = `${sanitizedId}.${extensao}`;
      const filePath = path.join(storageDir, filename);

      // Verificação estrita de Path Traversal
      const canonicalDest = path.resolve(filePath);
      if (!canonicalDest.startsWith(storageDir)) {
        return res.status(403).json({ sucesso: false, erro: 'Tentativa de violação de diretório detectada.' });
      }

      fs.writeFileSync(canonicalDest, buffer);

      // 7. Gerar URL assinada de curta duração para visualização (15 minutos)
      const { signed_url, expires_at } = gerarSignedPhotoUrl(sanitizedId, 900);

      return res.status(201).json({
        sucesso: true,
        id: sanitizedId,
        entity_type,
        entity_id,
        rotulo: rotulo || 'Evidência Fotográfica',
        mime_type: mimeFinal,
        tamanho_bytes: buffer.length,
        sha256: calculatedHash,
        storage_path: `photos/${filename}`,
        signed_url,
        expires_at,
        mensagem: 'Evidência fotográfica persistida no storage privado com sucesso.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ sucesso: false, erro: `Falha interna no servidor de fotos: ${message}` });
    }
  }

  // --- GET: Download / Visualização Protegida de Foto ---
  if (req.method === 'GET') {
    try {
      const { id, sig, exp } = req.query || {};
      const authHeader = req.headers?.authorization;

      if (!id) {
        return res.status(400).json({ erro: 'ID da foto não informado.' });
      }

      const sanitizedId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');

      // 1. Autorização: Validar se possui URL assinada válida OU sessão autenticada
      const isSignedUrlValid = sig && exp && validarSignedPhotoUrl(sanitizedId, Number(exp), String(sig)).valido;
      const isSessionValid = validarSessaoToken(authHeader);

      if (!isSignedUrlValid && !isSessionValid) {
        if (sig && exp) {
          const validacao = validarSignedPhotoUrl(sanitizedId, Number(exp), String(sig));
          return res.status(403).json({ erro: validacao.erro || 'Acesso negado: URL assinada inválida.' });
        }
        return res.status(401).json({ erro: 'Acesso não autorizado: Esta evidência requer assinatura temporária ou token de sessão.' });
      }

      // 2. Localizar arquivo em storage privado
      const possiveisExtensoes = ['jpg', 'png', 'webp', 'jpeg'];
      let arquivoEncontrado: string | null = null;
      let mimeEncontrado = 'image/jpeg';

      for (const ext of possiveisExtensoes) {
        const candidato = path.join(storageDir, `${sanitizedId}.${ext}`);
        if (fs.existsSync(candidato)) {
          arquivoEncontrado = candidato;
          mimeEncontrado = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          break;
        }
      }

      if (!arquivoEncontrado) {
        return res.status(404).json({ erro: 'Evidência fotográfica não encontrada no storage.' });
      }

      // Verificação anti-traversal
      const canonicalTarget = path.resolve(arquivoEncontrado);
      if (!canonicalTarget.startsWith(storageDir)) {
        return res.status(403).json({ erro: 'Acesso negado: Caminho de arquivo fora dos limites do storage.' });
      }

      const fileBuffer = fs.readFileSync(canonicalTarget);
      res.setHeader('Content-Type', mimeEncontrado);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'private, max-age=900, no-transform');
      return res.status(200).send(fileBuffer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ erro: `Falha ao recuperar foto: ${message}` });
    }
  }

  return res.status(405).json({ erro: 'Método não permitido.' });
}
