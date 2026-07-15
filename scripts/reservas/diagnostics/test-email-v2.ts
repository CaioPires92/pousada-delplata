import { sendAdminRecoveryAlertEmail, sendBookingExpiredEmail, sendBookingPendingEmail } from '../../../src/lib/email';
import { randomUUID } from 'crypto';

const mockData = {
    guestName: 'Caio Teste',
    guestEmail: 'hospede@example.com',
    guestPhone: '5511999999999',
    bookingId: randomUUID(),
    roomName: 'Apartamento Térreo',
    checkIn: new Date(),
    checkOut: new Date(Date.now() + 86400000 * 2), // 2 dias depois
    totalPrice: 450.00,
    paymentMethod: 'PIX',
    paymentInstallments: null,
    adults: 2,
    children: 1,
    childrenAges: [5]
};

async function testEmails() {
    console.log('Enviando Email de 15 Minutos (Pending)...');
    await sendBookingPendingEmail(mockData);
    
    console.log('Enviando Email de 30 Minutos (Expired)...');
    await sendBookingExpiredEmail(mockData);

    console.log('Enviando Email de Alerta Admin...');
    await sendAdminRecoveryAlertEmail(mockData);
    
    console.log('Todos os emails de teste enviados!');
}

testEmails().catch(console.error);
