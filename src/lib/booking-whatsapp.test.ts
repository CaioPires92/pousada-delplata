import { describe, expect, it } from 'vitest';
import { buildBookingWhatsAppUrl, normalizeWhatsAppPhone } from './booking-whatsapp';

describe('booking WhatsApp support URL', () => {
    it('normalizes configured Brazilian phone numbers', () => {
        expect(normalizeWhatsAppPhone('(19) 99965-4866')).toBe('5519999654866');
        expect(normalizeWhatsAppPhone('5519999654866')).toBe('5519999654866');
    });

    it('encodes payment error context and available booking details', () => {
        const url = buildBookingWhatsAppUrl({
            phone: '(19) 99965-4866',
            context: 'error_payment',
            bookingId: 'booking-123',
            guestName: 'Maria Silva',
            roomName: 'Suíte Superior',
            amountLabel: 'R$ 599,00',
            adults: 2,
            children: 1,
            checkInLabel: '20/07/2026',
            checkOutLabel: '22/07/2026',
        });

        const parsed = new URL(url);
        expect(parsed.hostname).toBe('wa.me');
        expect(parsed.pathname).toBe('/5519999654866');
        expect(parsed.searchParams.get('text')).toContain('Tive um problema ao finalizar o pagamento');
        expect(parsed.searchParams.get('text')).toContain('Reserva: booking-123');
        expect(parsed.searchParams.get('text')).toContain('Hóspede: Maria Silva');
        expect(parsed.searchParams.get('text')).toContain('Acomodação: Suíte Superior');
        expect(parsed.searchParams.get('text')).toContain('Valor da tentativa: R$ 599,00');
    });
});
