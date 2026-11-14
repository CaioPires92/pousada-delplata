// Remove linhas duplicadas de Rate (mesmo roomTypeId/startDate/endDate e mesma configuração).
//
// Uso (sempre dry-run primeiro; o plano devolvido é exigido na execução real):
//   node scripts/reservas/db/dedupe-rate-rows.js --dry-run
//   node scripts/reservas/db/dedupe-rate-rows.js --confirm=YES --expect-plan=<plan do dry-run>
// Banco remoto (inclusive o dry-run): acrescente --allow-remote --confirm-host=<hostname do banco>.
const {
  GuardError,
  parseFlagsStrict,
  sanitizeErrorMessage,
  assertSafeTarget,
  assertWriteConfirmation,
  assertPlanFlagPresent,
  assertPlanMatches,
  planHash,
  targetFingerprint,
  COMMON_VALUE_FLAGS,
  COMMON_BOOLEAN_FLAGS,
} = require('../../shared/db-safety');

async function getDuplicateRows(client) {
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

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @param {(options: { url: string, authToken?: string }) => { execute: (q: unknown) => Promise<{ rows?: any[] }> }} createDbClient
 * @param {{ log: (l: string) => void, error: (l: string) => void }} io
 * @returns {Promise<number>} código de saída
 */
async function run(argv, env, createDbClient, io) {
  try {
    const flags = parseFlagsStrict(argv, { value: COMMON_VALUE_FLAGS, boolean: COMMON_BOOLEAN_FLAGS });
    const dryRun = flags['dry-run'] === true;

    assertWriteConfirmation(flags, dryRun);
    const target = assertSafeTarget(env.DATABASE_URL, flags);
    if (!dryRun) assertPlanFlagPresent(flags);

    const databaseUrl = String(env.DATABASE_URL || '');
    const authToken = env.DATABASE_AUTH_TOKEN || '';
    if (target.kind === 'remote' && !authToken) {
      throw new GuardError('DATABASE_AUTH_TOKEN ausente para banco remoto.', 1);
    }

    const client = createDbClient(
      target.kind === 'remote' ? { url: databaseUrl.split('?')[0], authToken } : { url: databaseUrl.split('?')[0] }
    );

    const rows = await getDuplicateRows(client);
    const { keep, remove, conflicts } = chooseRowsToDelete(rows);
    const plan = planHash({ target: target.label, db: targetFingerprint(env.DATABASE_URL), delete: remove.map((row) => String(row.id)).sort() });

    io.log(JSON.stringify({
      database: target.label,
      duplicateGroups: keep.length + conflicts.length,
      rowsToKeep: keep.length,
      rowsToDelete: remove.length,
      conflictGroups: conflicts.length,
      sampleDeletes: remove.slice(0, 10),
    }, null, 2));
    io.log(`plan=${plan}`);

    if (conflicts.length > 0) {
      throw new GuardError('Duplicate Rate groups have conflicting values. Resolve manually before dedupe.', 5);
    }

    if (dryRun) {
      io.log('Dry run complete. No rows deleted.');
      return 0;
    }

    assertPlanMatches(flags, plan);

    for (const row of remove) {
      await client.execute({
        sql: 'DELETE FROM Rate WHERE id = ?',
        args: [row.id],
      });
    }

    io.log(`Deleted ${remove.length} duplicate Rate rows.`);
    return 0;
  } catch (error) {
    if (error instanceof GuardError) {
      io.error(error.message);
      return error.exitCode;
    }
    io.error(`erro: ${sanitizeErrorMessage(error)}`);
    return 5;
  }
}

module.exports = { run, chooseRowsToDelete };

if (require.main === module) {
  require('dotenv').config({ path: '.env' });
  const { createClient } = require('@libsql/client');
  run(process.argv.slice(2), process.env, (options) => createClient(options), {
    log: (line) => console.log(line),
    error: (line) => console.error(line),
  }).then((code) => process.exit(code));
}
