import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as BookingsPost } from './bookings/route';
import { GET as AvailabilityGet } from './availability/route';
import prisma from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    default: {
        $transaction: vi.fn(),
        $queryRaw: vi.fn(),
        roomType: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        rate: {
            findMany: vi.fn(),
        },
        inventoryAdjustment: {
            findMany: vi.fn(),
        },
        guest: {
            create: vi.fn(),
            upsert: vi.fn(),
        },
        booking: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
    },
}));

describe('Booking Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.rate.findMany as any).mockResolvedValue([]);
    });

    it('should complete booking flow with extra adult fee', async () => {
        const checkIn = '2026-02-01';
        const checkOut = '2026-02-02';

        // Mock room data with pricing
        const mockRoom = {
            id: 'room-1',
            name: 'Test Room',
            basePrice: 100,
            capacity: 3,
            maxGuests: 3,
            includedAdults: 2,
            extraAdultFee: 100,
            child6To11Fee: 80,
            totalUnits: 5,
            amenities: 'WiFi',
            photos: [],
            inventory: [],
            rates: [],
        };

        // Step 1: Get availability with 3 adults
        (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
        (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
        (prisma.$queryRaw as any).mockResolvedValue([]);

        const availabilityReq = new Request(
            `http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=3&children=0`
        );
        const availabilityRes = await AvailabilityGet(availabilityReq);
        const availabilityData = await availabilityRes.json();

        // Verify pricing calculation includes extra adult fee
        expect(availabilityRes.status).toBe(200);
        expect(availabilityData[0].totalPrice).toBe(200); // 100 base + 100 extra adult
        expect(availabilityData[0].priceBreakdown.extraAdults).toBe(1);
        expect(availabilityData[0].priceBreakdown.extraAdultTotal).toBe(100);

        // Step 2: Create booking with the calculated price
        const mockGuest = {
            id: 'guest-1',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '123456789',
        };

        const mockBooking = {
            id: 'booking-1',
            roomTypeId: 'room-1',
            guestId: 'guest-1',
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            totalPrice: 200,
            status: 'PENDING',
        };

        const tx = {
            roomType: { findUnique: prisma.roomType.findUnique },
            inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
            booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
            guest: { create: prisma.guest.create, upsert: prisma.guest.upsert },
            $queryRaw: prisma.$queryRaw,
        };

        (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
        (prisma.roomType.findUnique as any).mockResolvedValue(mockRoom);
        (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
        (prisma.booking.findMany as any).mockResolvedValue([]);
        (prisma.guest.upsert as any).mockResolvedValue(mockGuest);
        (prisma.booking.create as any).mockResolvedValue(mockBooking);

        const bookingBody = {
            roomTypeId: 'room-1',
            checkIn,
            checkOut,
            adults: 3,
            children: 0,
            childrenAges: [],
            guest: {
                name: 'John Doe',
                email: 'john@example.com',
                phone: '123456789',
            },
            totalPrice: availabilityData[0].totalPrice, // Use calculated price from availability
        };

        const bookingReq = new Request('http://localhost/api/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingBody),
        });

        const bookingRes = await BookingsPost(bookingReq);
        const bookingData = await bookingRes.json();

        // Verify booking created successfully with correct price
        expect(bookingRes.status).toBe(201);
        expect(bookingData.totalPrice).toBe(200);
    });

    it('should complete booking flow with child 6-11 fee', async () => {
        const checkIn = '2026-02-01';
        const checkOut = '2026-02-02';

        const mockRoom = {
            id: 'room-1',
            name: 'Test Room',
            basePrice: 100,
            capacity: 3,
            maxGuests: 3,
            includedAdults: 2,
            extraAdultFee: 100,
            child6To11Fee: 80,
            totalUnits: 5,
            amenities: 'WiFi',
            photos: [],
            inventory: [],
            rates: [],
        };

        // Step 1: Get availability with 2 adults + 1 child age 8
        (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
        (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
        (prisma.$queryRaw as any).mockResolvedValue([]);

        const availabilityReq = new Request(
            `http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=1&childrenAges=8`
        );
        const availabilityRes = await AvailabilityGet(availabilityReq);
        const availabilityData = await availabilityRes.json();

        // Verify pricing includes child 6-11 fee
        expect(availabilityRes.status).toBe(200);
        expect(availabilityData[0].totalPrice).toBe(180); // 100 base + 80 child
        expect(availabilityData[0].priceBreakdown.children6To11).toBe(1);
        expect(availabilityData[0].priceBreakdown.childTotal).toBe(80);

        // Step 2: Create booking
        const mockGuest = {
            id: 'guest-2',
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '987654321',
        };

        const mockBooking = {
            id: 'booking-2',
            roomTypeId: 'room-1',
            guestId: 'guest-2',
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            totalPrice: 180,
            status: 'PENDING',
        };

        const tx = {
            roomType: { findUnique: prisma.roomType.findUnique },
            inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
            booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
            guest: { create: prisma.guest.create, upsert: prisma.guest.upsert },
            $queryRaw: prisma.$queryRaw,
        };

        (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
        (prisma.roomType.findUnique as any).mockResolvedValue(mockRoom);
        (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
        (prisma.booking.findMany as any).mockResolvedValue([]);
        (prisma.guest.upsert as any).mockResolvedValue(mockGuest);
        (prisma.booking.create as any).mockResolvedValue(mockBooking);

        const bookingBody = {
            roomTypeId: 'room-1',
            checkIn,
            checkOut,
            adults: 2,
            children: 1,
            childrenAges: [8],
            guest: {
                name: 'Jane Doe',
                email: 'jane@example.com',
                phone: '987654321',
            },
            totalPrice: availabilityData[0].totalPrice,
        };

        const bookingReq = new Request('http://localhost/api/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingBody),
        });

        const bookingRes = await BookingsPost(bookingReq);
        const bookingData = await bookingRes.json();

        expect(bookingRes.status).toBe(201);
        expect(bookingData.totalPrice).toBe(180);
    });

    it('should complete booking flow counting child 12+ as adult', async () => {
        const checkIn = '2026-02-01';
        const checkOut = '2026-02-02';

        const mockRoom = {
            id: 'room-1',
            name: 'Test Room',
            basePrice: 100,
            capacity: 3,
            maxGuests: 3,
            includedAdults: 2,
            extraAdultFee: 100,
            child6To11Fee: 80,
            totalUnits: 5,
            amenities: 'WiFi',
            photos: [],
            inventory: [],
            rates: [],
        };

        // Step 1: Get availability with 2 adults + 1 child age 12 (should count as adult)
        (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
        (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
        (prisma.$queryRaw as any).mockResolvedValue([]);

        const availabilityReq = new Request(
            `http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=1&childrenAges=12`
        );
        const availabilityRes = await AvailabilityGet(availabilityReq);
        const availabilityData = await availabilityRes.json();

        // Verify child 12 is counted as adult (extra adult fee applied)
        expect(availabilityRes.status).toBe(200);
        expect(availabilityData[0].totalPrice).toBe(200); // 100 base + 100 extra adult (from age 12)
        expect(availabilityData[0].priceBreakdown.effectiveAdults).toBe(3); // 2 + 1 from age 12
        expect(availabilityData[0].priceBreakdown.extraAdults).toBe(1);
        expect(availabilityData[0].priceBreakdown.children6To11).toBe(0); // Age 12 is NOT in 6-11
        expect(availabilityData[0].priceBreakdown.extraAdultTotal).toBe(100);
        expect(availabilityData[0].priceBreakdown.childTotal).toBe(0);

        // Step 2: Create booking
        const mockGuest = {
            id: 'guest-3',
            name: 'Bob Smith',
            email: 'bob@example.com',
            phone: '555666777',
        };

        const mockBooking = {
            id: 'booking-3',
            roomTypeId: 'room-1',
            guestId: 'guest-3',
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            totalPrice: 200,
            status: 'PENDING',
        };

        const tx = {
            roomType: { findUnique: prisma.roomType.findUnique },
            inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
            booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
            guest: { create: prisma.guest.create, upsert: prisma.guest.upsert },
            $queryRaw: prisma.$queryRaw,
        };

        (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
        (prisma.roomType.findUnique as any).mockResolvedValue(mockRoom);
        (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
        (prisma.booking.findMany as any).mockResolvedValue([]);
        (prisma.guest.upsert as any).mockResolvedValue(mockGuest);
        (prisma.booking.create as any).mockResolvedValue(mockBooking);

        const bookingBody = {
            roomTypeId: 'room-1',
            checkIn,
            checkOut,
            adults: 2,
            children: 1,
            childrenAges: [12],
            guest: {
                name: 'Bob Smith',
                email: 'bob@example.com',
                phone: '555666777',
            },
            totalPrice: availabilityData[0].totalPrice,
        };

        const bookingReq = new Request('http://localhost/api/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingBody),
        });

        const bookingRes = await BookingsPost(bookingReq);
        const bookingData = await bookingRes.json();

        expect(bookingRes.status).toBe(201);
        expect(bookingData.totalPrice).toBe(200);
    });
});
