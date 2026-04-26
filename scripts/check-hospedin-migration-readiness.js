const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

const url = process.env.DATABASE_URL || '';
const authToken = process.env.DATABASE_AUTH_TOKEN || '';
const isRemoteLibsql = url.startsWith('libsql:') || url.startsWith('wss:');

if (!url || (isRemoteLibsql && !authToken)) {
  console.error('Missing DATABASE_URL or DATABASE_AUTH_TOKEN');
  process.exit(1);
}

const libsqlUrl = url.split('?')[0];
const client = createClient(isRemoteLibsql ? { url: libsqlUrl, authToken } : { url: libsqlUrl });

async function main() {
  const database = url.replace(/^libsql:\/\//, '').split('?')[0];

  const columns = await client.execute('PRAGMA table_info("RoomType")');
  const columnNames = (columns.rows || []).map((row) => String(row.name ?? row[1]));

  const indexes = await client.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'index'
      AND tbl_name = 'Rate'
  `);
  const indexNames = (indexes.rows || []).map((row) => String(row.name ?? row[0]));

  const duplicates = await client.execute(`
    SELECT roomTypeId, startDate, endDate, COUNT(*) AS count
    FROM Rate
    GROUP BY roomTypeId, startDate, endDate
    HAVING COUNT(*) > 1
    LIMIT 5
  `);

  console.log(JSON.stringify({
    database,
    roomTypeExternalId: columnNames.includes('externalId'),
    rateUniqueIndex: indexNames.includes('Rate_roomTypeId_startDate_endDate_key'),
    duplicateRateGroups: (duplicates.rows || []).length,
    duplicateSamples: duplicates.rows || [],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
