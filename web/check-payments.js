require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

let prisma;

if (process.env.DATABASE_AUTH_TOKEN) {
    const libsql = createClient({
        url: process.env.DATABASE_URL,
        authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    prisma = new PrismaClient({ adapter });
} else {
    prisma = new PrismaClient();
}

async function checkPayments() {
    console.log('=== Últimas Reservas e Pagamentos ===\n');

    const bookings = await prisma.booking.findMany({
        include: {
            guest: true,
            roomType: true,
            payment: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 5,
    });

    if (bookings.length === 0) {
        console.log('Nenhuma reserva encontrada.');
        return;
    }

    bookings.forEach((booking, index) => {
        console.log(`\n--- Reserva ${index + 1} ---`);
        console.log(`ID: ${booking.id}`);
        console.log(`Hóspede: ${booking.guest.name}`);
        console.log(`Email: ${booking.guest.email}`);
        console.log(`Quarto: ${booking.roomType.name}`);
        console.log(`Check-in: ${new Date(booking.checkIn).toLocaleDateString('pt-BR')}`);
        console.log(`Check-out: ${new Date(booking.checkOut).toLocaleDateString('pt-BR')}`);
        console.log(`Valor: R$ ${Number(booking.totalPrice).toFixed(2)}`);
        console.log(`Status da Reserva: ${booking.status}`);

        if (booking.payment) {
            console.log(`\n💳 Pagamento:`);
            console.log(`   Status: ${booking.payment.status}`);
            console.log(`   Provider: ${booking.payment.provider}`);
            console.log(`   Provider ID: ${booking.payment.providerId || 'N/A'}`);
            console.log(`   Valor: R$ ${Number(booking.payment.amount).toFixed(2)}`);
        } else {
            console.log(`\n⚠️  Sem informação de pagamento`);
        }

        console.log(`Criado em: ${new Date(booking.createdAt).toLocaleString('pt-BR')}`);
    });
}

checkPayments()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
