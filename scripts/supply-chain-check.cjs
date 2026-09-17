/**
 * SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG
 * Script de Verificação de Supply Chain, Secret Scanning e Integridade Criptográfica (Gate 14)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');

// Padrões de detecção de segredos (Secret Scan)
const SECRET_PATTERNS = [
  { name: 'Chave Privada RSA/EC/OPENSSH', regex: /-----BEGIN\s+(?:RSA|EC|OPENSSH|PGP)?\s*PRIVATE\s+KEY-----/i },
  { name: 'Token JWT embutido', regex: /ey[A-Za-z0-9-_=]+\.ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+/ },
  { name: 'Supabase Service Role Key', regex: /service_role[a-zA-Z0-9_\-\.]{20,}/i },
  { name: 'AWS Access/Secret Key', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
  { name: 'String de Conexão com Senha Exposta', regex: /(?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@[^\s]+/i },
  { name: 'Senha Hardcoded em Código', regex: /(?:const|let|var|senha|password|secret)\s*[:=]\s*['"`](?!hash-|test-|mock-|admin123|operador123|password-hash|superadmin123)[A-Za-z0-9@#$%^&*]{12,}['"`]/i }
];

// Arquivos ou diretórios proibidos de serem publicados ou comitados
const FORBIDDEN_PUBLISH_PATTERNS = [
  /^\.env(?:\.local|\.production|\.development)?$/,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /service[_-]?role/i,
  /idempotency\.local\.json$/i,
  /central_idempotency\.json$/i,
  /\.sqlite(?:3)?$/i,
  /dump.*\.sql$/i,
];

// Extensões de código inspecionadas no linting & secret scan
const SCANNABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.sql', '.html', '.cs', '.ps1', '.bat', '.yml', '.yaml'];

// Pastas ignoradas na varredura
const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build-installer', '.system_generated', 'coverage'];

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (IGNORED_DIRS.includes(file.name)) continue;
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else {
      const ext = path.extname(file.name).toLowerCase();
      if (SCANNABLE_EXTENSIONS.includes(ext) || file.name.startsWith('.env')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

/**
 * 1. Secret Scanning em todos os arquivos rastreáveis
 */
function runSecretScan() {
  console.log('[Supply-Chain] Executando Secret Scan no repositório...');
  const files = scanDirectory(ROOT_DIR);
  let leaksFound = 0;

  for (const file of files) {
    const relPath = path.relative(ROOT_DIR, file);
    // Ignorar arquivos de teste que contêm padrões de validação sintética
    if (relPath.includes('ci-supply-chain.test.ts')) continue;

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Ignorar comentários em scripts de exemplo ou documentação
      if (line.trim().startsWith('//') && line.includes('Exemplo:')) return;
      if (line.trim().startsWith('*') && line.includes('Exemplo:')) return;

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          // Excluir hashes de exemplo ou fixtures de testes conhecidos
          if (line.includes('hash-operador') || line.includes('hash-admin') || line.includes('sha256-')) continue;

          console.error(`[ALERTA DE SEGURANÇA] ${pattern.name} detectado em: ${relPath}:${index + 1}`);
          leaksFound++;
        }
      }
    });
  }

  if (leaksFound > 0) {
    console.error(`[Supply-Chain] FALHA: ${leaksFound} segredo(s) potencial(is) encontrado(s)!`);
    return false;
  }

  console.log(`[Supply-Chain] Secret Scan CONCLUÍDO: 0 segredos detectados em ${files.length} arquivos.`);
  return true;
}

/**
 * 2. Validação de Exclusões Proibidas na Distribuição (Gate 14)
 */
function verifyArtifactExclusions(targetDir = path.join(ROOT_DIR, 'dist')) {
  console.log(`[Supply-Chain] Verificando exclusões de artefatos em: ${targetDir}...`);
  if (!fs.existsSync(targetDir)) {
    console.log(`[Supply-Chain] Diretório ${targetDir} não existe ainda. Pulando verificação.`);
    return true;
  }

  const violations = [];
  function checkDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      for (const pattern of FORBIDDEN_PUBLISH_PATTERNS) {
        if (pattern.test(entry.name)) {
          violations.push(fullPath);
        }
      }
      if (entry.isDirectory()) {
        checkDir(fullPath);
      }
    }
  }

  checkDir(targetDir);

  if (violations.length > 0) {
    console.error('[Supply-Chain] FALHA: Arquivos proibidos detectados no pacote de distribuição:');
    violations.forEach((v) => console.error(` - ${v}`));
    return false;
  }

  console.log('[Supply-Chain] Nenhuma exclusão proibida (.env, chaves privadas, dumps) encontrada no pacote.');
  return true;
}

/**
 * 3. Hashing de Integridade SHA-256 e Geração de Manifesto
 */
function generateSha256Manifest(targetDir = path.join(ROOT_DIR, 'dist')) {
  console.log(`[Supply-Chain] Gerando hashes SHA-256 e manifesto de integridade para ${targetDir}...`);
  if (!fs.existsSync(targetDir)) {
    console.error(`[Supply-Chain] Diretório de artefatos ${targetDir} não encontrado para hashing.`);
    return false;
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    algorithm: 'SHA-256',
    system: 'Sistema de Auditoria Solutions',
    version: '1.2.0',
    files: {},
  };

  const sumsLines = [];

  function hashDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.name === 'manifest.json' || entry.name === 'SHA256SUMS.txt') continue;

      if (entry.isDirectory()) {
        hashDir(fullPath);
      } else {
        const fileBuffer = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const relPath = path.relative(targetDir, fullPath).replace(/\\/g, '/');
        const sizeBytes = fs.statSync(fullPath).size;

        manifest.files[relPath] = {
          sha256: hash,
          sizeBytes,
        };
        sumsLines.push(`${hash}  ${relPath}`);
      }
    }
  }

  hashDir(targetDir);

  const manifestPath = path.join(targetDir, 'manifest.json');
  const sumsPath = path.join(targetDir, 'SHA256SUMS.txt');

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(sumsPath, sumsLines.join('\n'), 'utf8');

  console.log(`[Supply-Chain] Manifesto gravado: ${manifestPath} (${Object.keys(manifest.files).length} arquivos)`);
  console.log(`[Supply-Chain] SHA256SUMS gravado: ${sumsPath}`);
  return true;
}

/**
 * 4. Lint de Código e Boas Práticas de Engenharia
 */
function runCodeLint() {
  console.log('[Supply-Chain] Executando verificação de Lint e diretrizes estruturais...');
  const files = scanDirectory(ROOT_DIR);
  let lintErrors = 0;

  for (const file of files) {
    const relPath = path.relative(ROOT_DIR, file);
    if (!relPath.startsWith('src') && !relPath.startsWith('api')) continue;

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // Proibir eval() direto
      if (/\beval\s*\(/.test(line)) {
        console.error(`[LINT ERROR] Uso proibido de eval() em: ${relPath}:${idx + 1}`);
        lintErrors++;
      }
      // Proibir innerHTML direto não sanitizado
      if (/\.innerHTML\s*=/.test(line)) {
        console.error(`[LINT ERROR] Atribuição direta a innerHTML sem sanitização em: ${relPath}:${idx + 1}`);
        lintErrors++;
      }
    });
  }

  if (lintErrors > 0) {
    console.error(`[Supply-Chain] FALHA de Lint: ${lintErrors} violação(ões) detectada(s).`);
    return false;
  }

  console.log('[Supply-Chain] Lint CONCLUÍDO com êxito: 0 violações de segurança sintática.');
  return true;
}

// Execução principal via CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  let success = true;

  if (args.includes('--scan-secrets') || args.includes('--all') || args.length === 0) {
    success = runSecretScan() && success;
  }
  if (args.includes('--lint') || args.includes('--all') || args.length === 0) {
    success = runCodeLint() && success;
  }
  if (args.includes('--check-exclusions') || args.includes('--all')) {
    success = verifyArtifactExclusions() && success;
  }
  if (args.includes('--generate-manifest') || args.includes('--all')) {
    success = generateSha256Manifest() && success;
  }

  if (!success) {
    process.exit(1);
  }
  console.log('[Supply-Chain] Todas as verificações foram concluídas com SUCESSO.');
}

module.exports = {
  runSecretScan,
  verifyArtifactExclusions,
  generateSha256Manifest,
  runCodeLint,
  SECRET_PATTERNS,
  FORBIDDEN_PUBLISH_PATTERNS,
};

