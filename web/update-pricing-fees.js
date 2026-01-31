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

async function updatePricingFees() {
    console.log('💰 Updating room pricing fees...');
    console.log('   - Extra Adult Fee: R$ 100.00 (including children >= 12)');
    console.log('   - Child 6-11 Fee: R$ 80.00\n');

    try {
        // Update all room types with new pricing fees
        const result = await prisma.roomType.updateMany({
            data: {
                extraAdultFee: 100.00,
                child6To11Fee: 80.00,
            },
        });

        console.log(`✅ Updated ${result.count} room type(s)\n`);

        // Display current pricing configuration
        const rooms = await prisma.roomType.findMany();
        console.log('📋 Current Pricing Configuration:');
        console.log('─'.repeat(80));

        rooms.forEach(room => {
            console.log(`\n🏨 ${room.name}`);
            console.log(`   Base Price (2 adults): R$ ${room.basePrice.toFixed(2)}`);
            console.log(`   Extra Adult Fee: R$ ${room.extraAdultFee.toFixed(2)}`);
            console.log(`   Child (6-11) Fee: R$ ${room.child6To11Fee.toFixed(2)}`);
            console.log(`   Max Guests: ${room.maxGuests}`);
            console.log(`   Included Adults: ${room.includedAdults}`);
        });

        console.log('\n' + '─'.repeat(80));
        console.log('💡 Remember: Children >= 12 are counted as adults automatically by the API');
        console.log('💡 Children under 6 stay free');

    } catch (error) {
        console.error('❌ Error updating pricing fees:', error);
        throw error;
    }
}

updatePricingFees()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
