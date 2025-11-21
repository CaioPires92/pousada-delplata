import nodemailer from 'nodemailer';

// Configurar transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true para 465, false para outras portas
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

interface BookingEmailData {
    guestName: string;
    guestEmail: string;
    bookingId: string;
    roomName: string;
    checkIn: Date;
    checkOut: Date;
    totalPrice: number;
}

export async function sendBookingConfirmationEmail(data: BookingEmailData) {
    const { guestName, guestEmail, bookingId, roomName, checkIn, checkOut, totalPrice } = data;

    const checkInFormatted = new Date(checkIn).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

    const checkOutFormatted = new Date(checkOut).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }
        .booking-details {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #eee;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: bold;
            color: #666;
        }
        .detail-value {
            color: #333;
        }
        .total {
            font-size: 1.3em;
            color: #667eea;
            font-weight: bold;
        }
        .instructions {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>✅ Reserva Confirmada!</h1>
        <p>Pousada Delplata Motor</p>
    </div>
    
    <div class="content">
        <p>Olá <strong>${guestName}</strong>,</p>
        
        <p>Sua reserva foi confirmada com sucesso! Estamos ansiosos para recebê-lo(a).</p>
        
        <div class="booking-details">
            <h2 style="margin-top: 0; color: #667eea;">Detalhes da Reserva</h2>
            
            <div class="detail-row">
                <span class="detail-label">Número da Reserva:</span>
                <span class="detail-value">${bookingId.slice(0, 8).toUpperCase()}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Acomodação:</span>
                <span class="detail-value">${roomName}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Check-in:</span>
                <span class="detail-value">${checkInFormatted}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Check-out:</span>
                <span class="detail-value">${checkOutFormatted}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Valor Total:</span>
                <span class="detail-value total">R$ ${totalPrice.toFixed(2)}</span>
            </div>
        </div>
        
        <div class="instructions">
            <h3 style="margin-top: 0;">📋 Instruções de Check-in</h3>
            <ul style="margin: 10px 0;">
                <li><strong>Check-in:</strong> A partir das 14h</li>
                <li><strong>Check-out:</strong> Até às 12h</li>
                <li><strong>Documento:</strong> Apresente um documento de identidade válido</li>
                <li><strong>Número da Reserva:</strong> Tenha em mãos o número <strong>${bookingId.slice(0, 8).toUpperCase()}</strong></li>
            </ul>
        </div>
        
        <p>Em caso de dúvidas ou necessidade de cancelamento, entre em contato conosco:</p>
        <p>
            📧 Email: contato@pousadadelplata.com<br>
            📱 WhatsApp: (XX) XXXXX-XXXX
        </p>
        
        <p>Aguardamos você!</p>
        <p><strong>Equipe Pousada Delplata Motor</strong></p>
    </div>
    
    <div class="footer">
        <p>Este é um email automático, por favor não responda.</p>
        <p>&copy; ${new Date().getFullYear()} Pousada Delplata Motor. Todos os direitos reservados.</p>
    </div>
</body>
</html>
    `;

    const mailOptions = {
        from: `"Pousada Delplata Motor" <${process.env.SMTP_USER}>`,
        to: guestEmail,
        subject: `✅ Reserva Confirmada - ${roomName}`,
        html: htmlContent,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email enviado:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        return { success: false, error };
    }
}
