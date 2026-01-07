import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eachDayOfInterval, format, differenceInDays } from 'date-fns';

// Force dynamic rendering - don't try to build this route at build time
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const stayLength = differenceInDays(endDate, startDate);

    // Basic validation
    if (stayLength <= 0) {
        return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
    }

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

            // --- Validation: Check-in Rules (CTA & MinLOS) ---
            // Find rate for check-in date
            const checkInRate = room.rates.find((r: any) => {
                const start = new Date(r.startDate);
                const end = new Date(r.endDate);
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                // Need to match exact date for stricter rules, but rate covers range
                return startDate >= start && startDate <= end;
            });

            if (checkInRate) {
                if (checkInRate.cta) {
                    isAvailable = false; // Closed to Arrival
                }
                if (stayLength < checkInRate.minLos) {
                    isAvailable = false; // Minimum Length of Stay not met
                }
            }
            if (!isAvailable) continue; // Skip room if check-in rules fail

            // --- Validation: Check-out Rules (CTD) ---
            // Find rate for check-out date (note: we check availability for NIGHTS, but CTD applies to the check-out day itself)
            // Need to fetch rate covering checkOut date specifically? 
            // The query above fetches rates overlapping [startDate, endDate], so checkOut IS included in fetched rates.
            const checkOutRate = room.rates.find((r: any) => {
                const start = new Date(r.startDate);
                const end = new Date(r.endDate);
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                return endDate >= start && endDate <= end;
            });

            if (checkOutRate && checkOutRate.ctd) {
                isAvailable = false; // Closed to Departure
                continue;
            }

            // --- Validation: Daily Rules (Inventory & StopSell) ---
            for (const night of nights) {
                const nightDate = new Date(night);
                nightDate.setHours(0,0,0,0);

                // Find rate for this night
                const rate = room.rates.find((r: any) => {
                    const start = new Date(r.startDate);
                    const end = new Date(r.endDate);
                    start.setHours(0,0,0,0);
                    end.setHours(23,59,59,999);
                    return nightDate >= start && nightDate <= end;
                });

                // Check Stop Sell (Closed)
                if (rate && rate.stopSell) {
                    isAvailable = false;
                    break;
                }

                // Check inventory (Bookings count)
                const bookingsCount = await prisma.booking.count({
                    where: {
                        roomTypeId: room.id,
                        status: { in: ['CONFIRMED', 'PAID', 'PENDING'] }, 
                        checkIn: { lte: night },
                        checkOut: { gt: night },
                    },
                });

                const dailyInventory = room.inventory.find((i: any) => i.date.toISOString().split('T')[0] === night.toISOString().split('T')[0]);
                const maxUnits = dailyInventory ? dailyInventory.totalUnits : room.totalUnits;

                if (bookingsCount >= maxUnits) {
                    isAvailable = false;
                    break;
                }

                // Calculate Price
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
