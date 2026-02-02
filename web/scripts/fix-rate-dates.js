const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

async function main() {
    console.log('--- Normalizing Rate dates to strictly YYYY-MM-DD ---');

    let prisma;
    const databaseUrl = process.env.DATABASE_URL;
    const shouldUseTurso =
        typeof databaseUrl === 'string' &&
        databaseUrl.length > 0 &&
        !databaseUrl.startsWith('file:') &&
        typeof process.env.DATABASE_AUTH_TOKEN === 'string' &&
        process.env.DATABASE_AUTH_TOKEN.length > 0;

    if (shouldUseTurso) {
        console.log('Using Turso/LibSQL Adapter');
        const libsql = createClient({
            url: databaseUrl,
            authToken: process.env.DATABASE_AUTH_TOKEN,
        });
        const adapter = new PrismaLibSQL(libsql);
        prisma = new PrismaClient({ adapter });
    } else {
        console.log('Using Standard Connection (SQLite)');
        prisma = new PrismaClient();
    }

    try {
        // 1. Count rows with "bad" formats (anything longer than 10 chars, typically containing time info)
        // We check for length > 10 which covers both 'T' ISO format and ' ' SQL format.
        const countStart = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM Rate 
      WHERE startDate IS NOT NULL AND length(startDate) > 10
    `;
        const countEnd = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM Rate 
      WHERE endDate IS NOT NULL AND length(endDate) > 10
    `;

        console.log(`Found ${Number(countStart[0].count)} rates with extended startDate (time/ISO)`);
        console.log(`Found ${Number(countEnd[0].count)} rates with extended endDate (time/ISO)`);

        if (Number(countStart[0].count) === 0 && Number(countEnd[0].count) === 0) {
            console.log('No updates needed. All dates are already YYYY-MM-DD (len=10).');
            return;
        }

        // 2. Update startDate: Take substring(1, 10)
        if (Number(countStart[0].count) > 0) {
            console.log('Truncating startDate to 10 chars...');
            // SQLite/LibSQL substr is 1-based index
            const updatedStart = await prisma.$executeRaw`
        UPDATE Rate
        SET startDate = substr(startDate, 1, 10)
        WHERE startDate IS NOT NULL AND length(startDate) > 10
      `;
            console.log(`Updated rows (startDate):`, updatedStart);
        }

        // 3. Update endDate: Take substring(1, 10)
        if (Number(countEnd[0].count) > 0) {
            console.log('Truncating endDate to 10 chars...');
            const updatedEnd = await prisma.$executeRaw`
        UPDATE Rate
        SET endDate = substr(endDate, 1, 10)
        WHERE endDate IS NOT NULL AND length(endDate) > 10
      `;
            console.log(`Updated rows (endDate):`, updatedEnd);
        }

        // 4. Verify
        const verifyStart = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM Rate 
      WHERE startDate IS NOT NULL AND length(startDate) > 10
    `;
        console.log(`Remaining extended startDate: ${Number(verifyStart[0].count)}`);

    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
