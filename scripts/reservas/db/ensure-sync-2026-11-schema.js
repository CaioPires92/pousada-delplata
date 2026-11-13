// Cria SOMENTE as tabelas, colunas e índices do espelhamento de 2026-11 (Villa/Refúgio → Delplata) que faltarem.
// Não altera nem apaga dados e não usa o histórico _app_migrations (que pode marcar migrações como aplicadas
// sem executá-las quando o banco não tem histórico).
//
// Uso (banco remoto Turso):
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... node scripts/reservas/db/ensure-sync-2026-11-schema.js \
//     --dry-run --allow-remote --confirm-host=<host do DATABASE_URL>
//   (confira a lista) e depois troque --dry-run por --confirm=YES
//
// Equivale às migrações 20261015120000 .. 20261112220000.
const { createClient } = require('@libsql/client');
require('dotenv').config();
const {
    GuardError,
    parseFlagsStrict,
    sanitizeErrorMessage,
    assertSafeTarget,
    assertWriteConfirmation,
} = require('../../shared/db-safety');

const TABLES = [
    {
        table: 'PaymentAttempt',
        sql: `CREATE TABLE IF NOT EXISTS "PaymentAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "amount" DECIMAL,
    "currency" TEXT,
    "method" TEXT,
    "cardBrand" TEXT,
    "installments" INTEGER,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentAttempt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`,
    },
    {
        table: 'Promotion',
        sql: `CREATE TABLE IF NOT EXISTS "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "badgeLabel" TEXT,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "discountPercent" DECIMAL NOT NULL,
    "maxDiscountAmount" DECIMAL,
    "minDaysBeforeCheckIn" INTEGER,
    "maxDaysBeforeCheckIn" INTEGER,
    "stayStart" DATETIME,
    "stayEnd" DATETIME,
    "bookableFrom" DATETIME,
    "bookableUntil" DATETIME,
    "minNights" INTEGER,
    "allowedRoomTypeIds" TEXT,
    "stackWithCoupons" BOOLEAN NOT NULL DEFAULT false,
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
)`,
    },
];

const COLUMNS = [
    { table: 'Booking', column: 'hospedinReservationId', type: 'TEXT' },
    { table: 'Booking', column: 'hospedinRegisteredAt', type: 'DATETIME' },
    { table: 'Booking', column: 'pets', type: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'Booking', column: 'promotionId', type: 'TEXT' },
    { table: 'Booking', column: 'promotionName', type: 'TEXT' },
    { table: 'Booking', column: 'promotionDiscount', type: 'DECIMAL' },
    { table: 'Booking', column: 'promotionBreakdown', type: 'TEXT' },
    { table: 'Booking', column: 'paymentDeadlineAt', type: 'DATETIME' },
    { table: 'InventoryAdjustment', column: 'hospedinUnits', type: 'INTEGER' },
    { table: 'InventoryAdjustment', column: 'manualOverrideUnits', type: 'INTEGER' },
    { table: 'InventoryAdjustment', column: 'hospedinSyncedAt', type: 'DATETIME' },
    { table: 'Promotion', column: 'allowedCouponIds', type: 'TEXT' },
    { table: 'Promotion', column: 'allowedPromotionIds', type: 'TEXT' },
    { table: 'Promotion', column: 'stackWithPromotions', type: 'BOOLEAN NOT NULL DEFAULT false' },
    { table: 'Promotion', column: 'audience', type: "TEXT NOT NULL DEFAULT 'all'" },
    { table: 'Promotion', column: 'showBadge', type: 'BOOLEAN NOT NULL DEFAULT true' },
    { table: 'Promotion', column: 'excludedStayDates', type: 'TEXT' },
    { table: 'Promotion', column: 'daysOfWeek', type: 'TEXT' },
];

const INDEXES = [
    { name: 'Booking_hospedinRegisteredAt_idx', sql: 'CREATE INDEX IF NOT EXISTS "Booking_hospedinRegisteredAt_idx" ON "Booking"("hospedinRegisteredAt")' },
    { name: 'Booking_status_paymentDeadlineAt_idx', sql: 'CREATE INDEX IF NOT EXISTS "Booking_status_paymentDeadlineAt_idx" ON "Booking"("status", "paymentDeadlineAt")' },
    { name: 'PaymentAttempt_providerPaymentId_key', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAttempt_providerPaymentId_key" ON "PaymentAttempt"("providerPaymentId")' },
    { name: 'PaymentAttempt_bookingId_createdAt_idx', sql: 'CREATE INDEX IF NOT EXISTS "PaymentAttempt_bookingId_createdAt_idx" ON "PaymentAttempt"("bookingId", "createdAt")' },
    { name: 'PaymentAttempt_status_createdAt_idx', sql: 'CREATE INDEX IF NOT EXISTS "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt")' },
    { name: 'Promotion_active_idx', sql: 'CREATE INDEX IF NOT EXISTS "Promotion_active_idx" ON "Promotion"("active")' },
    { name: 'Promotion_type_idx', sql: 'CREATE INDEX IF NOT EXISTS "Promotion_type_idx" ON "Promotion"("type")' },
];

async function objectExists(client, type, name) {
    const result = await client.execute({ sql: 'SELECT name FROM sqlite_master WHERE type = ? AND name = ?', args: [type, name] });
    return result.rows.length > 0;
}

async function columnsOf(client, table) {
    const result = await client.execute(`PRAGMA table_info("${table}")`);
    return new Set(result.rows.map((row) => String(row.name ?? row[1] ?? '')));
}

// Planeja em ordem: tabelas novas, colunas (inclusive das tabelas novas) e índices.
async function planChanges(client) {
    const plan = [];
    const newTables = new Set();
    for (const { table, sql } of TABLES) {
        if (!(await objectExists(client, 'table', table))) {
            plan.push({ label: `tabela ${table}`, sql });
            newTables.add(table);
        }
    }
    const cache = new Map();
    for (const { table, column, type } of COLUMNS) {
        if (!cache.has(table)) cache.set(table, newTables.has(table) ? new Set(['id']) : await columnsOf(client, table));
        const existing = cache.get(table);
        if (existing.size === 0) throw new GuardError(`tabela ${table} não encontrada; abortando sem alterar nada.`, 3);
        if (!existing.has(column)) plan.push({ label: `${table}.${column}`, sql: `ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}` });
    }
    for (const { name, sql } of INDEXES) {
        if (!(await objectExists(client, 'index', name))) plan.push({ label: `índice ${name}`, sql });
    }
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
        console.log('Nada a fazer: o banco já tem todas as tabelas, colunas e índices.');
        return;
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}Alterações necessárias:`);
    for (const item of plan) console.log(`  - ${item.label}`);
    if (dryRun) {
        console.log('\nNada foi alterado. Rode de novo com --confirm=YES (sem --dry-run) para aplicar.');
        return;
    }

    for (const item of plan) {
        try {
            await client.execute(item.sql);
            console.log(`  ✔ ${item.label}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/duplicate column name|already exists/i.test(message)) {
                console.log(`  [já existia] ${item.label}`);
                continue;
            }
            throw error;
        }
    }
    const remaining = await planChanges(client);
    if (remaining.length > 0) throw new GuardError('verificação final falhou: ainda faltam alterações.', 4);
    console.log('\nConcluído: tabelas, colunas e índices conferidos.');
}

main().catch((error) => {
    const code = error instanceof GuardError ? error.exitCode : 1;
    console.error(`Erro: ${sanitizeErrorMessage(error)}`);
    process.exit(code);
});
