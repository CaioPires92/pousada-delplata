const DEFAULT_WHATSAPP_PHONE = '5519999654866';

export function normalizeWhatsAppPhone(value: unknown) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return DEFAULT_WHATSAPP_PHONE;
    if (digits.startsWith('55')) return digits;
    return `55${digits}`;
}

export function buildBookingWhatsAppUrl(params: {
    phone?: string | null;
    context: 'quote' | 'error_form' | 'error_payment';
    bookingId?: string | null;
    guestName?: string | null;
    roomName?: string | null;
    amountLabel?: string | null;
    adults: number;
    children: number;
    checkInLabel: string;
    checkOutLabel: string;
}) {
    const contextLine = params.context === 'error_form'
        ? 'Tive um problema ao continuar minha reserva no preenchimento dos dados.'
        : params.context === 'error_payment'
            ? 'Tive um problema ao finalizar o pagamento da reserva.'
            : 'Gostaria de cotar hospedagem.';

    const details = [
        `Olá! ${contextLine}`,
        params.bookingId ? `Reserva: ${params.bookingId}` : null,
        params.guestName ? `Hóspede: ${params.guestName}` : null,
        params.roomName ? `Acomodação: ${params.roomName}` : null,
        params.amountLabel ? `Valor da tentativa: ${params.amountLabel}` : null,
        `Hospedagem para *${params.adults} adultos* e *${params.children} crianças*.`,
        `Datas: ${params.checkInLabel} a ${params.checkOutLabel}.`,
    ].filter(Boolean);

    return `https://wa.me/${normalizeWhatsAppPhone(params.phone)}?text=${encodeURIComponent(details.join('\n'))}`;
}
