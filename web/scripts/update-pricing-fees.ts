// Script para atualizar taxas de preços dos quartos
// Execute com: npx tsx scripts/update-pricing-fees.ts

import { config } from 'dotenv';
config(); // Load .env file

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Atualizando taxas de preços...\n');

    // Atualizar todos os quartos com as novas taxas
    const result = await prisma.roomType.updateMany({
        data: {
            extraAdultFee: 100.00,  // R$ 100 por adulto extra (incluindo crianças >= 12 anos)
            child6To11Fee: 80.00,   // R$ 80 por criança de 6 a 11 anos
        },
    });

    console.log(`✅ ${result.count} quarto(s) atualizado(s)\n`);

    // Verificar as mudanças
    const rooms = await prisma.roomType.findMany({
        select: {
            id: true,
            name: true,
            basePrice: true,
            extraAdultFee: true,
            child6To11Fee: true,
            includedAdults: true,
            maxGuests: true,
        },
    });

    console.log('📋 Quartos atualizados:\n');
    rooms.forEach((room) => {
        console.log(`  ${room.name}:`);
        console.log(`    - Preço base: R$ ${Number(room.basePrice).toFixed(2)}`);
        console.log(`    - Taxa adulto extra: R$ ${Number(room.extraAdultFee).toFixed(2)}`);
        console.log(`    - Taxa criança 6-11: R$ ${Number(room.child6To11Fee).toFixed(2)}`);
        console.log(`    - Adultos incluídos: ${room.includedAdults}`);
        console.log(`    - Máximo de hóspedes: ${room.maxGuests}\n`);
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('❌ Erro:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
