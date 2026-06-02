const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Minimal Hospedin client in JS
async function fetchHospedinAvailability(placeTypeId, beginDate, endDate) {
    const baseUrl = process.env.HOSPEDIN_BASE_URL;
    const email = process.env.HOSPEDIN_EMAIL;
    const pass = process.env.HOSPEDIN_PASSWORD;
    const accountId = process.env.HOSPEDIN_ACCOUNT_ID;

    // 1. Authenticate
    const authRes = await fetch(`${baseUrl}/authentication/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
    });

    if (!authRes.ok) throw new Error('Auth failed');
    const { token } = await authRes.json();

    // 2. Get availability
    const url = `${baseUrl}/${accountId}/place_types/${placeTypeId}/rates_and_availabilities?begin_date=${beginDate}&end_date=${endDate}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`API failed for ${placeTypeId}`);
    return await res.json();
}

async function testSync() {
    try {
        console.log('Starting manual sync test in WSL...');
        
        const roomTypes = await prisma.roomType.findMany({
            where: { externalId: { not: null } }
        });
        
        if (roomTypes.length === 0) {
            console.error('No room types with external IDs found.');
            return;
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + 30);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        for (const roomType of roomTypes) {
            console.log(`Syncing ${roomType.name} (ID: ${roomType.externalId})...`);
            
            const availability = await fetchHospedinAvailability(roomType.externalId, startStr, endStr);
            
            for (const day of availability) {
                // Rule: <= 2 -> stopSell = true
                const stopSell = day.availability <= 2;
                
                const date = new Date(day.date + 'T00:00:00Z');
                const nextDate = new Date(date);
                nextDate.setUTCDate(date.getUTCDate() + 1);

                await prisma.rate.upsert({
                    where: {
                        roomTypeId_startDate_endDate: {
                            roomTypeId: roomType.id,
                            startDate: date,
                            endDate: nextDate
                        }
                    },
                    update: { stopSell },
                    create: {
                        roomTypeId: roomType.id,
                        startDate: date,
                        endDate: nextDate,
                        price: roomType.basePrice,
                        stopSell,
                        minLos: 1
                    }
                });
            }
        }

        console.log('✅ Sync successful!');
    } catch (e) {
        console.error('❌ Sync failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

testSync();
