const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

const databaseUrl = process.env.DATABASE_URL || '';
const authToken = process.env.DATABASE_AUTH_TOKEN || '';
const isTurso = databaseUrl.startsWith('libsql:') || databaseUrl.startsWith('wss:');
const isDryRun = process.argv.includes('--dry-run');
const isConfirmed = process.argv.includes('--confirm=YES');

let prisma;

if (isTurso) {
    if (!authToken) {
        console.error('DATABASE_AUTH_TOKEN is required for Turso.');
        process.exit(1);
    }

    const libsql = createClient({
        url: databaseUrl.split('?')[0],
        authToken,
    });
    prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });
} else {
    prisma = new PrismaClient();
}

const mappings = [
    { name: 'Apartamento Térreo', externalId: '3020' },
    { name: 'Apartamento Superior', externalId: '49046' },
    { name: 'Chalé', externalId: '49047' },
    { name: 'Apartamento Anexo', externalId: '153056' },
];

async function seedHospedinIds() {
    console.log('🌱 Seeding Hospedin External IDs...');
    console.log(`Target database: ${isTurso ? databaseUrl.replace(/^libsql:\/\//, '').split('?')[0] : databaseUrl || 'default Prisma datasource'}`);

    if (!isDryRun && !isConfirmed) {
        throw new Error('Refusing to update database without --confirm=YES. Use --dry-run to preview changes.');
    }
    
    for (const mapping of mappings) {
        const room = await prisma.roomType.findFirst({
            where: { name: mapping.name },
            select: {
                id: true,
                name: true,
                externalId: true,
            },
        });

        if (room) {
            const currentExternalId = room.externalId || null;
            const action = currentExternalId === mapping.externalId ? 'OK' : (isDryRun ? 'WOULD UPDATE' : 'Updating');
            console.log(`${action}: ${mapping.name} externalId ${currentExternalId || '(empty)'} -> ${mapping.externalId}`);

            if (!isDryRun && currentExternalId !== mapping.externalId) {
                await prisma.roomType.update({
                    where: { id: room.id },
                    data: { externalId: mapping.externalId }
                });
            }
        } else {
            console.warn(`⚠️ Room not found: ${mapping.name}`);
        }
    }

    console.log(isDryRun ? '✅ Dry run complete!' : '✅ Done!');
}

seedHospedinIds()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
