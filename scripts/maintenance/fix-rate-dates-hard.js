const { createClient } = require('@libsql/client');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL');
  }
  const client = createClient({ url: databaseUrl, authToken });
    try {
        console.log('[fix-rate-dates-hard] Starting...');

        // Case 1: "YYYY-MM-DD HH:mm:ss +00:00" -> "YYYY-MM-DDTHH:mm:ss+00:00"
    const upd1Start = await client.execute(
      "UPDATE Rate SET startDate = replace(substr(startDate,1,10) || 'T' || substr(startDate,12), ' +', '+') WHERE startDate LIKE '____-__-__ __:__:__ +__:%'"
    );
    const upd1End = await client.execute(
      "UPDATE Rate SET endDate = replace(substr(endDate,1,10) || 'T' || substr(endDate,12), ' +', '+') WHERE endDate LIKE '____-__-__ __:__:__ +__:%'"
    );
    console.log(`[fix-rate-dates-hard] Case1 updated rows: startDate=${upd1Start.rowsAffected ?? 0} endDate=${upd1End.rowsAffected ?? 0}`);

        // Case 2: "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss.000Z"
    const upd2Start = await client.execute(
      "UPDATE Rate SET startDate = substr(startDate,1,10) || 'T' || substr(startDate,12) || '.000Z' WHERE length(startDate) = 19 AND startDate LIKE '____-__-__ __:__:__' AND instr(startDate, '+') = 0 AND instr(startDate, 'T') = 0 AND instr(startDate, 'Z') = 0"
    );
    const upd2End = await client.execute(
      "UPDATE Rate SET endDate = substr(endDate,1,10) || 'T' || substr(endDate,12) || '.000Z' WHERE length(endDate) = 19 AND endDate LIKE '____-__-__ __:__:__' AND instr(endDate, '+') = 0 AND instr(endDate, 'T') = 0 AND instr(endDate, 'Z') = 0"
    );
    console.log(`[fix-rate-dates-hard] Case2 updated rows: startDate=${upd2Start.rowsAffected ?? 0} endDate=${upd2End.rowsAffected ?? 0}`);

        // Case 3: "YYYY-MM-DD" -> "YYYY-MM-DDT00:00:00.000Z"
    const upd3Start = await client.execute(
      "UPDATE Rate SET startDate = startDate || 'T00:00:00.000Z' WHERE length(startDate) = 10 AND startDate LIKE '____-__-__'"
    );
    const upd3End = await client.execute(
      "UPDATE Rate SET endDate = endDate || 'T00:00:00.000Z' WHERE length(endDate) = 10 AND endDate LIKE '____-__-__'"
    );
    console.log(`[fix-rate-dates-hard] Case3 updated rows: startDate=${upd3Start.rowsAffected ?? 0} endDate=${upd3End.rowsAffected ?? 0}`);

        // Audit: count remaining spaces
    const startSpacesRes = await client.execute("SELECT COUNT(*) as count FROM Rate WHERE instr(startDate, ' ') > 0");
    const endSpacesRes = await client.execute("SELECT COUNT(*) as count FROM Rate WHERE instr(endDate, ' ') > 0");
    const startSpaces = startSpacesRes.rows?.[0]?.count ?? startSpacesRes.rows?.[0]?.['COUNT(*)'] ?? 0;
    const endSpaces = endSpacesRes.rows?.[0]?.count ?? endSpacesRes.rows?.[0]?.['COUNT(*)'] ?? 0;
    console.log(`[fix-rate-dates-hard] Remaining spaces: startDate=${startSpaces} endDate=${endSpaces}`);

        // Audit: list up to 20 bad samples
    const samplesRes = await client.execute(
      "SELECT id, startDate, endDate FROM Rate WHERE instr(startDate, ' ') > 0 OR instr(endDate, ' ') > 0 LIMIT 20"
    );
    const samples = samplesRes.rows || [];
        if (Array.isArray(samples) && samples.length > 0) {
            console.log('[fix-rate-dates-hard] Sample bad rows (up to 20):');
            for (const row of samples) {
                console.log(JSON.stringify(row));
            }
        } else {
            console.log('[fix-rate-dates-hard] No remaining rows with spaces detected.');
        }

        console.log('[fix-rate-dates-hard] Done.');
    } catch (err) {
        console.error('[fix-rate-dates-hard] ERROR:', err);
        process.exitCode = 1;
    } finally {
    try { await client.close?.(); } catch {}
    }
}

main();
