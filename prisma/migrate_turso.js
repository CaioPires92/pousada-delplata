const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config({ path: '.env' });

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url || !authToken) {
    if (!url || !url.startsWith('file:')) {
        console.error('Missing DATABASE_URL or DATABASE_AUTH_TOKEN');
        process.exit(1);
    }
}

if (url.startsWith('file:')) {
    console.log(`Using local SQLite database: ${url}`);
} else if (!url.startsWith('libsql:') && !url.startsWith('wss:')) {
    console.error('DATABASE_URL must point to Turso/LibSQL (libsql:// or wss://) or local SQLite (file:) for this migration script');
    process.exit(1);
}

function resolveDatabaseUrl(databaseUrl) {
    const [baseUrl] = databaseUrl.split('?');
    if (!baseUrl.startsWith('file:')) return baseUrl;

    const rawPath = baseUrl.slice('file:'.length);
    if (!rawPath || path.isAbsolute(rawPath)) return baseUrl;

    const resolvedPath = path.resolve(__dirname, rawPath);
    return `file:${resolvedPath}`;
}

const libsqlUrl = resolveDatabaseUrl(url);
const client = createClient(authToken ? { url: libsqlUrl, authToken } : { url: libsqlUrl });

async function getColumns(table) {
    const res = await client.execute(`PRAGMA table_info("${table}")`);
    const cols = new Set();
    for (const row of res.rows || []) {
        const name = (row && (row.name ?? row[1] ?? row.column ?? row[0])) ?? null;
        if (name) cols.add(String(name));
    }
    return cols;
}

async function ensureColumns(table, defs) {
    const cols = await getColumns(table);
    let added = 0;
    for (const def of defs) {
        if (cols.has(def.name)) {
            console.log(`OK: ${table}.${def.name}`);
            continue;
        }
        await client.execute(def.ddl);
        cols.add(def.name);
        console.log(`ADDED: ${table}.${def.name}`);
        added++;
    }
    return added;
}

async function ensureTable(tableName, ddl) {
    const existing = await client.execute({
        sql: `
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
            LIMIT 1
        `,
        args: [tableName],
    });

    if ((existing.rows || []).length > 0) {
        console.log(`OK: table ${tableName}`);
        return 0;
    }

    await client.execute(ddl);
    console.log(`ADDED: table ${tableName}`);
    return 1;
}

async function getIndexes(table) {
    const res = await client.execute({
        sql: `
            SELECT name
            FROM sqlite_master
            WHERE type = 'index'
              AND tbl_name = ?
        `,
        args: [table],
    });
    const indexes = new Set();
    for (const row of res.rows || []) {
        const name = (row && (row.name ?? row[0])) ?? null;
        if (name) indexes.add(String(name));
    }
    return indexes;
}

async function ensureRateUniqueIndex() {
    const indexName = 'Rate_roomTypeId_startDate_endDate_key';
    const indexes = await getIndexes('Rate');
    if (indexes.has(indexName)) {
        console.log(`OK: ${indexName}`);
        return 0;
    }

    const duplicates = await client.execute(`
        SELECT roomTypeId, startDate, endDate, COUNT(*) AS count
        FROM Rate
        GROUP BY roomTypeId, startDate, endDate
        HAVING COUNT(*) > 1
        LIMIT 5
    `);

    if ((duplicates.rows || []).length > 0) {
        console.error('Duplicate Rate rows found. Resolve these before creating the unique index:');
        console.error(duplicates.rows);
        throw new Error(`Cannot create ${indexName} while duplicate Rate rows exist`);
    }

    await client.execute(
        'CREATE UNIQUE INDEX "Rate_roomTypeId_startDate_endDate_key" ON "Rate"("roomTypeId", "startDate", "endDate")'
    );
    console.log(`ADDED: ${indexName}`);
    return 1;
}

async function migrate() {
    console.log('Turso migration: checking schema drift...');

    const roomTypeDefs = [
        { name: 'maxGuests', ddl: 'ALTER TABLE RoomType ADD COLUMN maxGuests INTEGER NOT NULL DEFAULT 3' },
        { name: 'inventoryFor4Guests', ddl: 'ALTER TABLE RoomType ADD COLUMN inventoryFor4Guests INTEGER NOT NULL DEFAULT 0' },
        { name: 'includedAdults', ddl: 'ALTER TABLE RoomType ADD COLUMN includedAdults INTEGER NOT NULL DEFAULT 2' },
        { name: 'totalUnits', ddl: 'ALTER TABLE RoomType ADD COLUMN totalUnits INTEGER NOT NULL DEFAULT 1' },
        { name: 'extraAdultFee', ddl: 'ALTER TABLE RoomType ADD COLUMN extraAdultFee NUMERIC NOT NULL DEFAULT 0' },
        { name: 'child6To11Fee', ddl: 'ALTER TABLE RoomType ADD COLUMN child6To11Fee NUMERIC NOT NULL DEFAULT 0' },
        { name: 'externalId', ddl: 'ALTER TABLE RoomType ADD COLUMN externalId TEXT' },
    ];
    const rateDefs = [
        { name: 'cta', ddl: 'ALTER TABLE Rate ADD COLUMN cta INTEGER NOT NULL DEFAULT 0' },
        { name: 'ctd', ddl: 'ALTER TABLE Rate ADD COLUMN ctd INTEGER NOT NULL DEFAULT 0' },
        { name: 'stopSell', ddl: 'ALTER TABLE Rate ADD COLUMN stopSell INTEGER NOT NULL DEFAULT 0' },
        { name: 'minLos', ddl: 'ALTER TABLE Rate ADD COLUMN minLos INTEGER NOT NULL DEFAULT 1' },
    ];

    const inventoryAdjustmentDefs = [
        { name: 'occupiedUnits', ddl: 'ALTER TABLE InventoryAdjustment ADD COLUMN occupiedUnits INTEGER NOT NULL DEFAULT 0' },
    ];

    const paymentDefs = [
        { name: 'totalAmount', ddl: 'ALTER TABLE Payment ADD COLUMN totalAmount DECIMAL' },
        { name: 'remainingAmount', ddl: 'ALTER TABLE Payment ADD COLUMN remainingAmount DECIMAL NOT NULL DEFAULT 0' },
        { name: 'paymentMode', ddl: "ALTER TABLE Payment ADD COLUMN paymentMode TEXT NOT NULL DEFAULT 'FULL'" },
        { name: 'balanceDueAt', ddl: 'ALTER TABLE Payment ADD COLUMN balanceDueAt TEXT' },
        { name: 'balanceDueDate', ddl: 'ALTER TABLE Payment ADD COLUMN balanceDueDate DATETIME' },
    ];

    const couponDefs = [
        { name: 'maxUsesPerGuest', ddl: 'ALTER TABLE Coupon ADD COLUMN maxUsesPerGuest INTEGER' },
        { name: 'bindEmail', ddl: 'ALTER TABLE Coupon ADD COLUMN bindEmail TEXT' },
        { name: 'bindPhone', ddl: 'ALTER TABLE Coupon ADD COLUMN bindPhone TEXT' },
        { name: 'originBookingId', ddl: 'ALTER TABLE Coupon ADD COLUMN originBookingId TEXT' },
        { name: 'allowedRoomTypeIds', ddl: 'ALTER TABLE Coupon ADD COLUMN allowedRoomTypeIds TEXT' },
        { name: 'allowedSources', ddl: 'ALTER TABLE Coupon ADD COLUMN allowedSources TEXT' },
        { name: 'singleUse', ddl: 'ALTER TABLE Coupon ADD COLUMN singleUse BOOLEAN NOT NULL DEFAULT true' },
        { name: 'stackable', ddl: 'ALTER TABLE Coupon ADD COLUMN stackable BOOLEAN NOT NULL DEFAULT false' },
    ];

    const pipelineCardDefs = [
        { name: 'bookingId', ddl: 'ALTER TABLE PipelineCard ADD COLUMN bookingId TEXT' },
        { name: 'estimatedValue', ddl: 'ALTER TABLE PipelineCard ADD COLUMN estimatedValue REAL' },
        { name: 'intendedArrival', ddl: 'ALTER TABLE PipelineCard ADD COLUMN intendedArrival DATETIME' },
        { name: 'lossReason', ddl: 'ALTER TABLE PipelineCard ADD COLUMN lossReason TEXT' },
        { name: 'intendedCheckin', ddl: 'ALTER TABLE PipelineCard ADD COLUMN intendedCheckin DATETIME' },
        { name: 'intendedCheckout', ddl: 'ALTER TABLE PipelineCard ADD COLUMN intendedCheckout DATETIME' },
        { name: 'adults', ddl: 'ALTER TABLE PipelineCard ADD COLUMN adults INTEGER' },
        { name: 'children', ddl: 'ALTER TABLE PipelineCard ADD COLUMN children INTEGER' },
        { name: 'roomTypeInterest', ddl: 'ALTER TABLE PipelineCard ADD COLUMN roomTypeInterest TEXT' },
        { name: 'lostReason', ddl: 'ALTER TABLE PipelineCard ADD COLUMN lostReason TEXT' },
        { name: 'tags', ddl: 'ALTER TABLE PipelineCard ADD COLUMN tags TEXT' },
        { name: 'followUpAt', ddl: 'ALTER TABLE PipelineCard ADD COLUMN followUpAt DATETIME' },
        { name: 'quoteStatus', ddl: 'ALTER TABLE PipelineCard ADD COLUMN quoteStatus TEXT' },
        { name: 'upsellStatus', ddl: 'ALTER TABLE PipelineCard ADD COLUMN upsellStatus TEXT' },
    ];

    const addedRoomType = await ensureColumns('RoomType', roomTypeDefs);
    const addedRate = await ensureColumns('Rate', rateDefs);
    const addedRateIndexes = await ensureRateUniqueIndex();
    const addedInventoryAdjustment = await ensureColumns('InventoryAdjustment', inventoryAdjustmentDefs);
    const addedPipelineCard = await ensureColumns('PipelineCard', pipelineCardDefs);
    const addedCoupon = await ensureColumns('Coupon', couponDefs);
    const addedPartialPaymentSettings = await ensureTable('PartialPaymentSettings', `
        CREATE TABLE "PartialPaymentSettings" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "enabled" BOOLEAN NOT NULL DEFAULT false,
            "percentage" INTEGER NOT NULL DEFAULT 50,
            "minimumBookingAmount" DECIMAL,
            "minimumLeadTimeDays" INTEGER,
            "balanceDueAt" TEXT NOT NULL DEFAULT 'CHECK_IN',
            "balanceDueDaysBeforeCheckIn" INTEGER,
            "defaultPaymentMode" TEXT NOT NULL DEFAULT 'FULL',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL
        )
    `);
    const addedDiscountPolicySettings = await ensureTable('DiscountPolicySettings', `
        CREATE TABLE "DiscountPolicySettings" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "sendEnabled" BOOLEAN NOT NULL DEFAULT true,
            "percentage" INTEGER NOT NULL DEFAULT 10,
            "validityDays" INTEGER NOT NULL DEFAULT 7,
            "minimumBookingValue" DECIMAL,
            "maximumDiscountAmount" DECIMAL,
            "blockedDateRanges" TEXT NOT NULL DEFAULT '[]',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL
        )
    `);
    const addedPayment = await ensureColumns('Payment', paymentDefs);

    const totalAdded = addedRoomType
        + addedRate
        + addedRateIndexes
        + addedInventoryAdjustment
        + addedPipelineCard
        + addedCoupon
        + addedPartialPaymentSettings
        + addedDiscountPolicySettings
        + addedPayment;
    if (totalAdded === 0) console.log('schema ok');

    console.log('Migration complete.');
}

migrate().catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
});
