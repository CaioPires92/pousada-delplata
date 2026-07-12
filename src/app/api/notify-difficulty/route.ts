import { NextResponse } from 'next/server';
import { sendDifficultyAlertEmail } from '@/lib/email';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { guestName, guestEmail, guestPhone, step, reason, bookingId, roomName, totalPrice, error, funnelStage } = body;

        if (!guestName || !guestEmail || !step || !reason) {
            return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
        }

        const result = await sendDifficultyAlertEmail({
            guestName,
            guestEmail,
            guestPhone,
            step,
            reason,
            bookingId,
            roomName,
            totalPrice,
            error,
            funnelStage,
        });

        if (!result.success) {
            return NextResponse.json({ error: 'Falha ao enviar email' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in notify-difficulty route:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
