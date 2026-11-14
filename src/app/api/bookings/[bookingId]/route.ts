import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    authorizeBookingRequest,
    getBookingAccessCookieName,
    getBookingAccessCookieOptions,
} from '@/lib/booking-access';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const { bookingId } = await params;

        const access = await authorizeBookingRequest(request, bookingId);
        if (!access.authorized) {
            return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                // Só o necessário para a página de confirmação: nunca CPF/endereço, se um dia forem guardados.
                guest: {
                    select: { id: true, name: true, email: true, phone: true },
                },
                roomType: {
                    include: {
                        photos: {
                            orderBy: { position: 'asc' },
                        },
                    },
                },
                payment: true,
            },
        });

        if (!booking) {
            return NextResponse.json(
                { error: 'Reserva não encontrada' },
                { status: 404 }
            );
        }

        const response = NextResponse.json(booking);
        if (access.token) {
            response.cookies.set(
                getBookingAccessCookieName(bookingId),
                access.token,
                getBookingAccessCookieOptions(bookingId)
            );
        }
        return response;
    } catch (error) {
        console.error('Erro ao buscar reserva:', error);
        return NextResponse.json(
            { error: 'Erro ao buscar detalhes da reserva' },
            { status: 500 }
        );
    }
}
