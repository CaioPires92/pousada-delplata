const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const envLocalPath = path.join(root, '.env.local');
const localDatabasePath = path.join(root, 'prisma', 'dev.db');
const isWindows = process.platform === 'win32';

function run(command, args, options = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Comando falhou: ${command} ${args.join(' ')}`);
  }
}

function parseEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function quoteEnv(value) {
  return JSON.stringify(String(value));
}

function ensureLocalDefaults() {
  const existingContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : '';
  const existing = parseEnv(existingContent);
  const defaults = {
    DATABASE_URL: 'file:./dev.db',
    ADMIN_JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    ADMIN_BOOTSTRAP_SECRET: crypto.randomBytes(32).toString('hex'),
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3005',
    NEXT_PUBLIC_BASE_URL: 'http://localhost:3005',
    ENABLE_TEST_PAYMENTS: 'false',
    NEXT_PUBLIC_ENABLE_TEST_PAYMENTS: 'false',
  };

  const missingEntries = Object.entries(defaults).filter(([key]) => !existing[key]);
  if (missingEntries.length === 0) return existing;

  const addition = [
    existingContent.trimEnd(),
    '',
    '# Valores locais gerados automaticamente por npm run setup:local',
    ...missingEntries.map(([key, value]) => `${key}=${quoteEnv(value)}`),
    '',
  ].filter((line, index) => !(index === 0 && line === '')).join('\n');

  fs.writeFileSync(envLocalPath, addition, { mode: 0o600 });
  return { ...defaults, ...existing };
}

function restoreLocalOverrides(previousContent) {
  if (!previousContent.trim()) return;

  const pulledContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : '';
  const pulled = parseEnv(pulledContent);
  const previous = parseEnv(previousContent);
  const missing = Object.entries(previous).filter(([key]) => !pulled[key]);
  if (missing.length === 0) return;

  const merged = [
    pulledContent.trimEnd(),
    '',
    '# Configurações locais preservadas pelo setup',
    ...missing.map(([key, value]) => `${key}=${quoteEnv(value)}`),
    '',
  ].filter((line, index) => !(index === 0 && line === '')).join('\n');
  fs.writeFileSync(envLocalPath, merged, { mode: 0o600 });
}

function main() {
  console.log('Configuração local da Pousada Delplata');
  const databaseAlreadyExists = fs.existsSync(localDatabasePath);
  const previousLocalContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : '';

  run(isWindows ? 'npm.cmd' : 'npm', ['ci']);

  run(isWindows ? 'npx.cmd' : 'npx', [
    '--yes',
    'vercel@60.1.3',
    'link',
    '--yes',
    '--project',
    'pousada-delplata',
    '--scope',
    'caiopires92s-projects',
  ]);

  run(isWindows ? 'npx.cmd' : 'npx', [
    '--yes',
    'vercel@60.1.3',
    'env',
    'pull',
    '.env.local',
    '--environment=development',
    '--yes',
  ]);

  restoreLocalOverrides(previousLocalContent);
  const localEnv = ensureLocalDefaults();
  const childEnv = { ...process.env, ...localEnv };

  run(isWindows ? 'npx.cmd' : 'npx', ['prisma', 'migrate', 'deploy'], { env: childEnv });

  if (!databaseAlreadyExists) {
    run(isWindows ? 'node.exe' : 'node', ['prisma/seed.js'], { env: childEnv });
  }

  console.log('\nConfiguração concluída. Inicie o projeto com: npm run dev:web');
  console.log('O arquivo .env.local foi criado localmente e não será enviado ao Git.');
}

try {
  main();
} catch (error) {
  console.error(`\nFalha na configuração: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
