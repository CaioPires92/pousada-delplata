// Usage: Run this script with node, ensuring DATABASE_URL is set (Turso/LibSQL).
// Example:
//   cd web
//   node scripts/maintenance/fix-rate-dates-sqlish-to-iso.js
//
// This script normalizes legacy SQL-ish date strings in Rate.startDate/endDate
// to strict ISO UTC "YYYY-MM-DDTHH:mm:ss.000Z" format.
//
// It targets rows like:
//   "YYYY-MM-DD HH:mm:ss +00:00"  -> "YYYY-MM-DDTHH:mm:ss.000Z"
//   "YYYY-MM-DD HH:mm:ss"         -> "YYYY-MM-DDTHH:mm:ss.000Z"
//
// Guardrails: minimal impact, no schema changes or migrations.

const { createClient } = require('@libsql/client');

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url) {
    console.error('Missing DATABASE_URL. Set env vars and run from the "web" directory if needed.');
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  console.log('[fix-rate-dates-sqlish-to-iso] START');

  // Update startDate with timezone suffix " +00:00" to ISO ".000Z"
  await client.execute(`
    UPDATE Rate
    SET startDate = replace(replace(startDate, ' ', 'T'), ' +00:00', '.000Z')
    WHERE startDate LIKE '% +00:00'
  `);

  // Update endDate with timezone suffix " +00:00" to ISO ".000Z"
  await client.execute(`
    UPDATE Rate
    SET endDate = replace(replace(endDate, ' ', 'T'), ' +00:00', '.000Z')
    WHERE endDate LIKE '% +00:00'
  `);

  // Update startDate without timezone but with time component "YYYY-MM-DD HH:mm:ss"
  await client.execute(`
    UPDATE Rate
    SET startDate = replace(startDate, ' ', 'T') || '.000Z'
    WHERE startDate LIKE '% %:%' AND startDate NOT LIKE '%+__:%'
  `);

  // Update endDate without timezone but with time component "YYYY-MM-DD HH:mm:ss"
  await client.execute(`
    UPDATE Rate
    SET endDate = replace(endDate, ' ', 'T') || '.000Z'
    WHERE endDate LIKE '% %:%' AND endDate NOT LIKE '%+__:%'
  `);

  const rows = await client.execute(`
    SELECT id, roomTypeId, startDate, endDate
    FROM Rate
    ORDER BY id
    LIMIT 10
  `);
  console.log('[fix-rate-dates-sqlish-to-iso] SAMPLE', rows.rows);

  console.log('[fix-rate-dates-sqlish-to-iso] DONE');
}

main().catch((err) => {
  console.error('[fix-rate-dates-sqlish-to-iso] ERROR', err);
  process.exit(1);
});
