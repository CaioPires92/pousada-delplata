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

    it('keeps hotel in bcc for pending recovery emails', async () => {
        const { sendBookingPendingEmail } = await import('./email');

        await sendBookingPendingEmail(bookingEmailData);

        expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
            to: 'maria@example.com',
            bcc: ['hotel@example.com'],
            subject: expect.stringContaining('Continue sua reserva'),
        }));
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
