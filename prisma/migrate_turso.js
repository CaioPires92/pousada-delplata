const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url || !authToken) {
    console.error('Missing DATABASE_URL or DATABASE_AUTH_TOKEN');
    process.exit(1);
}

const client = createClient({ url, authToken });

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

async function migrate() {
    console.log('Turso migration: checking schema drift...');

    const roomTypeDefs = [
        { name: 'maxGuests', ddl: 'ALTER TABLE RoomType ADD COLUMN maxGuests INTEGER NOT NULL DEFAULT 3' },
        { name: 'includedAdults', ddl: 'ALTER TABLE RoomType ADD COLUMN includedAdults INTEGER NOT NULL DEFAULT 2' },
        { name: 'totalUnits', ddl: 'ALTER TABLE RoomType ADD COLUMN totalUnits INTEGER NOT NULL DEFAULT 1' },
        { name: 'extraAdultFee', ddl: 'ALTER TABLE RoomType ADD COLUMN extraAdultFee NUMERIC NOT NULL DEFAULT 0' },
        { name: 'child6To11Fee', ddl: 'ALTER TABLE RoomType ADD COLUMN child6To11Fee NUMERIC NOT NULL DEFAULT 0' },
    ];

    const rateDefs = [
        { name: 'cta', ddl: 'ALTER TABLE Rate ADD COLUMN cta INTEGER NOT NULL DEFAULT 0' },
        { name: 'ctd', ddl: 'ALTER TABLE Rate ADD COLUMN ctd INTEGER NOT NULL DEFAULT 0' },
        { name: 'stopSell', ddl: 'ALTER TABLE Rate ADD COLUMN stopSell INTEGER NOT NULL DEFAULT 0' },
        { name: 'minLos', ddl: 'ALTER TABLE Rate ADD COLUMN minLos INTEGER NOT NULL DEFAULT 1' },
    ];

    const addedRoomType = await ensureColumns('RoomType', roomTypeDefs);
    const addedRate = await ensureColumns('Rate', rateDefs);

    const totalAdded = addedRoomType + addedRate;
    if (totalAdded === 0) console.log('schema ok');

    console.log('Migration complete.');
}

migrate().catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
});
