const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

require("dotenv").config();

async function main() {
    console.log('--- DIAGNOSIS: Rate Table Schema & Data ---');

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
        console.log('Using Standard Connection (SQLite/local)');
        prisma = new PrismaClient();
    }

    try {
        // 1. Get Table Schema
        const tableInfo = await prisma.$queryRaw`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='Rate'
    `;
        console.log('\n[Schema Definition]:');
        console.log(tableInfo[0]?.sql || 'Table Rate not found in sqlite_master');

        // 2. Get Data Samples
        const samples = await prisma.$queryRaw`
      SELECT id, startDate, endDate, length(startDate) as len 
      FROM Rate 
      LIMIT 10
    `;
        console.log('\n[Data Samples (Limit 10)]:');
        console.table(samples);

    } catch (e) {
        console.error("Diagnostic Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
