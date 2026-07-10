import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const rooms = await prisma.roomType.findMany();
    
    for (const room of rooms) {
        let maxGuests = 4;
        const name = room.name.toLowerCase();
        
        if (name.includes('anexo')) {
            maxGuests = 3;
        } else if (name.includes('térreo') || name.includes('terreo')) {
            maxGuests = 4;
        } else if (name.includes('superior')) {
            maxGuests = 4;
        } else if (name.includes('chalé') || name.includes('chale')) {
            maxGuests = 4;
        }

        await prisma.roomType.update({
            where: { id: room.id },
            data: { maxGuests }
        });
        console.log(`Updated ${room.name} to maxGuests = ${maxGuests}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
