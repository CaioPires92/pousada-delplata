import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export const runtime = 'nodejs';

function isSchemaCompatibilityError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    return ['P2021', 'P2022', 'P2010', 'P2023'].includes(error.code);
}

function toNumber(value: unknown, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function toInt(value: unknown, fallback = 0) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBooking(booking: any) {
    const guest = booking?.guest || {};
    const roomType = booking?.roomType || {};
    const payment = booking?.payment
        ? {
              status: String(booking.payment.status || ''),
              amount: toNumber(booking.payment.amount, 0),
              method: booking.payment.method ?? null,
              cardBrand: booking.payment.cardBrand ?? null,
              installments: booking.payment.installments == null ? null : toInt(booking.payment.installments, 0),
              provider: booking.payment.provider ?? null,
          }
        : null;

    return {
        id: String(booking.id || ''),
        adults: Math.max(0, toInt(booking.adults, 1)),
        children: Math.max(0, toInt(booking.children, 0)),
        childrenAges: typeof booking.childrenAges === 'string' ? booking.childrenAges : null,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalPrice: toNumber(booking.totalPrice, 0),
        status: String(booking.status || ''),
        createdAt: booking.createdAt,
        guest: {
            name: String(guest.name || 'Não informado'),
            email: String(guest.email || '-'),
            phone: String(guest.phone || '-'),
        },
        roomType: {
            name: String(roomType.name || 'Não informado'),
        },
        payment,
    };
}

async function fetchBookingsWithFallback() {
    const attempts: Array<() => Promise<any[]>> = [
        () =>
            prisma.booking.findMany({
                select: {
                    id: true,
                    adults: true,
                    children: true,
                    childrenAges: true,
                    checkIn: true,
                    checkOut: true,
                    totalPrice: true,
                    status: true,
                    createdAt: true,
                    guest: { select: { name: true, email: true, phone: true } },
                    roomType: { select: { name: true } },
                    payment: {
                        select: {
                            status: true,
                            amount: true,
                            method: true,
                            cardBrand: true,
                            installments: true,
                            provider: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        () =>
            prisma.booking.findMany({
                select: {
                    id: true,
                    adults: true,
                    children: true,
                    childrenAges: true,
                    checkIn: true,
                    checkOut: true,
                    totalPrice: true,
                    status: true,
                    createdAt: true,
                    guest: { select: { name: true, email: true, phone: true } },
                    roomType: { select: { name: true } },
                    payment: {
                        select: {
                            status: true,
                            amount: true,
                            method: true,
                            provider: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        () =>
            prisma.booking.findMany({
                select: {
                    id: true,
                    adults: true,
                    children: true,
                    childrenAges: true,
                    checkIn: true,
                    checkOut: true,
                    totalPrice: true,
                    status: true,
                    createdAt: true,
                    guest: { select: { name: true, email: true, phone: true } },
                    roomType: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
        () =>
            prisma.booking.findMany({
                select: {
                    id: true,
                    checkIn: true,
                    checkOut: true,
                    totalPrice: true,
                    status: true,
                    createdAt: true,
                    guest: { select: { name: true, email: true } },
                    roomType: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
        () =>
            prisma.booking.findMany({
                select: {
                    id: true,
                    checkIn: true,
                    checkOut: true,
                    totalPrice: true,
                    status: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
    ];

    let lastError: unknown;

    for (let index = 0; index < attempts.length; index++) {
        try {
            const rows = await attempts[index]();
            return rows.map(normalizeBooking);
        } catch (error) {
            lastError = error;
            if (!isSchemaCompatibilityError(error)) throw error;
            console.warn(`[Admin Bookings] Schema mismatch on attempt ${index + 1}/${attempts.length}. Trying next fallback...`, error);
        }
    }

    throw lastError;
}

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const bookings = await fetchBookingsWithFallback();
        return NextResponse.json(bookings);

    } catch (error) {
        console.error('[Admin Bookings] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar reservas' },
            { status: 500 }
        );
    }
}
