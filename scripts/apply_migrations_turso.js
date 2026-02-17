const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const MIGRATIONS_TABLE = '_app_migrations';

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

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function ensureMigrationsTable(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      "migration_name" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "source" TEXT NOT NULL DEFAULT 'apply'
    )
  `);
}

async function getAppliedMigrations(client) {
  const rows = await client.execute(`
    SELECT migration_name, checksum
    FROM "${MIGRATIONS_TABLE}"
    ORDER BY migration_name
  `);

  const map = new Map();
  for (const row of rows.rows || []) {
    const name = String(row.migration_name ?? row[0] ?? '').trim();
    const hash = String(row.checksum ?? row[1] ?? '').trim();
    if (name) map.set(name, hash);
  }
  return map;
}

async function hasLegacyAppTables(client) {
  const rows = await client.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> '${MIGRATIONS_TABLE}'
      AND name IN ('RoomType', 'Booking', 'Payment', 'Guest', 'Rate', 'InventoryAdjustment', 'AdminUser')
    LIMIT 1
  `);
  return (rows.rows || []).length > 0;
}

async function markMigration(client, dir, hash, source = 'apply') {
  await client.execute({
    sql: `
      INSERT OR REPLACE INTO "${MIGRATIONS_TABLE}" (migration_name, checksum, applied_at, source)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    `,
    args: [dir, hash, source],
  });
}

async function bootstrapBaselineIfNeeded(client, migrations) {
  const applied = await getAppliedMigrations(client);
  if (applied.size > 0) return applied;

  const legacyDbDetected = await hasLegacyAppTables(client);
  if (!legacyDbDetected) return applied;

  console.log('\nLegacy schema detectado sem histórico de migrations. Criando baseline em _app_migrations (sem executar SQL antigo).');
  for (const m of migrations) {
    const sql = fs.readFileSync(m.sqlPath, 'utf8');
    await markMigration(client, m.dir, checksum(sql), 'baseline');
  }

  return getAppliedMigrations(client);
}

async function applyMigration(client, dir, sqlPath) {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const hash = checksum(sql);
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
  await markMigration(client, dir, hash, 'apply');
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

  await ensureMigrationsTable(client);
  const applied = await bootstrapBaselineIfNeeded(client, migrations);

  let appliedCount = 0;
  let skippedCount = 0;
  for (const m of migrations) {
    const sql = fs.readFileSync(m.sqlPath, 'utf8');
    const hash = checksum(sql);
    const appliedHash = applied.get(m.dir);

    if (appliedHash) {
      skippedCount++;
      if (appliedHash !== hash) {
        console.warn(`\n[warn] Migration ${m.dir} já marcada, mas checksum difere do arquivo atual.`);
      } else {
        console.log(`\nSkipping migration ${m.dir} (já aplicada)`);
      }
      continue;
    }

    await applyMigration(client, m.dir, m.sqlPath);
    appliedCount++;
  }

  console.log(`\n✅ Processo finalizado. Aplicadas: ${appliedCount} | Ignoradas: ${skippedCount}`);
}

main().catch((err) => {
  console.error('Falha ao aplicar migrations no Turso:', err);
  process.exit(1);
});
