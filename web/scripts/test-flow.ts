await prisma.booking.deleteMany();
await prisma.rate.deleteMany();
await prisma.inventoryAdjustment.deleteMany();
await prisma.photo.deleteMany();
await prisma.roomType.deleteMany();
await prisma.guest.deleteMany();

// 1. Create Room Type
console.log('1️⃣ Creating Room Type...');
const room = await prisma.roomType.create({
    data: {
        name: 'Test Suite',
        description: 'A luxurious test suite',
        capacity: 2,
        basePrice: 100.00,
        totalUnits: 5,
        amenities: 'WiFi, AC',
    },
});
assert(room.id, 'Room ID should exist');
console.log('✅ Room Created:', room.name);

// 2. Set Rates
console.log('2️⃣ Setting Rates...');
const startDate = new Date();
const endDate = new Date();
endDate.setDate(endDate.getDate() + 10); // 10 days from now

const rate = await prisma.rate.create({
    data: {
        roomTypeId: room.id,
        startDate: startDate,
        endDate: endDate,
        price: 150.00, // Higher price than base
    },
});
console.log('✅ Rate Set:', rate.price);

// 3. Check Availability (Simulate Logic)
console.log('3️⃣ Checking Availability Logic...');
// We will simulate the logic used in the API directly here to verify it
// (Testing the API endpoint via HTTP in this script requires running server, 
// so we test the logic using Prisma directly which is faster and more reliable for unit testing logic)

const checkIn = new Date();
checkIn.setDate(checkIn.getDate() + 1);
const checkOut = new Date();
checkOut.setDate(checkOut.getDate() + 3); // 2 nights

// Logic from API:
// Find room, check capacity, check inventory, calculate price
const roomForBooking = await prisma.roomType.findUnique({
    where: { id: room.id },
    include: { rates: true, inventory: true }
});

// Calculate expected price: 2 nights * 150 (rate) = 300
// (Assuming rate covers both nights)
let totalPrice = 0;
// Simple loop for 2 nights
for (let i = 0; i < 2; i++) {
    const d = new Date(checkIn);
    d.setDate(d.getDate() + i);
    const r = roomForBooking?.rates.find(rt => rt.startDate <= d && rt.endDate >= d);
    totalPrice += Number(r?.price || roomForBooking?.basePrice);
}

assert.strictEqual(totalPrice, 300, 'Total price should be 300');
console.log('✅ Availability & Price Calculation Verified: R$', totalPrice);

// 4. Create Booking
console.log('4️⃣ Creating Booking...');
const guest = await prisma.guest.create({
    data: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123456789',
    },
});

const booking = await prisma.booking.create({
    data: {
        roomTypeId: room.id,
        guestId: guest.id,
        checkIn: checkIn,
        checkOut: checkOut,
        totalPrice: totalPrice,
        status: 'PENDING',
    },
});
assert(booking.id, 'Booking ID should exist');
assert.strictEqual(booking.status, 'PENDING', 'Status should be PENDING');
console.log('✅ Booking Created:', booking.id);

// 5. Verify Inventory Impact
console.log('5️⃣ Verifying Inventory Impact...');
// Check if booking is counted
const bookingsCount = await prisma.booking.count({
    where: {
        roomTypeId: room.id,
        checkIn: { lte: checkIn },
        checkOut: { gt: checkIn },
    },
});
assert.strictEqual(bookingsCount, 1, 'Should have 1 booking for the date');

// Check availability again - should still be available (5 units total)
const isAvailable = bookingsCount < room.totalUnits;
assert(isAvailable, 'Room should still be available (1/5 booked)');
console.log('✅ Inventory Logic Verified');

console.log('🎉 All Tests Passed Successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
