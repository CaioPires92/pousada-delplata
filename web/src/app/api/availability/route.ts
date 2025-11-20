import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eachDayOfInterval, format } from 'date-fns';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults');
    const children = searchParams.get('children');

    if (!checkIn || !checkOut) {
        return NextResponse.json(
            { error: 'Check-in and check-out dates are required' },
            { status: 400 }
        );
    }

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const totalGuests = (parseInt(adults || '0') + parseInt(children || '0')) || 1;

    try {
        // 1. Get all room types that can accommodate the guests
        const roomTypes = await prisma.roomType.findMany({
            where: {
                capacity: {
                    gte: totalGuests,
                },
            },
            include: {
                photos: true,
                rates: {
                    where: {
                        OR: [
                            {
                                startDate: { lte: endDate },
                                endDate: { gte: startDate },
                            },
                        ],
                    },
                },
                inventory: {
                    where: {
                        date: {
                            gte: startDate,
                            lt: endDate, // Inventory is checked for nights staying
                        },
                    },
                },
            },
        });

        // 2. Filter rooms based on availability
        const availableRooms = [];

        for (const room of roomTypes) {
            let isAvailable = true;
            let totalPrice = 0;
            const nights = eachDayOfInterval({ start: startDate, end: new Date(endDate.getTime() - 86400000) }); // Exclude checkout day

            for (const night of nights) {
                // Check inventory
                // Default inventory logic: if no specific adjustment, assume default capacity (e.g. 5? or maybe we should have a default in RoomType)
                // For now, let's assume if no inventory record, we use a default or it is available if we don't track it strictly yet.
                // PRD says: "Fechar datas/noites específicas" -> implies we track availability.
                // Let's assume we need to check existing bookings too.

                // Check bookings for this room type on this date
                const bookingsCount = await prisma.booking.count({
                    where: {
                        roomTypeId: room.id,
                        status: { in: ['CONFIRMED', 'PAID', 'PENDING'] }, // Assuming these statuses block room
                        checkIn: { lte: night },
                        checkOut: { gt: night },
                    },
                });

                // Check if there is a specific inventory adjustment (total units available for that day)
                const dailyInventory = room.inventory.find((i: any) => i.date.toISOString().split('T')[0] === night.toISOString().split('T')[0]);
                const maxUnits = dailyInventory ? dailyInventory.totalUnits : room.totalUnits;

                if (bookingsCount >= maxUnits) {
                    isAvailable = false;
                    break;
                }

                // Calculate Price
                // Find rate for this night
                const rate = room.rates.find((r: any) => r.startDate <= night && r.endDate >= night);
                if (rate) {
                    totalPrice += Number(rate.price);
                } else {
                    totalPrice += Number(room.basePrice);
                }
            }

            if (isAvailable) {
                availableRooms.push({
                    ...room,
                    totalPrice,
                });
            }
        }

        return NextResponse.json(availableRooms);
    } catch (error) {
        console.error('Error checking availability:', error);
        return NextResponse.json(
            { error: 'Error checking availability' },
            { status: 500 }
        );
    }
}
