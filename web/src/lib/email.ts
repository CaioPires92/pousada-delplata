import nodemailer from 'nodemailer';
import { formatDatePtBrLong } from '@/lib/date';

const HOTEL_NAME = process.env.HOTEL_NAME || 'Hotel Pousada Delplata';
const HOTEL_EMAIL = process.env.HOTEL_EMAIL || 'contato@pousadadelplata.com.br';
const HOTEL_WHATSAPP = process.env.HOTEL_WHATSAPP || '(19) 99965-4866';

// Validar configuração SMTP
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP não configurado. Configure SMTP_USER e SMTP_PASS no .env para enviar emails.');
}

// Configurar transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
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

export function buildBookingConfirmationEmailHtml(data: BookingEmailData) {
    const { guestName, bookingId, roomName, checkIn, checkOut, totalPrice } = data;

    const checkInFormatted = formatDatePtBrLong(checkIn);
    const checkOutFormatted = formatDatePtBrLong(checkOut);

    return `
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
            background: #0f172a;
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
            color: #0f172a;
            font-weight: bold;
        }
        .instructions {
            background: #f8fafc;
            border-left: 4px solid #0f172a;
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
        <p>${HOTEL_NAME}</p>
    </div>
    
    <div class="content">
        <p>Olá <strong>${guestName}</strong>,</p>
        
        <p>Sua reserva foi confirmada com sucesso! Estamos ansiosos para recebê-lo(a).</p>
        
        <div class="booking-details">
            <h2 style="margin-top: 0; color: #0f172a;">Detalhes da Reserva</h2>
            
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
            📧 Email: ${HOTEL_EMAIL}<br>
            📱 WhatsApp: ${HOTEL_WHATSAPP}
        </p>
        
        <p>Aguardamos você!</p>
        <p><strong>Equipe ${HOTEL_NAME}</strong></p>
    </div>
    
    <div class="footer">
        <p>Este é um email automático, por favor não responda.</p>
        <p>&copy; ${new Date().getFullYear()} ${HOTEL_NAME}. Todos os direitos reservados.</p>
    </div>
</body>
</html>
    `;
}

export function buildBookingPendingEmailHtml(data: BookingEmailData) {
    const { guestName, bookingId, roomName, checkIn, checkOut, totalPrice } = data;
    const checkInFormatted = formatDatePtBrLong(checkIn);
    const checkOutFormatted = formatDatePtBrLong(checkOut);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0f172a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .total { font-size: 1.3em; color: #0f172a; font-weight: bold; }
        .notice { background: #f8fafc; border-left: 4px solid #0f172a; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⏳ Reserva Pendente</h1>
        <p>${HOTEL_NAME}</p>
    </div>
    <div class="content">
        <p>Olá <strong>${guestName}</strong>,</p>
        <p>Sua reserva foi criada e está aguardando o pagamento.</p>

        <div class="booking-details">
            <h2 style="margin-top: 0; color: #0f172a;">Detalhes da Reserva</h2>
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

        <div class="notice">
            <strong>Importante:</strong> finalize o pagamento para confirmar sua reserva.
        </div>

        <p>Em caso de dúvidas, fale conosco:</p>
        <p>📧 Email: ${HOTEL_EMAIL}<br>📱 WhatsApp: ${HOTEL_WHATSAPP}</p>

        <p><strong>Equipe ${HOTEL_NAME}</strong></p>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${HOTEL_NAME}. Todos os direitos reservados.</p>
    </div>
</body>
</html>
    `;
}

export function buildBookingExpiredEmailHtml(data: BookingEmailData) {
    const { guestName, bookingId, roomName, checkIn, checkOut, totalPrice } = data;
    const checkInFormatted = formatDatePtBrLong(checkIn);
    const checkOutFormatted = formatDatePtBrLong(checkOut);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0f172a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .notice { background: #f8fafc; border-left: 4px solid #0f172a; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>❌ Reserva Expirada</h1>
        <p>${HOTEL_NAME}</p>
    </div>
    <div class="content">
        <p>Olá <strong>${guestName}</strong>,</p>
        <p>O prazo para pagamento expirou e sua reserva não foi confirmada.</p>

        <div class="booking-details">
            <h2 style="margin-top: 0; color: #0f172a;">Detalhes da Reserva</h2>
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
                <span class="detail-value">R$ ${totalPrice.toFixed(2)}</span>
            </div>
        </div>

        <div class="notice">
            Se quiser, você pode fazer uma nova reserva no nosso site.
        </div>

        <p>Em caso de dúvidas, fale conosco:</p>
        <p>📧 Email: ${HOTEL_EMAIL}<br>📱 WhatsApp: ${HOTEL_WHATSAPP}</p>

        <p><strong>Equipe ${HOTEL_NAME}</strong></p>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${HOTEL_NAME}. Todos os direitos reservados.</p>
    </div>
</body>
</html>
    `;
}

export async function sendBookingConfirmationEmail(data: BookingEmailData) {
    // Verificar se SMTP está configurado
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('❌ SMTP não configurado. Configure SMTP_USER e SMTP_PASS no .env');
        return {
            success: false,
            error: 'SMTP not configured. Please set SMTP_USER and SMTP_PASS in .env file'
        };
    }

    const { guestEmail, roomName } = data;
    const htmlContent = buildBookingConfirmationEmailHtml(data);

    const adminEmail =
        process.env.CONTACT_RECEIVER_EMAIL ||
        process.env.SMTP_USER ||
        'contato@pousadadelplata.com.br';

    const mailOptions = {
        from: `"${HOTEL_NAME}" <${process.env.SMTP_USER}>`,
        to: guestEmail,
        bcc: adminEmail,
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

export async function sendBookingPendingEmail(data: BookingEmailData) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { success: false, error: 'SMTP not configured' };
    }

    const { guestEmail, roomName } = data;
    const htmlContent = buildBookingPendingEmailHtml(data);

    const adminEmail =
        process.env.CONTACT_RECEIVER_EMAIL ||
        process.env.SMTP_USER ||
        'contato@pousadadelplata.com.br';

    try {
        const info = await transporter.sendMail({
            from: `"${HOTEL_NAME}" <${process.env.SMTP_USER}>`,
            to: guestEmail,
            bcc: adminEmail,
            subject: `⏳ Reserva Pendente - ${roomName}`,
            html: htmlContent,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error };
    }
}

export async function sendBookingExpiredEmail(data: BookingEmailData) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { success: false, error: 'SMTP not configured' };
    }

    const { guestEmail, roomName } = data;
    const htmlContent = buildBookingExpiredEmailHtml(data);

    const adminEmail =
        process.env.CONTACT_RECEIVER_EMAIL ||
        process.env.SMTP_USER ||
        'contato@pousadadelplata.com.br';

    try {
        const info = await transporter.sendMail({
            from: `"${HOTEL_NAME}" <${process.env.SMTP_USER}>`,
            to: guestEmail,
            bcc: adminEmail,
            subject: `❌ Reserva Expirada - ${roomName}`,
            html: htmlContent,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error };
    }
}

type ContactEmailData = {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
};

export async function sendContactEmail(data: ContactEmailData) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { success: false, error: 'SMTP not configured' };
    }

    const toEmail =
        process.env.CONTACT_RECEIVER_EMAIL ||
        process.env.SMTP_USER ||
        'contato@pousadadelplata.com.br';

    const html = `
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="margin-top:0; color:#667eea;">Nova mensagem de contato</h2>
  <div style="background:#f9f9f9; padding:16px; border-radius:8px; margin-top:12px;">
    <p><strong>Nome:</strong> ${data.name}</p>
    <p><strong>E-mail:</strong> ${data.email}</p>
    <p><strong>Telefone:</strong> ${data.phone}</p>
    <p><strong>Assunto:</strong> ${data.subject || 'Não informado'}</p>
    <p><strong>Mensagem:</strong></p>
    <div style="white-space:pre-wrap; background:#fff; padding:12px; border-radius:6px; border:1px solid #eee;">
      ${data.message}
    </div>
  </div>
</body>
</html>
`;

    try {
        const info = await transporter.sendMail({
            from: `"Site Delplata" <${process.env.SMTP_USER}>`,
            to: toEmail,
            replyTo: data.email,
            subject: `Contato: ${data.subject || 'Mensagem do site'}`,
            html,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error };
    }
}
