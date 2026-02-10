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

async function getLatestBooking() {
    const booking = await prisma.booking.findFirst({
        orderBy: {
            createdAt: 'desc',
        },
    });

    if (booking) {
        console.log('\n=== ÚLTIMA RESERVA ===');
        console.log('ID:', booking.id);
        console.log('\nPara testar a página de confirmação, acesse:');
        console.log(`\nhttps://pousada-delplata.vercel.app/reservar/confirmacao/${booking.id}?status=approved`);
        console.log('\nOu teste com status pendente:');
        console.log(`https://pousada-delplata.vercel.app/reservar/confirmacao/${booking.id}?status=pending`);
        console.log('\nOu teste com status rejeitado:');
        console.log(`https://pousada-delplata.vercel.app/reservar/confirmacao/${booking.id}?status=rejected`);
    } else {
        console.log('Nenhuma reserva encontrada.');
    }
}

getLatestBooking()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
