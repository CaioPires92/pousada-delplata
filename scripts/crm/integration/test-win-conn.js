const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        console.log('Testing connection from Windows...');
        const roomTypes = await prisma.roomType.findMany();
        console.log(`Found ${roomTypes.length} room types.`);
        roomTypes.forEach(r => console.log(`- ${r.name} (External ID: ${r.externalId})`));
        
        const ratesCount = await prisma.rate.count();
        console.log(`Found ${ratesCount} rates.`);
        
        console.log('Connection successful!');
    } catch (e) {
        console.error('Connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
