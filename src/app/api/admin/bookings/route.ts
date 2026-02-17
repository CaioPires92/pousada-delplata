import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

function isMissingColumnError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022';
}

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        try {
            const bookings = await prisma.booking.findMany({
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
                    guest: {
                        select: {
                            name: true,
                            email: true,
                            phone: true,
                        },
                    },
                    roomType: {
                        select: {
                            name: true,
                        },
                    },
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
                orderBy: {
                    createdAt: 'desc',
                },
            });

            return NextResponse.json(bookings);
        } catch (error) {
            if (!isMissingColumnError(error)) throw error;

            console.warn('[Admin Bookings] Missing DB column, using compatibility fallback:', error);

            try {
                const bookingsLegacy = await prisma.booking.findMany({
                    select: {
                        id: true,
                        checkIn: true,
                        checkOut: true,
                        totalPrice: true,
                        status: true,
                        createdAt: true,
                        guest: {
                            select: {
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
                        roomType: {
                            select: {
                                name: true,
                            },
                        },
                        payment: {
                            select: {
                                status: true,
                                amount: true,
                                method: true,
                                provider: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });

                return NextResponse.json(
                    bookingsLegacy.map((booking) => ({
                        ...booking,
                        adults: 1,
                        children: 0,
                        childrenAges: null,
                        payment: booking.payment
                            ? {
                                  ...booking.payment,
                                  cardBrand: null,
                                  installments: null,
                              }
                            : null,
                    }))
                );
            } catch (legacyError) {
                if (!isMissingColumnError(legacyError)) throw legacyError;

                const bookingsBasic = await prisma.booking.findMany({
                    select: {
                        id: true,
                        checkIn: true,
                        checkOut: true,
                        totalPrice: true,
                        status: true,
                        createdAt: true,
                        guest: {
                            select: {
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
                        roomType: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });

                return NextResponse.json(
                    bookingsBasic.map((booking) => ({
                        ...booking,
                        adults: 1,
                        children: 0,
                        childrenAges: null,
                        payment: null,
                    }))
                );
            }
        }

    } catch (error) {
        console.error('[Admin Bookings] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar reservas' },
            { status: 500 }
        );
    }
}
