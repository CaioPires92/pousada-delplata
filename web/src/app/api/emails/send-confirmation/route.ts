import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import nodemailer from 'nodemailer';
import { opsLog } from '@/lib/ops-log';
import { buildBookingConfirmationEmailHtml } from '@/lib/email';

/**
 * API para enviar email de confirmação de reserva
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, guestName, roomName, checkIn, checkOut, totalPrice, bookingId } = body;
        opsLog('info', 'EMAIL_CONFIRMATION_SEND_START', { bookingId, bookingIdShort: bookingId?.slice?.(0, 8) });

        // Configurar transporter do nodemailer
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false, // true para 465, false para outras portas
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Formatar datas
        const price = Number(totalPrice).toFixed(2);

        // HTML do email
        const htmlContent = buildBookingConfirmationEmailHtml({
            guestName,
            guestEmail: email,
            bookingId,
            roomName,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            totalPrice: Number(price),
        });

        // Enviar email
        await transporter.sendMail({
            from: `"Pousada Delplata" <${process.env.SMTP_USER}>`,
            to: email,
            subject: '✅ Reserva Confirmada - Pousada Delplata',
            html: htmlContent,
        });

        opsLog('info', 'EMAIL_CONFIRMATION_SEND_SUCCESS', { bookingId, bookingIdShort: bookingId?.slice?.(0, 8) });
        return NextResponse.json({ success: true });

    } catch (error) {
        Sentry.captureException(error);
        opsLog('error', 'EMAIL_CONFIRMATION_SEND_ERROR');
        return NextResponse.json(
            { error: 'Failed to send email' },
            { status: 500 }
        );
    }
}
