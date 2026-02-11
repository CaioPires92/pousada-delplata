import { NextResponse } from 'next/server';
import { sendBookingConfirmationEmail } from '@/lib/email';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const { bookingId } = await request.json();

        if (!bookingId) {
            return NextResponse.json(
                { error: 'bookingId é obrigatório' },
                { status: 400 }
            );
        }

        // Buscar a reserva
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                guest: true,
                roomType: true,
            },
        });

        if (!booking) {
            return NextResponse.json(
                { error: 'Reserva não encontrada' },
                { status: 404 }
            );
        }

        // Enviar email de teste
        const result = await sendBookingConfirmationEmail({
            guestName: booking.guest.name,
            guestEmail: booking.guest.email,
            bookingId: booking.id,
            roomName: booking.roomType.name,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            totalPrice: Number(booking.totalPrice),
        });

        if (result.success) {
            return NextResponse.json({
                message: 'Email enviado com sucesso!',
                messageId: result.messageId,
                sentTo: booking.guest.email,
            });
        } else {
            return NextResponse.json(
                { error: 'Erro ao enviar email', details: result.error },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('Erro no teste de email:', error);
        return NextResponse.json(
            { error: 'Erro ao processar requisição', details: error.message },
            { status: 500 }
        );
    }
}
