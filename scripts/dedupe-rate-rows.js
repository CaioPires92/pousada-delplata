const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL || '';
const authToken = process.env.DATABASE_AUTH_TOKEN || '';
const isRemoteLibsql = databaseUrl.startsWith('libsql:') || databaseUrl.startsWith('wss:');
const isDryRun = process.argv.includes('--dry-run');
const isConfirmed = process.argv.includes('--confirm=YES');

if (!databaseUrl || (isRemoteLibsql && !authToken)) {
  console.error('Missing DATABASE_URL or DATABASE_AUTH_TOKEN');
  process.exit(1);
}

if (!isDryRun && !isConfirmed) {
  console.error('Refusing to delete duplicate Rate rows without --confirm=YES. Use --dry-run first.');
  process.exit(1);
}

const client = createClient(
  isRemoteLibsql
    ? { url: databaseUrl.split('?')[0], authToken }
    : { url: databaseUrl.split('?')[0] }
);

async function getDuplicateRows() {
  const result = await client.execute(`
    SELECT r.id,
           r.roomTypeId,
           rt.name AS roomName,
           r.startDate,
           r.endDate,
           r.price,
           r.cta,
           r.ctd,
           r.stopSell,
           r.minLos,
           r.createdAt,
           r.updatedAt
    FROM Rate r
    JOIN (
      SELECT roomTypeId, startDate, endDate
      FROM Rate
      GROUP BY roomTypeId, startDate, endDate
      HAVING COUNT(*) > 1
    ) d ON d.roomTypeId = r.roomTypeId AND d.startDate = r.startDate AND d.endDate = r.endDate
    LEFT JOIN RoomType rt ON rt.id = r.roomTypeId
    ORDER BY r.roomTypeId, r.startDate, r.endDate, r.updatedAt DESC, r.createdAt DESC, r.id DESC
  `);

  return result.rows || [];
}

function chooseRowsToDelete(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = `${row.roomTypeId}|${row.startDate}|${row.endDate}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const keep = [];
  const remove = [];
  const conflicts = [];

  for (const list of groups.values()) {
    const configs = new Set(list.map((row) => [
      row.price,
      row.cta,
      row.ctd,
      row.stopSell,
      row.minLos,
    ].join('|')));

    if (configs.size > 1) {
      conflicts.push(list);
      continue;
    }

    keep.push(list[0]);
    remove.push(...list.slice(1));
  }

  return { keep, remove, conflicts };
}

async function main() {
  const database = databaseUrl.replace(/^libsql:\/\//, '').split('?')[0];
  const rows = await getDuplicateRows();
  const { keep, remove, conflicts } = chooseRowsToDelete(rows);

  console.log(JSON.stringify({
    database,
    duplicateGroups: keep.length + conflicts.length,
    rowsToKeep: keep.length,
    rowsToDelete: remove.length,
    conflictGroups: conflicts.length,
    sampleDeletes: remove.slice(0, 10),
  }, null, 2));

  if (conflicts.length > 0) {
    throw new Error('Duplicate Rate groups have conflicting values. Resolve manually before dedupe.');
  }

  if (isDryRun) {
    console.log('Dry run complete. No rows deleted.');
    return;
  }

  for (const row of remove) {
    await client.execute({
      sql: 'DELETE FROM Rate WHERE id = ?',
      args: [row.id],
    });
  }

  console.log(`Deleted ${remove.length} duplicate Rate rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
