const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL || '';
const authToken = process.env.DATABASE_AUTH_TOKEN || '';
const isRemoteLibsql = databaseUrl.startsWith('libsql:') || databaseUrl.startsWith('wss:');

if (!databaseUrl || (isRemoteLibsql && !authToken)) {
  console.error('Missing DATABASE_URL or DATABASE_AUTH_TOKEN');
  process.exit(1);
}

const client = createClient(
  isRemoteLibsql
    ? { url: databaseUrl.split('?')[0], authToken }
    : { url: databaseUrl.split('?')[0] }
);

async function main() {
  const summary = await client.execute(`
    SELECT COUNT(*) AS duplicateGroups, SUM(count - 1) AS extraRows
    FROM (
      SELECT roomTypeId, startDate, endDate, COUNT(*) AS count
      FROM Rate
      GROUP BY roomTypeId, startDate, endDate
      HAVING COUNT(*) > 1
    )
  `);

  const groups = await client.execute(`
    SELECT r.roomTypeId,
           rt.name AS roomName,
           r.startDate,
           r.endDate,
           COUNT(*) AS count,
           COUNT(DISTINCT CAST(r.price AS TEXT) || '|' || CAST(r.cta AS TEXT) || '|' || CAST(r.ctd AS TEXT) || '|' || CAST(r.stopSell AS TEXT) || '|' || CAST(r.minLos AS TEXT)) AS distinctConfigs
    FROM Rate r
    LEFT JOIN RoomType rt ON rt.id = r.roomTypeId
    GROUP BY r.roomTypeId, r.startDate, r.endDate
    HAVING COUNT(*) > 1
    ORDER BY r.startDate
    LIMIT 20
  `);

  const details = await client.execute(`
    SELECT r.id,
           rt.name AS roomName,
           r.roomTypeId,
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
      ORDER BY startDate
      LIMIT 5
    ) d ON d.roomTypeId = r.roomTypeId AND d.startDate = r.startDate AND d.endDate = r.endDate
    LEFT JOIN RoomType rt ON rt.id = r.roomTypeId
    ORDER BY r.startDate, r.updatedAt DESC
  `);

  console.log(JSON.stringify({
    summary: summary.rows[0] || {},
    groups: groups.rows || [],
    details: details.rows || [],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
