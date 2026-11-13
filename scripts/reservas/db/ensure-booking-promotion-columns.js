// Cria SOMENTE as colunas exigidas pelo prazo de pagamento e pelas promoções novas, se faltarem.
// Não altera nem apaga dados; não roda outras migrações (ex.: as que mudam unidades de quartos).
//
// Uso (banco remoto Turso):
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... node scripts/reservas/db/ensure-booking-promotion-columns.js \
//     --dry-run --allow-remote --confirm-host=<host do DATABASE_URL>
//   (confira a lista) e depois troque --dry-run por --confirm=YES
//
// Equivale às migrações 20261111140000..20261111200000 (Promotion) e 20261112220000 (Booking).
const { createClient } = require('@libsql/client');
require('dotenv').config();
const {
    GuardError,
    parseFlagsStrict,
    sanitizeErrorMessage,
    assertSafeTarget,
    assertWriteConfirmation,
} = require('../../shared/db-safety');

const COLUMNS = [
    { table: 'Promotion', column: 'audience', type: "TEXT NOT NULL DEFAULT 'all'" },
    { table: 'Promotion', column: 'showBadge', type: 'BOOLEAN NOT NULL DEFAULT true' },
    { table: 'Promotion', column: 'excludedStayDates', type: 'TEXT' },
    { table: 'Promotion', column: 'daysOfWeek', type: 'TEXT' },
    { table: 'Booking', column: 'paymentDeadlineAt', type: 'DATETIME' },
];
const INDEX_NAME = 'Booking_status_paymentDeadlineAt_idx';
const INDEX_SQL = `CREATE INDEX IF NOT EXISTS "${INDEX_NAME}" ON "Booking"("status", "paymentDeadlineAt")`;

async function columnsOf(client, table) {
    const result = await client.execute(`PRAGMA table_info("${table}")`);
    return new Set(result.rows.map((row) => String(row.name ?? row[1] ?? '')));
}

async function planChanges(client) {
    const plan = [];
    const cache = new Map();
    for (const { table, column, type } of COLUMNS) {
        if (!cache.has(table)) cache.set(table, await columnsOf(client, table));
        const existing = cache.get(table);
        if (existing.size === 0) throw new GuardError(`tabela ${table} não encontrada; abortando sem alterar nada.`, 3);
        if (!existing.has(column)) plan.push({ kind: 'column', table, column, sql: `ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}` });
    }
    const index = await client.execute({ sql: "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?", args: [INDEX_NAME] });
    if (index.rows.length === 0) plan.push({ kind: 'index', table: 'Booking', column: INDEX_NAME, sql: INDEX_SQL });
    return plan;
}

async function main() {
    const flags = parseFlagsStrict(process.argv.slice(2), {
        value: ['confirm', 'confirm-host'],
        boolean: ['dry-run', 'allow-remote'],
    });
    const dryRun = Boolean(flags['dry-run']);
    assertWriteConfirmation(flags, dryRun);
    assertSafeTarget(process.env.DATABASE_URL, flags);

    const url = String(process.env.DATABASE_URL || '').split('?')[0];
    const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

    const plan = await planChanges(client);
    if (plan.length === 0) {
        console.log('Nada a fazer: todas as colunas e o índice já existem.');
        return;
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}Alterações necessárias:`);
    for (const item of plan) console.log(`  - ${item.table}.${item.column} (${item.kind})`);
    if (dryRun) {
        console.log('\nNada foi alterado. Rode de novo com --confirm=YES (sem --dry-run) para aplicar.');
        return;
    }

    for (const item of plan) {
        try {
            await client.execute(item.sql);
            console.log(`  ✔ ${item.table}.${item.column}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/duplicate column name|already exists/i.test(message)) {
                console.log(`  [já existia] ${item.table}.${item.column}`);
                continue;
            }
            throw error;
        }
    }
    const remaining = await planChanges(client);
    if (remaining.length > 0) throw new GuardError('verificação final falhou: ainda faltam alterações.', 4);
    console.log('\nConcluído: colunas e índice conferidos.');
}

main().catch((error) => {
    const code = error instanceof GuardError ? error.exitCode : 1;
    console.error(`Erro: ${sanitizeErrorMessage(error)}`);
    process.exit(code);
});
