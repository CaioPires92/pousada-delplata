const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

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

async function seed() {
    console.log('🌱 Seeding database with sample data...');

    // Delete existing data
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.rate.deleteMany();
    await prisma.inventoryAdjustment.deleteMany();
    await prisma.photo.deleteMany();
    await prisma.roomType.deleteMany();
    await prisma.guest.deleteMany();

    // Create Room Types with R$ 0.10 for testing
    console.log('Creating room types...');

    const apartamentoSuperior = await prisma.roomType.create({
        data: {
            name: 'Apartamento Superior',
            description: 'Conforto e vista privilegiada. Com ar-condicionado e ventilador de teto, próximo ao café da manhã.',
            capacity: 4,
            totalUnits: 3,
            basePrice: 0.10,
            amenities: 'Ar-condicionado, Ventilador de teto, Smart TV, WiFi',
            photos: {
                create: [
                    { url: '/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp' },
                    { url: '/fotos/ala-principal/apartamentos/superior/DSC_0076-1200.webp' },
                ]
            }
        },
    });

    const apartamentoTerreo = await prisma.roomType.create({
        data: {
            name: 'Apartamento Térreo',
            description: 'Acessibilidade e facilidade de acesso. Perfeito para famílias.',
            capacity: 3,
            totalUnits: 4,
            basePrice: 0.10,
            amenities: 'Ventilador de teto, TV, WiFi, Acessível',
            photos: {
                create: [
                    { url: '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0005-1200.webp' },
                ]
            }
        },
    });

    const chale = await prisma.roomType.create({
        data: {
            name: 'Chalé',
            description: 'Privacidade e contato com a natureza. Com varanda. Café da manhã a 70 metros.',
            capacity: 2,
            totalUnits: 2,
            basePrice: 0.10,
            amenities: 'Varanda, WiFi, Contato com natureza, Churrasqueira',
            photos: {
                create: [
                    { url: '/fotos/ala-chales/chales/IMG_0125-1200.webp' },
                    { url: '/fotos/ala-chales/chales/IMG_0122-1200.webp' },
                ]
            }
        },
    });

    const anexo = await prisma.roomType.create({
        data: {
            name: 'Apartamento Anexo',
            description: 'Acomodação prática e confortável. Sem varanda, com Smart TV. Ideal para quem busca praticidade. (Sem copa - microondas disponível no bar)',
            capacity: 3,
            totalUnits: 2,
            basePrice: 0.10,
            amenities: 'Smart TV, Sem varanda, Sem copa, Microondas no bar, WiFi',
            photos: {
                create: [
                    { url: '/fotos/ala-chales/apartamentos-anexo/IMG_0029-1200.webp' },
                    { url: '/fotos/ala-chales/apartamentos-anexo/IMG_0030-1200.webp' },
                ]
            }
        },
    });

    console.log('✅ Room types created with R$ 0.10 for testing');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.adminUser.upsert({
        where: { email: 'admin@delplata.com.br' },
        update: {},
        create: {
            email: 'admin@delplata.com.br',
            password: hashedPassword,
            name: 'Administrador',
        },
    });

    console.log('✅ Admin user created (email: admin@delplata.com.br, password: admin123)');

    console.log('🎉 Seeding completed!');
    console.log('\n📝 Summary:');
    console.log(`- ${await prisma.roomType.count()} room types`);
    console.log(`- ${await prisma.photo.count()} photos`);
    console.log(`- ${await prisma.adminUser.count()} admin users`);
    console.log('\n💰 All rooms set to R$ 0.10 for testing');
}

seed()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
