import nodemailer from 'nodemailer';
import { formatDatePtBrLong } from '@/lib/date';

const HOTEL_NAME = process.env.HOTEL_NAME || 'Hotel Pousada Delplata';
const HOTEL_EMAIL = process.env.HOTEL_EMAIL || 'contato@pousadadelplata.com.br';
const HOTEL_WHATSAPP = process.env.HOTEL_WHATSAPP || '(19) 99965-4866';
const DEFAULT_CONTACT_RECEIVER_EMAIL = 'contato@pousadadelplata.com.br';
const DEFAULT_ALWAYS_BCC_EMAIL = 'caiocgp92@gmail.com';

function formatPaymentMethodLabel(paymentMethod?: string | null) {
    const method = String(paymentMethod || '').trim().toUpperCase();
    if (!method) return 'Não informado';

    const labels: Record<string, string> = {
        PIX: 'Pix',
        CREDIT_CARD: 'Cartão de crédito',
        DEBIT_CARD: 'Cartão de débito',
        ACCOUNT_MONEY: 'Saldo Mercado Pago',
        MASTER: 'Cartão Master',
        VISA: 'Cartão Visa',
        ELO: 'Cartão Elo',
        AMEX: 'Cartão Amex',
        HIPERCARD: 'Cartão Hipercard',
    };

    return labels[method] || method.replace(/_/g, ' ');
}

function normalizeInstallments(value: number | null | undefined) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function getPaymentReceiptDetails(paymentMethod?: string | null, paymentInstallments?: number | null) {
    const method = String(paymentMethod || '').trim().toUpperCase();
    const installments = normalizeInstallments(paymentInstallments);
    const cardBrands = new Set(['MASTER', 'VISA', 'ELO', 'AMEX', 'HIPERCARD']);
    const isCredit = method === 'CREDIT_CARD' || cardBrands.has(method) || (installments !== null && installments >= 1);

    if (method === 'PIX') {
        return {
            paymentTypeLabel: 'Pix',
            installmentsLabel: 'Não se aplica',
            showInstallments: false,
        };
    }

    if (method === 'DEBIT_CARD') {
        return {
            paymentTypeLabel: 'Débito',
            installmentsLabel: 'Não se aplica',
            showInstallments: false,
        };
    }

    if (isCredit) {
        const installmentsCount = installments ?? 1;
        return {
            paymentTypeLabel: installmentsCount > 1 ? 'Crédito parcelado' : 'Crédito à vista',
            installmentsLabel: `${installmentsCount}x`,
            showInstallments: true,
        };
    }

    return {
        paymentTypeLabel: formatPaymentMethodLabel(method),
        installmentsLabel: installments !== null ? `${installments}x` : 'Não informado',
        showInstallments: installments !== null,
    };
}

function formatGuestCount(adults?: number | null, children?: number | null) {
    const adultsCount = Math.max(0, Number.parseInt(String(adults ?? ''), 10) || 0);
    const childrenCount = Math.max(0, Number.parseInt(String(children ?? ''), 10) || 0);
    const totalGuests = adultsCount + childrenCount;

    if (totalGuests <= 0) return 'Não informado';

    const adultsLabel = adultsCount === 1 ? 'adulto' : 'adultos';
    const childrenLabel = childrenCount === 1 ? 'criança' : 'crianças';
    return `${totalGuests} (${adultsCount} ${adultsLabel}, ${childrenCount} ${childrenLabel})`;
}

function normalizeChildrenAges(childrenAges?: string | number[] | null) {
    if (Array.isArray(childrenAges)) {
        return childrenAges
            .map((age) => Number.parseInt(String(age), 10))
            .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17);
    }

    const raw = String(childrenAges || '').trim();
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((age) => Number.parseInt(String(age), 10))
                .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17);
        }
    } catch {
        // fallback para CSV simples (ex: "4,8")
    }

    return raw
        .split(',')
        .map((age) => Number.parseInt(age.trim(), 10))
        .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17);
}

function formatChildrenAgesLabel(childrenAges?: string | number[] | null, children?: number | null) {
    const ages = normalizeChildrenAges(childrenAges);
    if (ages.length > 0) {
        if (ages.length === 1) {
            return `${ages[0]} ${ages[0] === 1 ? 'ano' : 'anos'}`;
        }
        return `${ages.join(', ')} anos`;
    }

    const childrenCount = Math.max(0, Number.parseInt(String(children ?? ''), 10) || 0);
    if (childrenCount > 0) {
        return 'Não informada';
    }

    return null;
}

function formatDateTimePtBr(date: Date) {
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
    }).format(date);
}

function formatBookingStatusLabel(status?: string | null) {
    const normalized = String(status || '').trim().toUpperCase();
    if (!normalized) return 'PENDENTE';

    const labels: Record<string, string> = {
        PENDING: 'PENDENTE',
        CONFIRMED: 'CONFIRMADA',
        CANCELLED: 'CANCELADA',
        APPROVED: 'APROVADO',
        REJECTED: 'RECUSADO',
        REFUNDED: 'ESTORNADO',
        CHARGED_BACK: 'CONTESTADO',
    };

    return labels[normalized] || normalized;
}

function normalizeEmail(value: string | undefined | null) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized.length > 0 ? normalized : '';
}

function buildBccRecipients(toEmail: string | undefined, candidates: Array<string | undefined>) {
    const toNormalized = normalizeEmail(toEmail);
    const unique: string[] = [];

    for (const candidate of candidates) {
        const normalized = normalizeEmail(candidate);
        if (!normalized || normalized === toNormalized || unique.includes(normalized)) continue;
        unique.push(normalized);
    }

    return unique.length > 0 ? unique : undefined;
}

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
    guestPhone?: string | null;
    bookingId: string;
    roomName: string;
    checkIn: Date;
    checkOut: Date;
    totalPrice: number;
    paymentMethod?: string | null;
    paymentInstallments?: number | null;
    adults?: number | null;
    children?: number | null;
    childrenAges?: string | number[] | null;
    bookingStatus?: string | null;
    paymentStatus?: string | null;
    bookingCreatedAt?: Date;
}

export function buildBookingConfirmationEmailHtml(data: BookingEmailData) {
    const {
        guestName,
        guestEmail,
        guestPhone,
        bookingId,
        roomName,
        checkIn,
        checkOut,
        totalPrice,
        paymentMethod,
        paymentInstallments,
        adults,
        children,
        childrenAges,
    } = data;

    const checkInFormatted = formatDatePtBrLong(checkIn);
    const checkOutFormatted = formatDatePtBrLong(checkOut);
    const paymentDetails = getPaymentReceiptDetails(paymentMethod, paymentInstallments);
    const guestsLabel = formatGuestCount(adults, children);
    const childrenAgesLabel = formatChildrenAgesLabel(childrenAges, children);
    const bookingCode = bookingId.slice(0, 8).toUpperCase();
    const stayNights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

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
        .voucher-code {
            display: inline-block;
            background: #ffffff;
            color: #0f172a;
            border-radius: 8px;
            padding: 8px 14px;
            font-size: 20px;
            letter-spacing: 2px;
            font-weight: bold;
            margin-top: 10px;
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
        .section-title {
            margin-top: 0;
            margin-bottom: 10px;
            color: #0f172a;
            font-size: 18px;
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
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 999px;
            background: #dcfce7;
            color: #166534;
            font-weight: 600;
            font-size: 12px;
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
        .voucher-note {
            background: #fff;
            border: 1px dashed #0f172a;
            border-radius: 8px;
            padding: 12px;
            margin: 16px 0;
            text-align: center;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎫 Voucher de Hospedagem</h1>
        <p>${HOTEL_NAME}</p>
        <div class="voucher-code">${bookingCode}</div>
    </div>
    
    <div class="content">
        <p>Olá <strong>${guestName}</strong>,</p>

        <p>Seu voucher está confirmado. Apresente este código no check-in:</p>
        <p><span class="badge">Reserva Confirmada</span></p>

        <div class="voucher-note">
            <strong>Código do Voucher:</strong> ${bookingCode}<br>
            <strong>Titular:</strong> ${guestName}
        </div>

        <div class="booking-details">
            <h2 class="section-title">Dados do Titular</h2>
            <div class="detail-row">
                <span class="detail-label">Nome:</span>
                <span class="detail-value">${guestName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">E-mail:</span>
                <span class="detail-value">${guestEmail}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Telefone:</span>
                <span class="detail-value">${String(guestPhone || 'Não informado')}</span>
            </div>
        </div>

        <div class="booking-details">
            <h2 class="section-title">Detalhes da Estadia</h2>
            
            <div class="detail-row">
                <span class="detail-label">Número da Reserva:</span>
                <span class="detail-value">${bookingCode}</span>
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
                <span class="detail-label">Diárias:</span>
                <span class="detail-value">${stayNights} ${stayNights === 1 ? 'noite' : 'noites'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Quantidade de Hóspedes:</span>
                <span class="detail-value">${guestsLabel}</span>
            </div>
            ${childrenAgesLabel ? `
            <div class="detail-row">
                <span class="detail-label">Idade(s) das crianças:</span>
                <span class="detail-value">${childrenAgesLabel}</span>
            </div>` : ''}
        </div>

        <div class="booking-details">
            <h2 class="section-title">Pagamento</h2>
            
            <div class="detail-row">
                <span class="detail-label">Valor Total:</span>
                <span class="detail-value total">R$ ${totalPrice.toFixed(2)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Tipo de Pagamento:</span>
                <span class="detail-value">${paymentDetails.paymentTypeLabel}</span>
            </div>
            ${paymentDetails.showInstallments ? `
            <div class="detail-row">
                <span class="detail-label">Parcelas:</span>
                <span class="detail-value">${paymentDetails.installmentsLabel}</span>
            </div>` : ''}
        </div>
        
        <div class="instructions">
            <h3 style="margin-top: 0;">📋 Instruções de Check-in</h3>
            <ul style="margin: 10px 0;">
                <li><strong>Check-in:</strong> A partir das 14h</li>
                <li><strong>Check-out:</strong> Até às 12h</li>
                <li><strong>Documento:</strong> Apresente um documento de identidade válido</li>
                <li><strong>Código do Voucher:</strong> Tenha em mãos o código <strong>${bookingCode}</strong></li>
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
    const {
        guestName,
        bookingId,
        roomName,
        checkIn,
        checkOut,
        totalPrice,
        paymentMethod,
        paymentInstallments,
        adults,
        children,
        childrenAges,
    } = data;
    const checkInFormatted = formatDatePtBrLong(checkIn);
    const checkOutFormatted = formatDatePtBrLong(checkOut);
    const paymentDetails = getPaymentReceiptDetails(paymentMethod, paymentInstallments);
    const guestsLabel = formatGuestCount(adults, children);
    const childrenAgesLabel = formatChildrenAgesLabel(childrenAges, children);
    const bookingCode = bookingId.slice(0, 8).toUpperCase();

    const rawWhatsApp = String(process.env.HOTEL_WHATSAPP_LINK || HOTEL_WHATSAPP || '').replace(/\D/g, '');
    const normalizedWhatsApp = rawWhatsApp
        ? (rawWhatsApp.startsWith('55') ? rawWhatsApp : `55${rawWhatsApp}`)
        : '5519999654866';
    const whatsappMessage = encodeURIComponent(
        `Olá! Preciso de ajuda com a minha reserva ${bookingCode} no ${HOTEL_NAME}.`
    );
    const whatsappUrl = `https://wa.me/${normalizedWhatsApp}?text=${whatsappMessage}`;

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
        .cta-wrapper { text-align: center; margin: 20px 0; }
        .cta-button {
            display: inline-block;
            background: #22c55e;
            color: #ffffff !important;
            text-decoration: none;
            font-weight: bold;
            padding: 12px 18px;
            border-radius: 8px;
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>💬 Estamos aqui para ajudar</h1>
        <p>${HOTEL_NAME}</p>
    </div>
    <div class="content">
        <p>Olá <strong>${guestName}</strong>,</p>
        <p>Vimos que sua reserva foi iniciada e queremos te ajudar no que for preciso para finalizar com tranquilidade.</p>

        <div class="booking-details">
            <h2 style="margin-top: 0; color: #0f172a;">Detalhes da Reserva</h2>
            <div class="detail-row">
                <span class="detail-label">Número da Reserva:</span>
                <span class="detail-value">${bookingCode}</span>
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
            <div class="detail-row">
                <span class="detail-label">Tipo de Pagamento:</span>
                <span class="detail-value">${paymentDetails.paymentTypeLabel}</span>
            </div>
            ${paymentDetails.showInstallments ? `
            <div class="detail-row">
                <span class="detail-label">Parcelas:</span>
                <span class="detail-value">${paymentDetails.installmentsLabel}</span>
            </div>` : ''}
            <div class="detail-row">
                <span class="detail-label">Quantidade de Hóspedes:</span>
                <span class="detail-value">${guestsLabel}</span>
            </div>
            ${childrenAgesLabel ? `
            <div class="detail-row">
                <span class="detail-label">Idade(s) das crianças:</span>
                <span class="detail-value">${childrenAgesLabel}</span>
            </div>` : ''}
        </div>

        <div class="notice">
            Se você quiser, nossa equipe pode te ajudar a concluir a reserva ou tirar qualquer dúvida.
        </div>

        <div class="cta-wrapper">
            <a class="cta-button" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">Falar no WhatsApp do Hotel</a>
        </div>

        <p>Se você já concluiu a reserva ou não precisa de ajuda agora, pode desconsiderar este e-mail.</p>

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
    const {
        guestName,
        bookingId,
        roomName,
        checkIn,
        checkOut,
        totalPrice,
        paymentMethod,
        paymentInstallments,
        adults,
        children,
        childrenAges,
    } = data;
    const checkInFormatted = formatDatePtBrLong(checkIn);
    const checkOutFormatted = formatDatePtBrLong(checkOut);
    const paymentDetails = getPaymentReceiptDetails(paymentMethod, paymentInstallments);
    const guestsLabel = formatGuestCount(adults, children);
    const childrenAgesLabel = formatChildrenAgesLabel(childrenAges, children);

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
            <div class="detail-row">
                <span class="detail-label">Tipo de Pagamento:</span>
                <span class="detail-value">${paymentDetails.paymentTypeLabel}</span>
            </div>
            ${paymentDetails.showInstallments ? `
            <div class="detail-row">
                <span class="detail-label">Parcelas:</span>
                <span class="detail-value">${paymentDetails.installmentsLabel}</span>
            </div>` : ''}
            <div class="detail-row">
                <span class="detail-label">Quantidade de Hóspedes:</span>
                <span class="detail-value">${guestsLabel}</span>
            </div>
            ${childrenAgesLabel ? `
            <div class="detail-row">
                <span class="detail-label">Idade(s) das crianças:</span>
                <span class="detail-value">${childrenAgesLabel}</span>
            </div>` : ''}
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

    const { guestEmail, roomName, bookingId } = data;
    const htmlContent = buildBookingConfirmationEmailHtml(data);
    const bookingCode = bookingId.slice(0, 8).toUpperCase();

    const adminEmail = process.env.CONTACT_RECEIVER_EMAIL || DEFAULT_CONTACT_RECEIVER_EMAIL;
    const alwaysBccEmail = process.env.ALWAYS_BCC_EMAIL || DEFAULT_ALWAYS_BCC_EMAIL;
    const bccRecipients = buildBccRecipients(guestEmail, [alwaysBccEmail]);

    const mailOptions = {
        from: `"${HOTEL_NAME}" <${process.env.SMTP_USER}>`,
        to: guestEmail,
        cc: adminEmail,
        bcc: bccRecipients,
        subject: `🎫 Voucher de Hospedagem - Reserva ${bookingCode} (${roomName})`,
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

    try {
        const info = await transporter.sendMail({
            from: `"${HOTEL_NAME}" <${process.env.SMTP_USER}>`,
            to: guestEmail,
            subject: `💬 Precisa de ajuda com sua reserva? - ${roomName}`,
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

    const adminEmail = process.env.CONTACT_RECEIVER_EMAIL || DEFAULT_CONTACT_RECEIVER_EMAIL;
    const alwaysBccEmail = process.env.ALWAYS_BCC_EMAIL || DEFAULT_ALWAYS_BCC_EMAIL;
    const bccRecipients = buildBccRecipients(guestEmail, [adminEmail, alwaysBccEmail]);

    try {
        const info = await transporter.sendMail({
            from: `"${HOTEL_NAME}" <${process.env.SMTP_USER}>`,
            to: guestEmail,
            bcc: bccRecipients,
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

    const toEmail = process.env.CONTACT_RECEIVER_EMAIL || DEFAULT_CONTACT_RECEIVER_EMAIL;
    const alwaysBccEmail = process.env.ALWAYS_BCC_EMAIL || DEFAULT_ALWAYS_BCC_EMAIL;
    const bccRecipients = buildBccRecipients(toEmail, [alwaysBccEmail]);

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





export async function sendBookingCreatedAlertEmail(data: BookingEmailData) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { success: false, error: 'SMTP not configured' };
    }

    const adminEmail = process.env.CONTACT_RECEIVER_EMAIL || DEFAULT_CONTACT_RECEIVER_EMAIL;
    const alwaysBccEmail = process.env.ALWAYS_BCC_EMAIL || DEFAULT_ALWAYS_BCC_EMAIL;
    const bccRecipients = buildBccRecipients(adminEmail, [alwaysBccEmail]);

    const checkInFormatted = formatDatePtBrLong(data.checkIn);
    const checkOutFormatted = formatDatePtBrLong(data.checkOut);
    const paymentDetails = getPaymentReceiptDetails(data.paymentMethod, data.paymentInstallments);
    const guestsLabel = formatGuestCount(data.adults, data.children);
    const childrenAgesLabel = formatChildrenAgesLabel(data.childrenAges, data.children);

    const html = `
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto; padding: 20px;">
  <h2 style="margin-top:0; color:#0f172a;">Atualização de reserva</h2>
  <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px; border-radius:8px;">
    <p><strong>Reserva:</strong> ${data.bookingId.slice(0, 8).toUpperCase()}</p>
    <p><strong>Hóspede:</strong> ${data.guestName} (${data.guestEmail})</p>
    <p><strong>WhatsApp:</strong> ${String(data.guestPhone || 'Não informado')}</p>
    <p><strong>Quarto:</strong> ${data.roomName}</p>
    <p><strong>Período:</strong> ${checkInFormatted} - ${checkOutFormatted}</p>
    <p><strong>Hóspedes:</strong> ${guestsLabel}</p>
    ${childrenAgesLabel ? `<p><strong>Idade(s) das crianças:</strong> ${childrenAgesLabel}</p>` : ''}
    <p><strong>Valor:</strong> R$ ${data.totalPrice.toFixed(2)}</p>
    <p><strong>Tipo de pagamento:</strong> ${paymentDetails.paymentTypeLabel}</p>
    ${paymentDetails.showInstallments ? `<p><strong>Parcelas:</strong> ${paymentDetails.installmentsLabel}</p>` : ''}
    <p><strong>Status da reserva:</strong> ${formatBookingStatusLabel(data.bookingStatus)}</p>
    <p><strong>Status do pagamento:</strong> ${formatBookingStatusLabel(data.paymentStatus)}</p>
    <p><strong>Criada em:</strong> ${formatDateTimePtBr(data.bookingCreatedAt || new Date())}</p>
  </div>
</body>
</html>`;

    try {
        const info = await transporter.sendMail({
            from: `"${HOTEL_NAME}" <${process.env.SMTP_USER}>`,
            to: adminEmail,
            bcc: bccRecipients,

            subject: `📌 Reserva ${formatBookingStatusLabel(data.bookingStatus)} - ${data.roomName}`,
            html,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error };
    }
}




