import nodemailer from 'nodemailer';
import { formatDatePtBrLong } from '@/lib/date';

const HOTEL_NAME = process.env.HOTEL_NAME || 'Hotel Pousada Delplata';
const HOTEL_EMAIL = process.env.HOTEL_EMAIL || 'contato@pousadadelplata.com.br';
const HOTEL_WHATSAPP = process.env.HOTEL_WHATSAPP || '(19) 99965-4866';
const DEFAULT_CONTACT_RECEIVER_EMAIL = 'contato@pousadadelplata.com.br';
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://pousada-delplata.vercel.app';

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

function normalizeWhatsAppLinkPhone(value: string | undefined | null) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '5519999654866';
    return digits.startsWith('55') ? digits : `55${digits}`;
}

function buildRecoveryWhatsAppUrl(params: {
    bookingId: string;
    guestName: string;
    roomName: string;
    checkIn?: Date;
    checkOut?: Date;
    guestPhone?: string | null;
}) {
    const phone = normalizeWhatsAppLinkPhone(process.env.HOTEL_WHATSAPP_LINK || HOTEL_WHATSAPP);
    const periodLine = params.checkIn && params.checkOut
        ? `Olá! Vimos que sua reserva para o período de ${formatDatePtBrLong(params.checkIn)} a ${formatDatePtBrLong(params.checkOut)} não foi concluída.`
        : 'Olá! Vimos que sua reserva não foi concluída.';
    const message = [
        periodLine,
        'Se ainda tiver interesse em se hospedar conosco, estamos à disposição para ajudar com a reserva ou verificar outras opções de datas e acomodações. 😊',
        `Reserva: ${params.bookingId.slice(0, 8).toUpperCase()}`,
        `Hóspede: ${params.guestName}`,
        `Acomodação: ${params.roomName}`,
        params.guestPhone ? `Contato: ${params.guestPhone}` : null,
    ].filter(Boolean).join('\n');

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildRecoveryBookingUrl(bookingId: string) {
    return `${PUBLIC_SITE_URL.replace(/\/$/, '')}/reservar?booking=${encodeURIComponent(bookingId)}`;
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
    paymentMode?: string | null;
    paidAmount?: number | null;
    remainingAmount?: number | null;
    balanceDueAt?: string | null;
    balanceDueDate?: Date | null;
    adults?: number | null;
    children?: number | null;
    childrenAges?: string | number[] | null;
    bookingStatus?: string | null;
    paymentStatus?: string | null;
    funnelStage?: string | null;
    lastErrorMessage?: string | null;
    bookingCreatedAt?: Date;
    recoveryCoupon?: {
        code: string;
        label: string;
        expiresAt?: Date | null;
        bookingUrl: string;
    };
}

function formatRecoveryStage(data: BookingEmailData) {
    const stage = String(data.funnelStage || '').trim().toUpperCase();
    if (stage === 'CONFIRMED' || stage === 'BOOKING_CONFIRMED' || stage === 'PAYMENT_APPROVED') {
        return 'Sua reserva foi confirmada com sucesso.';
    }
    if (stage === 'EXPIRED_PENDING_BOOKING' || stage === 'BOOKING_CANCELLED' || stage === 'PAYMENT_REJECTED' || stage === 'PAYMENT_ERROR') {
        return 'Sua reserva expirou por falta de confirmação.';
    }
    return 'Sua reserva está pendente de confirmação.';
}

function isPartialPayment(data: BookingEmailData) {
    return String(data.paymentMode || '').trim().toUpperCase() === 'PARTIAL'
        && Number(data.remainingAmount || 0) > 0;
}

function formatBalanceDueLabel(data: BookingEmailData) {
    if (String(data.balanceDueAt || '').trim().toUpperCase() === 'BEFORE_CHECK_IN') {
        return data.balanceDueDate
            ? `antes do check-in (${formatDatePtBrLong(data.balanceDueDate)})`
            : 'antes do check-in';
    }

    return 'no check-in';
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
        paidAmount,
        remainingAmount,
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
    const partialPayment = isPartialPayment(data);

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
            ${partialPayment ? `
            <div class="detail-row">
                <span class="detail-label">Valor pago agora:</span>
                <span class="detail-value">R$ ${Number(paidAmount || 0).toFixed(2)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Saldo restante:</span>
                <span class="detail-value">R$ ${Number(remainingAmount || 0).toFixed(2)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Pagamento do saldo:</span>
                <span class="detail-value">${formatBalanceDueLabel(data)}</span>
            </div>` : ''}
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
        guestPhone,
        guestEmail,
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
    const recoveryStageMessage = formatRecoveryStage(data);
    const recoveryCoupon = data.recoveryCoupon;
    const recoveryBookingUrl = recoveryCoupon?.bookingUrl || buildRecoveryBookingUrl(bookingId);
    const recoveryWhatsAppUrl = buildRecoveryWhatsAppUrl({
        bookingId,
        guestName,
        roomName,
        checkIn,
        checkOut,
        guestPhone,
    });
    const recoveryCouponHtml = recoveryCoupon ? `
        <div style="margin:20px 0;padding:20px;text-align:center;background:#f4f3df;border:1px solid #bbb863">
            <p style="margin:0 0 6px;font-weight:bold;color:#283223">Uma condição especial para você concluir sua reserva</p>
            <p style="margin:0 0 12px">${recoveryCoupon.label}</p>
            <div style="font-size:24px;font-weight:bold;letter-spacing:2px;color:#283223">${escapeDiscountEmailHtml(recoveryCoupon.code)}</div>
            ${recoveryCoupon.expiresAt ? `<p style="margin:10px 0 0;font-size:12px">Válido até ${formatDatePtBrLong(recoveryCoupon.expiresAt)}.</p>` : ''}
        </div>
        <div class="cta-wrapper">
            <a class="cta-button" href="${escapeDiscountEmailHtml(recoveryBookingUrl)}" target="_blank" rel="noopener noreferrer">Recuperar minha reserva</a>
        </div>
    ` : '';

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
        <h1>⛰️ Falta pouco para garantir seus dias em Serra Negra!</h1>
        <p>${HOTEL_NAME}</p>
    </div>
    <div class="content">
        <p>Olá <strong>${guestName}</strong>,</p>
        <p>${recoveryStageMessage}</p>
        <p>Queremos muito te receber e estamos à disposição para ajudar no que for preciso para finalizar com tranquilidade.</p>

        <div class="booking-details">
            <h2 style="margin-top: 0; color: #0f172a;">Detalhes da Reserva</h2>
            <div class="detail-row">
                <span class="detail-label">Número da Reserva:</span>
                <span class="detail-value">${bookingCode}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Nome:</span>
                <span class="detail-value">${guestName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">E-mail:</span>
                <span class="detail-value">${guestEmail}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">WhatsApp/Telefone:</span>
                <span class="detail-value">${String(guestPhone || 'Não informado')}</span>
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
            Se você quiser, nossa equipe pode te ajudar a concluir a reserva, revisar valores e verificar outras datas.
        </div>
        ${recoveryCouponHtml}

        <div class="cta-wrapper">
            <a class="cta-button" href="${escapeDiscountEmailHtml(recoveryBookingUrl)}" target="_blank" rel="noopener noreferrer">Recuperar minha reserva</a>
        </div>

        <div class="cta-wrapper">
            <a class="cta-button" href="${escapeDiscountEmailHtml(recoveryWhatsAppUrl)}" target="_blank" rel="noopener noreferrer">Falar pelo WhatsApp</a>
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
    const recoveryStageMessage = formatRecoveryStage(data);
    const recoveryBookingUrl = buildRecoveryBookingUrl(bookingId);
    const recoveryWhatsAppUrl = buildRecoveryWhatsAppUrl({
        bookingId,
        guestName,
        roomName,
        checkIn,
        checkOut,
    });

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
        <p>${recoveryStageMessage}</p>
        <p>O tempo da sua reserva esgotou, mas <strong>ainda queremos te receber!</strong> O quarto foi liberado no site, mas você pode nos chamar no WhatsApp para verificar se ainda há disponibilidade ou tentar novamente.</p>

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
            Acesse nosso site para recuperar a reserva ou fale conosco pelo WhatsApp.
        </div>

        <div class="cta-wrapper" style="text-align: center; margin: 20px 0;">
            <a href="${recoveryBookingUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0f172a; color: #ffffff !important; text-decoration: none; font-weight: bold; padding: 12px 18px; border-radius: 8px;">Recuperar minha reserva</a>
        </div>

        <div class="cta-wrapper" style="text-align: center; margin: 20px 0;">
            <a href="${recoveryWhatsAppUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #22c55e; color: #ffffff !important; text-decoration: none; font-weight: bold; padding: 12px 18px; border-radius: 8px;">Falar pelo WhatsApp</a>
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

    const mailOptions = {
        from: `"${HOTEL_NAME}" <${process.env.SMTP_USER}>`,
        to: guestEmail,
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
            bcc: [process.env.CONTACT_RECEIVER_EMAIL || DEFAULT_CONTACT_RECEIVER_EMAIL],
            subject: `💬 Continue sua reserva de onde parou - ${roomName}`,
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

    try {
        const info = await transporter.sendMail({
            from: `"${HOTEL_NAME}" <${process.env.SMTP_USER}>`,
            to: guestEmail,
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

    const checkInFormatted = formatDatePtBrLong(data.checkIn);
    const checkOutFormatted = formatDatePtBrLong(data.checkOut);
    const paymentDetails = getPaymentReceiptDetails(data.paymentMethod, data.paymentInstallments);
    const guestsLabel = formatGuestCount(data.adults, data.children);
    const childrenAgesLabel = formatChildrenAgesLabel(data.childrenAges, data.children);
    const partialPayment = isPartialPayment(data);

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
    ${partialPayment ? `
    <p><strong>Valor pago agora:</strong> R$ ${Number(data.paidAmount || 0).toFixed(2)}</p>
    <p><strong>Saldo restante:</strong> R$ ${Number(data.remainingAmount || 0).toFixed(2)}</p>
    <p><strong>Pagamento do saldo:</strong> ${formatBalanceDueLabel(data)}</p>` : ''}
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
            subject: `📌 Reserva ${formatBookingStatusLabel(data.bookingStatus)} - ${data.roomName}`,
            html,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error };
    }
}






export function buildAdminRecoveryAlertEmailHtml(data: BookingEmailData) {
    const { guestName, guestEmail, guestPhone, roomName, totalPrice, checkIn, checkOut, adults, children } = data;
    
    const checkInDate = formatDatePtBrLong(checkIn);
    const checkOutDate = formatDatePtBrLong(checkOut);
    
    // Calculate nights
    const diffTime = Math.abs(new Date(checkOut).getTime() - new Date(checkIn).getTime());
    const nightsCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const nightsText = nightsCount === 1 ? '1 noite' : `${nightsCount} noites`;

    const adultsCount = adults || 0;
    const childrenCount = children || 0;
    const guestsLabel = `${adultsCount + childrenCount} hóspedes (${adultsCount} adultos, ${childrenCount} crianças)`;
    const recoveryBookingUrl = buildRecoveryBookingUrl(data.bookingId);
    const recoveryWhatsAppUrl = buildRecoveryWhatsAppUrl({
        bookingId: data.bookingId,
        guestName,
        roomName,
        checkIn,
        checkOut,
        guestPhone,
    });
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 20px; background-color: #f7f9f6; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e2e8e0; }
        
        .logo-section { text-align: center; margin-bottom: 30px; }
        .logo-section img { max-width: 200px; }
        .logo-divider { border-bottom: 1px solid #e2e8e0; margin-top: 15px; margin-bottom: 30px; }

        .header-section { text-align: center; margin-bottom: 30px; }
        .header-section h2 { color: #16462c; font-size: 24px; margin: 0 0 10px 0; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .header-section p { color: #555; margin: 0; font-size: 15px; }

        .value-box { background: #f0f4ec; border-radius: 8px; padding: 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .value-label { color: #333; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
        .value-amount { color: #16462c; font-size: 28px; font-weight: bold; margin: 0; text-align: right; }

        .section-title { font-weight: bold; color: #16462c; font-size: 15px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; }
        
        .grid-container { display: table; width: 100%; margin-bottom: 30px; }
        .grid-row { display: table-row; }
        .grid-col { display: table-cell; width: 50%; padding: 10px 0; vertical-align: top; }
        .info-label { font-size: 12px; color: #777; margin: 0 0 2px 0; display: flex; align-items: center; gap: 5px; }
        .info-value { font-size: 14px; color: #333; margin: 0; font-weight: 500; }

        .contact-box { border: 1px solid #e2e8e0; border-radius: 8px; padding: 20px; margin-bottom: 30px; }

        .recommendation-box { background: #fdf6e3; border-radius: 8px; padding: 15px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 10px; border-left: 4px solid #f5a623; }
        .recommendation-text { margin: 0; font-size: 13px; color: #555; }
        .recommendation-text strong { color: #8a6d3b; }

        .btn-container { text-align: center; margin-top: 10px; margin-bottom: 40px; }
        .btn-primary { display: inline-block; background: #1a3626; color: #ffffff !important; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; width: 80%; }
        .btn-subtitle { display: block; font-size: 11px; font-weight: normal; margin-top: 5px; opacity: 0.9; }

        .footer { text-align: center; border-top: 1px solid #e2e8e0; padding-top: 20px; color: #666; font-size: 12px; }
        .footer-amenities { color: #555; margin-bottom: 15px; font-size: 11px; }
        .footer-brand { color: #333; font-weight: bold; margin-bottom: 5px; }
        .footer-slogan { font-style: italic; color: #666; display: flex; align-items: center; justify-content: center; gap: 5px;}
        
        /* Table resets for email */
        table { border-collapse: collapse; width: 100%; }
        td { vertical-align: top; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Logo -->
        <div class="logo-section">
            <img src="https://pousada-delplata.vercel.app/fotos/logo.png" alt="Delplata Pousada" />
            <div class="logo-divider"></div>
        </div>

        <!-- Header -->
        <div class="header-section">
            <h2>🔔 Ação da recepção</h2>
            <p>Uma reserva foi interrompida e a recepção pode tentar recuperar o contato ou validar disponibilidade com o hóspede.</p>
        </div>

        <!-- Value Box -->
        <table class="value-box" width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="vertical-align: middle;" align="left" width="50%">
                    <div class="value-label">💰 Valor potencial da reserva</div>
                </td>
                <td style="vertical-align: middle; text-align: right;" align="right" width="50%">
                    <div class="value-amount">R$ ${totalPrice.toFixed(2).replace('.', ',')}</div>
                </td>
            </tr>
        </table>

        <!-- Details -->
        <div class="section-title">📅 Detalhes da hospedagem</div>
        <table class="grid-container" width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td class="grid-col" style="padding-bottom: 15px;">
                    <p class="info-label">🛏️ Acomodação</p>
                    <p class="info-value">${roomName}</p>
                </td>
                <td class="grid-col" style="padding-bottom: 15px;">
                    <p class="info-label">📅 Período</p>
                    <p class="info-value">${checkInDate} → ${checkOutDate}</p>
                </td>
            </tr>
            <tr>
                <td class="grid-col">
                    <p class="info-label">🌙 Noites</p>
                    <p class="info-value">${nightsText}</p>
                </td>
                <td class="grid-col">
                    <p class="info-label">👥 Hóspedes</p>
                    <p class="info-value">${guestsLabel}</p>
                </td>
            </tr>
        </table>

        <!-- Contact Box -->
        <div class="contact-box">
            <div class="section-title" style="border:none; margin-bottom:10px;">👤 Contato do hóspede</div>
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td class="grid-col">
                        <p class="info-label">✉️ Email</p>
                        <p class="info-value">${guestEmail}</p>
                    </td>
                    <td class="grid-col">
                        <p class="info-label">💬 Telefone/WhatsApp</p>
                        <p class="info-value">${guestPhone || 'Não informado'}</p>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Recommendation -->
        <div class="recommendation-box">
            <span style="font-size: 18px;">⭐</span>
            <p class="recommendation-text">
                <strong>Ação recomendada:</strong> entrar em contato com o hóspede para recuperar a reserva ou confirmar se ele quer seguir por outra data.
            </p>
        </div>

        <!-- Button -->
        <div class="btn-container">
            <a href="${recoveryBookingUrl}" target="_blank" class="btn-primary" style="margin-bottom:12px;background:#0f172a;">
                ✅ RECUPERAR RESERVA
                <span class="btn-subtitle">Retomar o processo de reserva</span>
            </a>
            <a href="${recoveryWhatsAppUrl}" target="_blank" class="btn-primary" style="background:#25D366;">
                💬 FALAR NO WHATSAPP
                <span class="btn-subtitle">Abrir conversa com mensagem pronta</span>
            </a>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-amenities">
                🏊 Piscinas &nbsp;|&nbsp; ☕ Café da manhã &nbsp;|&nbsp; 🏡 Chalés e Apartamentos
            </div>
            <div class="footer-brand">Pousada Delplata • Serra Negra • SP</div>
            <div class="footer-slogan">🌿 Hospitalidade que acolhe, natureza que encanta.</div>
        </div>
    </div>
</body>
</html>
    `;
}

export async function sendAdminRecoveryAlertEmail(data: BookingEmailData & { phone?: string }) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { success: false, error: 'SMTP not configured' };
    }

    const adminEmail = process.env.CONTACT_RECEIVER_EMAIL || 'contato@pousadadelplata.com.br';

    try {
        const info = await transporter.sendMail({
            from: `"Sistema Admin" <${process.env.SMTP_USER}>`,
            to: adminEmail,
            subject: `🚨 Oportunidade de Recuperação: ${data.guestName} (${data.roomName})`,
            html: buildAdminRecoveryAlertEmailHtml(data),
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error };
    }
}

export async function sendDifficultyAlertEmail(data: {
    guestName: string;
    guestEmail: string;
    guestPhone?: string | null;
    step: string;
    reason: string;
    bookingId?: string;
    roomName?: string | null;
    totalPrice?: number | null;
    error?: string | null;
    funnelStage?: string | null;
    cardBrand?: string | null;
    paymentStatusDetail?: string | null;
    paymentMethodId?: string | null;
    paymentTypeId?: string | null;
    paymentProviderId?: string | number | null;
    cardLastFour?: string | null;
    installments?: number | null;
}) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { success: false, error: 'SMTP not configured' };
    }

    const adminEmail = process.env.CONTACT_RECEIVER_EMAIL || 'contato@pousadadelplata.com.br';
    const recoveryBookingUrl = data.bookingId ? buildRecoveryBookingUrl(data.bookingId) : '';
    const recoveryWhatsAppUrl = data.bookingId
        ? buildRecoveryWhatsAppUrl({
              bookingId: data.bookingId,
              guestName: data.guestName,
              guestPhone: data.guestPhone,
              roomName: data.roomName || '',
          })
        : '';
    
    const html = `
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto; padding: 20px;">
      <h2 style="margin-top:0; color:#dc2626;">Alerta de Dificuldade na Reserva</h2>
      <div style="background:#fef2f2; border:1px solid #fca5a5; padding:16px; border-radius:8px;">
        <p><strong>Hóspede:</strong> ${data.guestName} (${data.guestEmail})</p>
        <p><strong>WhatsApp:</strong> ${data.guestPhone || 'Não informado'}</p>
        <p><strong>Etapa:</strong> ${data.step}</p>
        <p><strong>Motivo/Detalhes:</strong> ${data.reason}</p>
        ${data.bookingId ? `<p><strong>ID da Reserva:</strong> ${data.bookingId.slice(0,8).toUpperCase()}</p>` : ''}
        ${data.roomName ? `<p><strong>Quarto:</strong> ${data.roomName}</p>` : ''}
        ${typeof data.totalPrice === 'number' ? `<p><strong>Valor:</strong> R$ ${data.totalPrice.toFixed(2).replace('.', ',')}</p>` : ''}
        <p><strong>Bandeira:</strong> ${data.cardBrand || 'Não identificada pelo Mercado Pago'}</p>
        ${data.cardLastFour ? `<p><strong>Final do cartão:</strong> ${data.cardLastFour}</p>` : ''}
        ${data.paymentMethodId ? `<p><strong>Meio identificado:</strong> ${data.paymentMethodId}</p>` : ''}
        ${data.paymentTypeId ? `<p><strong>Tipo de pagamento:</strong> ${data.paymentTypeId}</p>` : ''}
        ${typeof data.installments === 'number' ? `<p><strong>Parcelas:</strong> ${data.installments}x</p>` : ''}
        ${data.paymentStatusDetail ? `<p><strong>Motivo técnico do Mercado Pago:</strong> ${data.paymentStatusDetail}</p>` : ''}
        ${data.paymentProviderId ? `<p><strong>ID da transação no Mercado Pago:</strong> ${data.paymentProviderId}</p>` : ''}
        ${data.error ? `<p><strong>Erro ocorrido:</strong> ${data.error}</p>` : ''}
        ${data.funnelStage ? `<p><strong>Etapa do funil:</strong> ${data.funnelStage}</p>` : ''}
        ${recoveryBookingUrl || recoveryWhatsAppUrl ? `
        <div style="margin-top: 15px; display:flex; gap:12px; flex-wrap:wrap;">
            <a href="${recoveryBookingUrl}" target="_blank" style="background-color: #0f172a; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Recuperar reserva
            </a>
            <a href="${recoveryWhatsAppUrl}" target="_blank" style="background-color: #25D366; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Chamar no WhatsApp
            </a>
        </div>
        ` : ''}
      </div>
      <p style="margin-top:20px; font-size:14px;">Recomendamos entrar em contato com o cliente para auxiliar no fechamento da reserva.</p>
    </body>
    </html>`;

    try {
        const info = await transporter.sendMail({
            from: `"Sistema Admin" <${process.env.SMTP_USER}>`,
            to: adminEmail,
            subject: `⚠️ Dificuldade de Pagamento: ${data.guestName}`,
            html,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error };
    }
}

function escapeDiscountEmailHtml(value: string) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export async function sendGuestDiscountEmail(data: {
    guestName: string;
    guestEmail: string;
    code?: string;
    discountLabel?: string;
    expiresAt?: Date | null;
    bookingUrl: string;
}) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { success: false, error: 'SMTP not configured' };
    }

    const guestName = escapeDiscountEmailHtml(data.guestName);
    const code = data.code ? escapeDiscountEmailHtml(data.code) : '';
    const discountLabel = data.discountLabel ? escapeDiscountEmailHtml(data.discountLabel) : '';
    const bookingUrl = escapeDiscountEmailHtml(data.bookingUrl);
    const expiration = data.expiresAt ? formatDatePtBrLong(data.expiresAt) : '';
    const couponBlock = code ? `
        <p>Para deixar o convite ainda melhor, incluímos o cupom <strong>${discountLabel}</strong> abaixo.</p>
        <div style="margin:24px 0;padding:22px;text-align:center;background:#f4f3df;border:1px solid #bbb863">
          <div style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#6f6d31">Seu cupom</div>
          <div style="margin-top:8px;font-size:26px;font-weight:bold;letter-spacing:2px;color:#283223">${code}</div>
        </div>
        ${expiration ? `<p>Válido até <strong>${expiration}</strong>, sujeito às regras do cupom e à disponibilidade.</p>` : ''}
        <p><strong>Este desconto é válido exclusivamente para reservas realizadas pelo site oficial da Pousada Delplata.</strong></p>
    ` : '';
    const html = `
      <div style="margin:0;padding:32px 16px;background:#f5f5f5;font-family:Arial,sans-serif;color:#283223">
      <div style="max-width:620px;margin:0 auto;padding:32px;background:#ffffff;border-top:6px solid #bbb863">
        <div style="margin-bottom:10px;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#8a883f">Pousada Delplata</div>
        <h1 style="margin:0 0 24px;color:#283223;font-size:28px;line-height:1.2">Temos um convite para você voltar</h1>
        <p>Olá, ${guestName}!</p>
        <p>Esperamos que esteja bem. Gostaríamos de receber você novamente na Pousada Delplata e tornar sua próxima estadia ainda mais especial.</p>
        ${couponBlock}
        <p style="margin:28px 0">
          <a href="${bookingUrl}" style="display:inline-block;background:#283223;color:#ffffff;padding:14px 22px;border-bottom:3px solid #bbb863;text-decoration:none;font-weight:bold">Planejar minha próxima estadia</a>
        </p>
        <p>Esperamos receber você em breve!<br><strong>Equipe Pousada Delplata</strong></p>
        ${code ? '<p style="margin-top:28px;padding-top:18px;border-top:1px solid #e2e1d3;font-size:12px;line-height:1.6;color:#667060">O desconto será calculado automaticamente pelo motor de reservas. Não cumulativo com outras promoções.</p>' : ''}
      </div>
      </div>`;

    try {
        const info = await transporter.sendMail({
            from: `"Pousada Delplata" <${process.env.SMTP_USER}>`,
            to: data.guestEmail,
            subject: `Um convite para você voltar à Pousada Delplata`,
            html,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error };
    }
}
