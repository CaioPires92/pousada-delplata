// Define o externalId (Hospedin) dos tipos de quarto.
//
// Uso (sempre dry-run primeiro; o plano devolvido é exigido na execução real):
//   node scripts/reservas/db/seed-hospedin-ids.js --dry-run
//   node scripts/reservas/db/seed-hospedin-ids.js --confirm=YES --expect-plan=<plan do dry-run>
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

const mappings = [
    { name: 'Apartamento Térreo', externalId: '3020' },
    { name: 'Apartamento Superior', externalId: '49046' },
    { name: 'Chalé', externalId: '49047' },
    { name: 'Apartamento Anexo', externalId: '153056' },
];

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @param {() => Promise<any>} loadPrisma carregado somente depois que todas as proteções passam
 * @param {{ log: (l: string) => void, error: (l: string) => void }} io
 * @returns {Promise<number>} código de saída
 */
async function run(argv, env, loadPrisma, io) {
    let prisma;
    try {
        const flags = parseFlagsStrict(argv, { value: COMMON_VALUE_FLAGS, boolean: COMMON_BOOLEAN_FLAGS });
        const dryRun = flags['dry-run'] === true;

        assertWriteConfirmation(flags, dryRun);
        const target = assertSafeTarget(env.DATABASE_URL, flags);
        if (!dryRun) assertPlanFlagPresent(flags);
        if (target.kind === 'remote' && !env.DATABASE_AUTH_TOKEN) {
            throw new GuardError('DATABASE_AUTH_TOKEN is required for Turso.', 1);
        }

        io.log('Seeding Hospedin External IDs...');
        io.log(`Target database: ${target.label}`);

        prisma = await loadPrisma();

        const changes = [];
        for (const mapping of mappings) {
            const room = await prisma.roomType.findFirst({
                where: { name: mapping.name },
                select: { id: true, name: true, externalId: true },
            });
            if (!room) {
                io.log(`Room not found: ${mapping.name}`);
                continue;
            }
            const currentExternalId = room.externalId || null;
            if (currentExternalId === mapping.externalId) {
                io.log(`OK: ${mapping.name} externalId ${currentExternalId}`);
            } else {
                io.log(`${dryRun ? 'WOULD UPDATE' : 'Updating'}: ${mapping.name} externalId ${currentExternalId || '(empty)'} -> ${mapping.externalId}`);
                changes.push({ id: String(room.id), from: currentExternalId, to: mapping.externalId });
            }
        }

        const plan = planHash({ target: target.label, db: targetFingerprint(env.DATABASE_URL), changes });
        io.log(`plan=${plan}`);

        if (dryRun) {
            io.log('Dry run complete!');
            return 0;
        }

        assertPlanMatches(flags, plan);
        for (const change of changes) {
            await prisma.roomType.update({ where: { id: change.id }, data: { externalId: change.to } });
        }
        io.log('Done!');
        return 0;
    } catch (error) {
        if (error instanceof GuardError) {
            io.error(error.message);
            return error.exitCode;
        }
        io.error(`erro: ${sanitizeErrorMessage(error)}`);
        return 5;
    } finally {
        if (prisma) await prisma.$disconnect().catch(() => undefined);
    }
}

module.exports = { run, mappings };

if (require.main === module) {
    const { PrismaClient } = require('@prisma/client');
    const { PrismaLibSQL } = require('@prisma/adapter-libsql');
    const { createClient } = require('@libsql/client');
    const loadPrisma = async () => {
        const url = String(process.env.DATABASE_URL || '');
        if (url.startsWith('libsql:') || url.startsWith('wss:')) {
            const libsql = createClient({ url: url.split('?')[0], authToken: process.env.DATABASE_AUTH_TOKEN });
            return new PrismaClient({ adapter: new PrismaLibSQL(libsql) });
        }
        return new PrismaClient();
    };
    run(process.argv.slice(2), process.env, loadPrisma, {
        log: (line) => console.log(line),
        error: (line) => console.error(line),
    }).then((code) => process.exit(code));
}
