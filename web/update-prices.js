require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

let prisma;

if (process.env.DATABASE_AUTH_TOKEN) {
    const libsql = createClient({
        url: process.env.DATABASE_URL,
        authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    prisma = new PrismaClient({ adapter });
} else {
    prisma = new PrismaClient();
}

async function updatePrices() {
    console.log('💰 Updating room prices to R$ 0.10 for testing...');

    await prisma.roomType.updateMany({
        data: {
            basePrice: 0.10,
        },
    });

    console.log('✅ All room prices updated to R$ 0.10');

    const rooms = await prisma.roomType.findMany();
    console.log('\n📋 Current prices:');
    rooms.forEach(room => {
        console.log(`- ${room.name}: R$ ${room.basePrice.toFixed(2)}`);
    });
}

updatePrices()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
