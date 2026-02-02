/**
 * Normaliza Rate.startDate/endDate para 'YYYY-MM-DD' (string) no banco.
 * - Remove hora/timezone cortando os 10 primeiros caracteres
 * - Trim em espaços
 * - Verifica formato final
 *
 * Requisitos:
 * - Prisma Client tipa startDate como string (confirmado no index.d.ts)
 * - Não mexe em schema.prisma nem migração
 */

const { PrismaClient } = require("@prisma/client");
const { PrismaLibSQL } = require("@prisma/adapter-libsql");
const { createClient } = require("@libsql/client");

async function main() {
    console.log("--- FINAL FIX: Normalizing Rate dates to YYYY-MM-DD ---");

    let prisma;
    const databaseUrl = process.env.DATABASE_URL;

    const shouldUseTurso =
        typeof databaseUrl === "string" &&
        databaseUrl.length > 0 &&
        !databaseUrl.startsWith("file:") &&
        typeof process.env.DATABASE_AUTH_TOKEN === "string" &&
        process.env.DATABASE_AUTH_TOKEN.length > 0;

    if (shouldUseTurso) {
        console.log("Using Turso/LibSQL Adapter");
        const libsql = createClient({
            url: databaseUrl,
            authToken: process.env.DATABASE_AUTH_TOKEN,
        });
        const adapter = new PrismaLibSQL(libsql);
        prisma = new PrismaClient({ adapter });
    } else {
        console.log("Using Standard Connection (SQLite/local)");
        prisma = new PrismaClient();
    }

    try {
        // 0) Sanity check: tabela existe?
        // Se isso falhar, o nome real da tabela não é "Rate".
        await prisma.$queryRaw`SELECT 1 FROM Rate LIMIT 1`;
        console.log("Table Rate found ✅");

        // 1) Cortar tudo que tiver mais de 10 chars (remove hora/timezone/ISO)
        const startCut = await prisma.$executeRaw`
      UPDATE Rate
      SET startDate = substr(startDate, 1, 10)
      WHERE startDate IS NOT NULL AND length(startDate) > 10
    `;
        console.log(`startDate truncated (>10): ${startCut}`);

        const endCut = await prisma.$executeRaw`
      UPDATE Rate
      SET endDate = substr(endDate, 1, 10)
      WHERE endDate IS NOT NULL AND length(endDate) > 10
    `;
        console.log(`endDate truncated (>10): ${endCut}`);

        // 2) Trim (remove espaços)
        const startTrim = await prisma.$executeRaw`
      UPDATE Rate
      SET startDate = trim(startDate)
      WHERE startDate IS NOT NULL AND startDate != trim(startDate)
    `;
        console.log(`startDate trimmed: ${startTrim}`);

        const endTrim = await prisma.$executeRaw`
      UPDATE Rate
      SET endDate = trim(endDate)
      WHERE endDate IS NOT NULL AND endDate != trim(endDate)
    `;
        console.log(`endDate trimmed: ${endTrim}`);

        // 3) Verificação: formato final precisa ser EXACTAMENTE YYYY-MM-DD
        // (a) length = 10
        // (b) LIKE '____-__-__' garante posições dos hífens e tamanhos
        // (c) opcional: checar hífens nas posições 5 e 8
        const bad = await prisma.$queryRaw`
      SELECT COUNT(*) AS count
      FROM Rate
      WHERE startDate IS NOT NULL AND (
        length(startDate) != 10 OR
        startDate NOT LIKE '____-__-__' OR
        substr(startDate, 5, 1) != '-' OR
        substr(startDate, 8, 1) != '-'
      )
    `;

        const badCount = Number(bad[0].count);
        console.log(`Bad startDate rows: ${badCount}`);

        if (badCount > 0) {
            const samples = await prisma.$queryRaw`
        SELECT id, startDate
        FROM Rate
        WHERE startDate IS NOT NULL AND (
          length(startDate) != 10 OR
          startDate NOT LIKE '____-__-__' OR
          substr(startDate, 5, 1) != '-' OR
          substr(startDate, 8, 1) != '-'
        )
        LIMIT 20
      `;
            console.log("Bad samples (up to 20):", samples);
            throw new Error("Normalization incomplete: there are still bad startDate values.");
        }

        console.log("✅ Normalization complete: startDate looks consistent (YYYY-MM-DD).");

    } catch (e) {
        console.error("❌ Error:", e);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main();
