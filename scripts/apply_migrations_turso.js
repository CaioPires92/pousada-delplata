const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');
require('dotenv').config();

function getEnv(key) {
  return process.env[key] || '';
}

function ensureTursoEnv() {
  const url = getEnv('DATABASE_URL');
  const token = getEnv('DATABASE_AUTH_TOKEN');
  if (!url || !url.startsWith('libsql://')) {
    throw new Error('DATABASE_URL deve iniciar com libsql:// para aplicar no Turso');
  }
  if (!token) {
    throw new Error('DATABASE_AUTH_TOKEN ausente');
  }
  return { url, token };
}

function listMigrationFiles() {
  const baseDir = path.join(process.cwd(), 'prisma', 'migrations');
  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const files = [];
  for (const dir of entries) {
    const sqlPath = path.join(baseDir, dir, 'migration.sql');
    if (fs.existsSync(sqlPath)) {
      files.push({ dir, sqlPath });
    }
  }
  return files;
}

function splitStatements(sql) {
  // Basic splitter by semicolon; keeps semicolons and trims blanks
  // Not perfect for complex SQL, but Prisma migrations are straightforward.
  const parts = sql
    .split(/;\s*\n/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts;
}

async function applyMigration(client, dir, sqlPath) {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitStatements(sql);
  console.log(`\nApplying migration ${dir} (${statements.length} statements)`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await client.execute(stmt);
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      // Ignore "already exists" type errors to allow re-runs
      if (/already exists/i.test(msg)) {
        console.log(`  [skip ${i + 1}] ${msg}`);
        continue;
      }
      console.error(`  [error ${i + 1}] ${msg}`);
      throw err;
    }
  }
  console.log(`  ✔ Migration ${dir} applied`);
}

async function main() {
  const { url, token } = ensureTursoEnv();
  const client = createClient({ url, authToken: token });
  const migrations = listMigrationFiles();
  if (migrations.length === 0) {
    console.log('Nenhuma migration encontrada em prisma/migrations');
    return;
  }
  for (const m of migrations) {
    await applyMigration(client, m.dir, m.sqlPath);
  }
  console.log('\n✅ Todas as migrations foram aplicadas no Turso');
}

main().catch((err) => {
  console.error('Falha ao aplicar migrations no Turso:', err);
  process.exit(1);
});
