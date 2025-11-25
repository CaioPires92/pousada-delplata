import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * API para enviar email de confirmação de reserva
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, guestName, roomName, checkIn, checkOut, totalPrice, bookingId } = body;

        console.log('[Email] Sending confirmation to:', email);

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
        const checkInDate = new Date(checkIn).toLocaleDateString('pt-BR');
        const checkOutDate = new Date(checkOut).toLocaleDateString('pt-BR');
        const price = Number(totalPrice).toFixed(2);

        // HTML do email
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Reserva Confirmada!</h1>
        </div>
        <div class="content">
            <p>Olá <strong>${guestName}</strong>,</p>
            <p>Sua reserva foi confirmada com sucesso! Estamos muito felizes em recebê-lo(a) na Pousada Delplata.</p>
            
            <div class="booking-details">
                <h2 style="margin-top: 0; color: #4CAF50;">Detalhes da Reserva</h2>
                
                <div class="detail-row">
                    <span class="detail-label">Código da Reserva:</span>
                    <span class="detail-value">${bookingId.slice(0, 8).toUpperCase()}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Acomodação:</span>
                    <span class="detail-value">${roomName}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Check-in:</span>
                    <span class="detail-value">${checkInDate}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Check-out:</span>
                    <span class="detail-value">${checkOutDate}</span>
                </div>
                
                <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">Valor Total:</span>
                    <span class="detail-value" style="color: #4CAF50; font-size: 18px; font-weight: bold;">R$ ${price}</span>
                </div>
            </div>
            
            <p><strong>Informações Importantes:</strong></p>
            <ul>
                <li>Check-in: A partir das 14h</li>
                <li>Check-out: Até às 12h</li>
                <li>Traga um documento com foto</li>
                <li>Em caso de dúvidas, entre em contato conosco</li>
            </ul>
            
            <p>Aguardamos ansiosamente pela sua chegada!</p>
            
            <div class="footer">
                <p><strong>Pousada Delplata</strong></p>
                <p>Email: contato@pousadadelplata.com.br</p>
                <p>Telefone: (XX) XXXX-XXXX</p>
            </div>
        </div>
    </div>
</body>
</html>
        `;

        // Enviar email
        await transporter.sendMail({
            from: `"Pousada Delplata" <${process.env.SMTP_USER}>`,
            to: email,
            subject: '✅ Reserva Confirmada - Pousada Delplata',
            html: htmlContent,
        });

        console.log('[Email] Confirmation sent successfully to:', email);
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Email] Error sending confirmation:', error);
        return NextResponse.json(
            { error: 'Failed to send email' },
            { status: 500 }
        );
    }
}
