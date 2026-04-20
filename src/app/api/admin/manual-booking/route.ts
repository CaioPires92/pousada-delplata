import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        // 1. Verificar autenticação de admin
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json();
        const {
            guestName,
            guestEmail,
            guestPhone,
            checkIn,
            checkOut,
            roomTypeId,
            totalPrice,
            adults = 2,
            children = 0
        } = body;

        // Validação básica
        if (!guestName || !guestEmail || !checkIn || !checkOut || !roomTypeId || !totalPrice) {
            return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
        }

        const numericTotalPrice = Number(totalPrice);
        const numericAdults = Number(adults);
        const numericChildren = Number(children);

        if (isNaN(numericTotalPrice) || isNaN(numericAdults) || isNaN(numericChildren)) {
            return NextResponse.json({ error: 'Valores numéricos inválidos' }, { status: 400 });
        }

        // 2. Criar ou encontrar Hóspede (Manualmente já que email pode não ser único no schema)
        let guest = await prisma.guest.findFirst({
            where: { email: guestEmail }
        });

        if (guest) {
            guest = await prisma.guest.update({
                where: { id: guest.id },
                data: {
                    name: guestName,
                    phone: guestPhone || '',
                },
            });
        } else {
            guest = await prisma.guest.create({
                data: {
                    name: guestName,
                    email: guestEmail,
                    phone: guestPhone || '',
                },
            });
        }

        // 3. Criar Reserva (Booking)
        // Nota: totalPrice é o valor manual enviado pelo admin
        const booking = await prisma.booking.create({
            data: {
                guestId: guest.id,
                roomTypeId: roomTypeId,
                checkIn: new Date(checkIn),
                checkOut: new Date(checkOut),
                totalPrice: numericTotalPrice,
                status: 'PENDING',
                adults: numericAdults,
                children: numericChildren,
            },
            include: {
                guest: true,
            },
        });

        return NextResponse.json({
            bookingId: booking.id,
            totalPrice: numericTotalPrice,
            guest: {
                name: booking.guest.name,
                email: booking.guest.email,
                phone: booking.guest.phone,
            },
        });

    } catch (error: any) {
        console.error('SERVER-SIDE ERROR [Manual Booking]:', {
            message: error.message,
            stack: error.stack
        });
        return NextResponse.json({ 
            error: 'Erro interno do servidor', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
        }, { status: 500 });
    }
}
