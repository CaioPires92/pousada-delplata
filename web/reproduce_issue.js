const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const payload = {
        roomTypeId: "all",
        startDate: "2026-01-27",
        endDate: "2026-01-30",
        updates: { price: 396, inventory: 2 }
    };

    console.log("Simulating payload:", payload);

    try {
        const { roomTypeId, roomTypes } = payload;
        
        // Simulation of the expansion logic
        let targetRoomIds = [];
        const targetInput = roomTypes || roomTypeId;

        console.log("Target Input:", targetInput);

        if (targetInput === 'all' || (Array.isArray(targetInput) && targetInput.includes('all'))) {
            console.log("Fetching all rooms...");
            const allRooms = await prisma.roomType.findMany({ select: { id: true } });
            targetRoomIds = allRooms.map(r => r.id);
            console.log("Found rooms:", targetRoomIds);
        } else if (Array.isArray(targetInput)) {
            targetRoomIds = targetInput;
        } else {
            targetRoomIds = [targetInput];
        }

        if (targetRoomIds.length === 0) {
            throw new Error("No rooms found");
        }

        // Simulation of transaction loop
        console.log("Starting transaction loop...");
        for (const currentRoomId of targetRoomIds) {
            console.log(`Processing room: ${currentRoomId}`);
            
            // Test findUnique which might be failing if ID is invalid
            const roomType = await prisma.roomType.findUnique({ where: { id: currentRoomId } });
            if (!roomType) console.log(`Warning: Room ${currentRoomId} not found`);
            else console.log(`Room found: ${roomType.name}, Base Price: ${roomType.basePrice}`);
        }

    } catch (e) {
        console.error("Caught error:", e);
        console.error("Stack:", e.stack);
    } finally {
        await prisma.$disconnect();
    }
}

main();