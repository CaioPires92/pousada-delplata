import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMailMock = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: 'msg-1' }));

vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(() => ({
            sendMail: sendMailMock,
        })),
    },
}));

const bookingEmailData = {
    guestName: 'Maria Silva',
    guestEmail: 'maria@example.com',
    guestPhone: '11999999999',
    bookingId: 'booking-12345678',
    roomName: 'Apartamento Térreo',
    checkIn: new Date('2026-07-20T12:00:00Z'),
    checkOut: new Date('2026-07-21T12:00:00Z'),
    totalPrice: 599,
    paymentMethod: 'CREDIT_CARD',
    paymentInstallments: 1,
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'APPROVED',
};

describe('booking emails', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SMTP_USER = 'smtp@example.com';
        process.env.SMTP_PASS = 'secret';
        process.env.CONTACT_RECEIVER_EMAIL = 'hotel@example.com';
    });

    it('sends confirmation voucher only to the guest', async () => {
        const { sendBookingConfirmationEmail } = await import('./email');

        await sendBookingConfirmationEmail(bookingEmailData);

        expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
            to: 'maria@example.com',
            subject: expect.stringContaining('Voucher de Hospedagem'),
        }));
        expect(sendMailMock.mock.calls[0][0]).not.toHaveProperty('cc');
        expect(sendMailMock.mock.calls[0][0]).not.toHaveProperty('bcc');
    });

    it('rejects recipient lists and structured addresses before Nodemailer', async () => {
        const { sendBookingConfirmationEmail } = await import('./email');

        const result = await sendBookingConfirmationEmail({
            ...bookingEmailData,
            guestEmail: 'maria@example.com, attacker@example.net',
        });

        expect(result).toEqual({ success: false, error: 'INVALID_EMAIL_RECIPIENT' });
        expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('does not return SMTP details when confirmation delivery fails', async () => {
        const { sendBookingConfirmationEmail } = await import('./email');
        sendMailMock.mockRejectedValueOnce(new Error('SMTP rejected maria@example.com'));

        const result = await sendBookingConfirmationEmail(bookingEmailData);

        expect(result).toEqual({ success: false, error: 'EMAIL_SEND_FAILED' });
        expect(JSON.stringify(result)).not.toContain('maria@example.com');
        expect(JSON.stringify(result)).not.toContain('SMTP rejected');
    });

    it('escapes persisted guest fields before rendering confirmation HTML', async () => {
        const { sendBookingConfirmationEmail } = await import('./email');

        await sendBookingConfirmationEmail({
            ...bookingEmailData,
            guestName: '<img src=x onerror=alert(1)>',
        });

        const message = sendMailMock.mock.calls[0][0];
        expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(message.html).not.toContain('<img src=x onerror=alert(1)>');
    });

    it('keeps hotel in bcc for pending recovery emails', async () => {
        const { sendBookingPendingEmail } = await import('./email');

        await sendBookingPendingEmail(bookingEmailData);

        expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
            to: 'maria@example.com',
            bcc: ['hotel@example.com'],
            subject: expect.stringContaining('Continue sua reserva'),
        }));
    });

    it('escapes public contact content and keeps a single validated reply-to address', async () => {
        const { sendContactEmail } = await import('./email');

        await sendContactEmail({
            name: '<img src=x onerror=alert(1)>',
            email: 'guest@example.com',
            phone: '<b>123</b>',
            subject: 'Ajuda\r\nBcc: attacker@example.net',
            message: '<script>alert(1)</script>',
        });

        const message = sendMailMock.mock.calls[0][0];
        expect(message.replyTo).toBe('guest@example.com');
        expect(message.subject).not.toContain('\n');
        expect(message.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(message.html).not.toContain('<script>');
    });

    it('envia o desconto como um convite pessoal para o hóspede voltar', async () => {
        const { sendGuestDiscountEmail } = await import('./email');

        await sendGuestDiscountEmail({
            guestName: 'Maria Silva',
            guestEmail: 'maria@example.com',
            code: 'VOLTE-ABC123',
            discountLabel: '10% de desconto',
            expiresAt: new Date('2026-08-31T12:00:00Z'),
            bookingUrl: 'https://www.pousadadelplata.com.br/reservar?promo=VOLTE-ABC123',
        });

        expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
            to: 'maria@example.com',
            subject: 'Um convite para você voltar à Pousada Delplata',
            html: expect.stringMatching(/Gostaríamos de receber você novamente[\s\S]*Planejar minha próxima estadia/),
        }));
    });

    it('envia o convite de retorno sem mencionar desconto quando não há cupom', async () => {
        const { sendGuestDiscountEmail } = await import('./email');

        await sendGuestDiscountEmail({
            guestName: 'Maria Silva',
            guestEmail: 'maria@example.com',
            bookingUrl: 'https://www.pousadadelplata.com.br/reservar',
        });

        const message = sendMailMock.mock.calls[0][0];
        expect(message.html).toContain('Gostaríamos de receber você novamente');
        expect(message.html).not.toContain('Seu cupom');
        expect(message.html).not.toContain('Não cumulativo');
    });
});
