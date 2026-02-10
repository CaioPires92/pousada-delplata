import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkInventory() {
    console.log("--- INICIANDO DIAGNÓSTICO DE BANCO ---");

    // 1. Busca todos os ajustes de inventário
    const adjust = await prisma.inventoryAdjustment.findMany();

    console.log(`Total de registros encontrados: ${adjust.length}`);

    adjust.forEach(a => {
        console.log(`
      ID: ${a.id}
      Data Original: ${a.date}
      ISO String: ${a.date.toISOString()}
      Data Formatada (UTC): ${a.date.getUTCDate()}/${a.date.getUTCMonth() + 1}
      Total Units: ${a.totalUnits} (Tipo: ${typeof a.totalUnits})
    `);
    });

    // 2. Tenta simular a busca do Stop Sell exatamente como no route.ts
    const checkIn = '2026-03-08'; // Mude para a data que você bloqueou
    const start = new Date(`${checkIn}T00:00:00Z`);

    const find = await prisma.inventoryAdjustment.findFirst({
        where: {
            date: start,
            totalUnits: 0
        }
    });

    console.log("--- RESULTADO DA SIMULAÇÃO ---");
    if (find) {
        console.log("✅ SUCESSO: O Prisma encontrou o bloqueio.");
    } else {
        console.log("❌ ERRO: O Prisma não encontrou o registro com esses parâmetros.");
    }
}

checkInventory();