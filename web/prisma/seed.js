const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

let prisma;

if (process.env.DATABASE_AUTH_TOKEN && process.env.DATABASE_URL?.startsWith('libsql:')) {
    const libsql = createClient({
        url: process.env.DATABASE_URL,
        authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    prisma = new PrismaClient({ adapter });
} else {
    prisma = new PrismaClient();
}


async function seed() {
    console.log('🌱 Seeding database with sample data...');

    // 1. Limpeza de dados existentes
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.rate.deleteMany();
    await prisma.inventoryAdjustment.deleteMany();
    await prisma.photo.deleteMany();
    await prisma.roomType.deleteMany();
    await prisma.guest.deleteMany();

    // 2. Criação dos Tipos de Quarto
    console.log('Creating room types...');
    const roomData = [

        {
            name: 'Apartamento Térreo',
            description: 'TV Smart 32, Frigobar e Ar-condicionado.',
            capacity: 3,
            maxGuests: 3, // Adicionado explicitamente
            totalUnits: 8,
            basePrice: 599.00,
            amenities: 'Ventilador, TV, WiFi',
        },

        {
            name: 'Apartamento Superior',
            description: 'Televisão LCD 39, Frigobar, Ar condicionado.',
            capacity: 3,
            maxGuests: 3, // Adicionado explicitamente
            totalUnits: 8,
            basePrice: 699.00,
            amenities: 'Ar-condicionado, Smart TV, WiFi',
        },

        {
            name: 'Chalé',
            description: 'Privacidade e contato com a natureza.',
            capacity: 3,
            maxGuests: 3, // Adicionado explicitamente
            totalUnits: 6,
            basePrice: 499.00,
            amenities: 'Varanda, WiFi, Churrasqueira',
        },
        {
            name: 'Apartamento Anexo',
            description: 'Privacidade e contato com a natureza.',
            capacity: 3,
            maxGuests: 3, // Adicionado explicitamente
            totalUnits: 8,
            basePrice: 399.00,
            amenities: 'Varanda, WiFi, Churrasqueira',
        }
    ];

    for (const data of roomData) {
        await prisma.roomType.create({ data });
    }

    // 3. Gerar Tarifas (Crucial para a Disponibilidade)
    console.log('Generating rates for 30 days...');
    const rooms = await prisma.roomType.findMany();
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    for (const room of rooms) {
        for (let i = 0; i < 30; i++) {
            const start = new Date(today);
            start.setDate(today.getDate() + i);
            const end = new Date(start);
            end.setDate(start.getDate() + 1);

            await prisma.rate.create({
                data: {
                    roomTypeId: room.id,
                    startDate: start,
                    endDate: end,
                    price: room.basePrice,
                }
            });
        }
    }

    // 4. Criar Administrador
    const seedEmail = 'admin@delplata.com.br';
    const seedPasswordHash = await bcrypt.hash('admin123', 10);

    await prisma.adminUser.upsert({
        where: { email: seedEmail },
        update: { passwordHash: seedPasswordHash, isActive: true },
        create: {
            email: seedEmail,
            passwordHash: seedPasswordHash,
            name: 'Administrador',
            isActive: true,
        },
    });

    console.log('✅ Admin: admin@delplata.com.br / admin123');
    console.log('🎉 Seeding completed!');
}

seed()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });