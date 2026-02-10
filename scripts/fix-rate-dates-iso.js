require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaLibSQL } = require("@prisma/adapter-libsql");
const { createClient } = require("@libsql/client");

async function main() {
    console.log("--- FIX: Normalizing Rate dates to ISO (YYYY-MM-DDTHH:MM:SS.mmmZ) ---");

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
        const libsql = createClient({ url: databaseUrl, authToken: process.env.DATABASE_AUTH_TOKEN });
        const adapter = new PrismaLibSQL(libsql);
        prisma = new PrismaClient({ adapter });
    } else {
        console.log("Using Standard Connection (SQLite/local)");
        prisma = new PrismaClient();
    }

    try {
        // 0) Trim geral
        const trimStart = await prisma.$executeRaw`
      UPDATE Rate
      SET startDate = trim(startDate)
      WHERE startDate IS NOT NULL AND startDate != trim(startDate)
    `;
        const trimEnd = await prisma.$executeRaw`
      UPDATE Rate
      SET endDate = trim(endDate)
      WHERE endDate IS NOT NULL AND endDate != trim(endDate)
    `;
        console.log(`Trim startDate: ${trimStart} | Trim endDate: ${trimEnd}`);

        // 1) Se for exatamente YYYY-MM-DD (len 10) -> ISO
        const shortStart = await prisma.$executeRaw`
      UPDATE Rate
      SET startDate = startDate || 'T00:00:00.000Z'
      WHERE startDate IS NOT NULL AND length(startDate) = 10
    `;
        const shortEnd = await prisma.$executeRaw`
      UPDATE Rate
      SET endDate = endDate || 'T00:00:00.000Z'
      WHERE endDate IS NOT NULL AND length(endDate) = 10
    `;
        console.log(`Promoted short startDate: ${shortStart} | short endDate: ${shortEnd}`);

        // 2) Se tiver espaço depois do dia (ex: "YYYY-MM-DD 00:00:00 +00:00") -> pegar substr(1,10) e ISO
        const spacedStart = await prisma.$executeRaw`
      UPDATE Rate
      SET startDate = substr(startDate, 1, 10) || 'T00:00:00.000Z'
      WHERE startDate IS NOT NULL AND length(startDate) > 10 AND substr(startDate, 11, 1) = ' '
    `;
        const spacedEnd = await prisma.$executeRaw`
      UPDATE Rate
      SET endDate = substr(endDate, 1, 10) || 'T00:00:00.000Z'
      WHERE endDate IS NOT NULL AND length(endDate) > 10 AND substr(endDate, 11, 1) = ' '
    `;
        console.log(`Fixed spaced startDate: ${spacedStart} | spaced endDate: ${spacedEnd}`);

        // 3) Se for ISO sem Z (ex: "YYYY-MM-DDTHH:MM:SS") -> adiciona Z (opcional, mas ajuda runtime)
        const addZStart = await prisma.$executeRaw`
      UPDATE Rate
      SET startDate = startDate || 'Z'
      WHERE startDate IS NOT NULL
        AND startDate LIKE '____-__-__T%:%:%'
        AND startDate NOT LIKE '%Z'
    `;
        const addZEnd = await prisma.$executeRaw`
      UPDATE Rate
      SET endDate = endDate || 'Z'
      WHERE endDate IS NOT NULL
        AND endDate LIKE '____-__-__T%:%:%'
        AND endDate NOT LIKE '%Z'
    `;
        console.log(`Added Z startDate: ${addZStart} | endDate: ${addZEnd}`);

        // 4) Verificação: startDate precisa parecer ISO (bem pragmático)
        const bad = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM Rate
      WHERE startDate IS NULL OR (
        startDate NOT LIKE '____-__-__T%:%:%' OR startDate NOT LIKE '%Z'
      )
    `;
        const badCount = Number(bad[0].count);
        console.log(`Bad startDate rows after normalization: ${badCount}`);

        if (badCount > 0) {
            const samples = await prisma.$queryRaw`
        SELECT id, startDate, endDate
        FROM Rate
        WHERE startDate IS NULL OR (
          startDate NOT LIKE '____-__-__T%:%:%' OR startDate NOT LIKE '%Z'
        )
        LIMIT 20
      `;
            console.log("Bad samples (up to 20):", samples);
            throw new Error("Still have invalid startDate values for DateTime runtime.");
        }

        console.log("✅ Done. Rate dates normalized to ISO.");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
});
