const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mappings = [
    { name: 'Apartamento Térreo', externalId: '3020' },
    { name: 'Apartamento Superior', externalId: '49046' },
    { name: 'Chalé', externalId: '49047' },
    { name: 'Apartamento Anexo', externalId: '153056' },
];

async function seedHospedinIds() {
    console.log('🌱 Seeding Hospedin External IDs...');
    
    for (const mapping of mappings) {
        const room = await prisma.roomType.findFirst({
            where: { name: mapping.name }
        });

        if (room) {
            console.log(`Updating ${mapping.name} with externalId: ${mapping.externalId}`);
            await prisma.roomType.update({
                where: { id: room.id },
                data: { externalId: mapping.externalId }
            });
        } else {
            console.warn(`⚠️ Room not found: ${mapping.name}`);
        }
    }

    console.log('✅ Done!');
}

seedHospedinIds()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
