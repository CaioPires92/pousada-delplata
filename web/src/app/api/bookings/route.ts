import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomTypeId, checkIn, checkOut, guest, totalPrice } = body;

        // 1. Validate input
        if (!roomTypeId || !checkIn || !checkOut || !guest || !totalPrice) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // 2. Create or Update Guest
        // In a real app, we might want to avoid duplicates based on email
        const guestRecord = await prisma.guest.create({
            data: {
                name: guest.name,
                email: guest.email,
                phone: guest.phone,
            },
        });

        // 3. Create Booking
        const booking = await prisma.booking.create({
            data: {
                roomTypeId,
                guestId: guestRecord.id,
                checkIn: new Date(checkIn),
                checkOut: new Date(checkOut),
                totalPrice: parseFloat(totalPrice),
                status: 'PENDING', // Default status before payment
            },
        });

        // 4. (Optional) Create Payment Preference here if integrating Mercado Pago immediately
        // For now, we just return the booking to proceed to payment step

        return NextResponse.json(booking, { status: 201 });
    } catch (error) {
        console.error('Error creating booking:', error);
        return NextResponse.json(
            { error: 'Error creating booking' },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    // Admin only - list all bookings
    // In a real app, add auth check here
    try {
        const bookings = await prisma.booking.findMany({
            include: {
                guest: true,
                roomType: true,
                payment: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return NextResponse.json(bookings);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching bookings' }, { status: 500 });
    }
}
