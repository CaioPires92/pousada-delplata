const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url || !authToken) {
    console.error('Missing DATABASE_URL or DATABASE_AUTH_TOKEN');
    process.exit(1);
}

if (!url.startsWith('libsql:') && !url.startsWith('wss:')) {
    console.error('DATABASE_URL must point to Turso (libsql:// or wss://) for this migration script');
    process.exit(1);
}

const libsqlUrl = url.split('?')[0];
const client = createClient({ url: libsqlUrl, authToken });

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

    const addedRoomType = await ensureColumns('RoomType', roomTypeDefs);
    const addedRate = await ensureColumns('Rate', rateDefs);
    const addedRateIndexes = await ensureRateUniqueIndex();

    const totalAdded = addedRoomType + addedRate + addedRateIndexes;
    if (totalAdded === 0) console.log('schema ok');

    console.log('Migration complete.');
}

migrate().catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
});
