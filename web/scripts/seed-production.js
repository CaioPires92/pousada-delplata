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

async function safeSeed() {
    console.log('🌱 Safe Seeding (Production Mode)...');
    console.log('⚠️  Checking for Admin User...');

    // Create Admin User if not exists
    const adminEmail = 'admin@delplata.com.br';
    const adminExists = await prisma.adminUser.findUnique({
        where: { email: adminEmail }
    });

    if (!adminExists) {
        console.log('Creating Admin User...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.adminUser.create({
            data: {
                name: 'Administrador',
                email: adminEmail,
                password: hashedPassword,
            }
        });
        console.log('✅ Admin User created.');
    } else {
        console.log('ℹ️ Admin User already exists.');
    }

    console.log('⚠️  This script creates/updates rooms but preserves Bookings and Guests.');

    // Define the rooms we want
    const roomsData = [
        {
            name: 'Apartamento Superior',
            description: 'Apartamentos compostos por: Televisão LCD 39, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado, Tomadas 220v',
            capacity: 4,
            totalUnits: 3,
            basePrice: 499.00,
            amenities: 'Ar-condicionado, Ventilador de teto, Smart TV, WiFi',
            photos: [
                '/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0076-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0072-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0077-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0082-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0039-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0041-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0043-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0045-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0046-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0047-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0050-1200.webp',
                '/fotos/ala-principal/apartamentos/superior/DSC_0051-1200.webp',
            ]
        },
        {
            name: 'Apartamento Térreo',
            description: 'Apartamentos compostos por: TV Smart 32", Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado.\n\n⚠️ IMPORTANTE: A maioria dos aptos térreos não possui janelas',
            capacity: 3,
            totalUnits: 8,
            basePrice: 499.00,
            amenities: 'Ventilador de teto, TV, WiFi, Acessível',
            photos: [
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0005-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0006-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0009-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0010-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0001-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0003-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0015-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0017-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0018-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0022-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0024-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0027-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/sem-janelas/IMG_0127-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/sem-janelas/IMG_0128-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/sem-janelas/IMG_0130-1200.webp',
                '/fotos/ala-principal/apartamentos/terreo/sem-janelas/IMG_0131-1200.webp',
            ]
        },
        {
            name: 'Chalé',
            description: 'Privacidade e contato com a natureza. Com varanda. Café da manhã a 70 metros.',
            capacity: 3,
            totalUnits: 6,
            basePrice: 499.00,
            amenities: 'Varanda, WiFi, Contato com natureza, Churrasqueira',
            photos: [
                '/fotos/ala-chales/chales/IMG_0125-1200.webp',
                '/fotos/ala-chales/chales/IMG_0122-1200.webp',
                '/fotos/ala-chales/chales/IMG_0120-1200.webp',
                '/fotos/ala-chales/chales/IMG_0118-1200.webp',
                '/fotos/ala-chales/chales/IMG_0117-1200.webp',
                '/fotos/ala-chales/chales/IMG_0109-1200.webp',
                '/fotos/ala-chales/chales/IMG_0110-1200.webp',
                '/fotos/ala-chales/chales/IMG_0111-1200.webp',
                '/fotos/ala-chales/chales/IMG_0112-1200.webp',
                '/fotos/ala-chales/chales/IMG_0114-1200.webp',
                '/fotos/ala-chales/chales/IMG_0115-1200.webp',
            ]
        },
        {
            name: 'Apartamento Anexo',
            description: 'Acomodação prática e confortável. Sem varanda, com Smart TV. Ideal para quem busca praticidade. (Sem copa - microondas disponível no bar)',
            capacity: 3,
            totalUnits: 2,
            basePrice: 499.00,
            amenities: 'Smart TV, Sem varanda, Sem copa, Microondas no bar, WiFi',
            photos: [
                '/fotos/ala-chales/apartamentos-anexo/IMG_0029-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0030-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0031-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0033-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0034-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0037-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0038-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0040-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0042-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0044-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0046-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0048-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0050-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0051-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0054-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0055-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0056-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0058-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0059-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0069-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0070-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0072-1200.webp',
                '/fotos/ala-chales/apartamentos-anexo/IMG_0073-1200.webp',
            ]
        }
    ];

    for (const roomData of roomsData) {
        // Check if room exists
        const existingRoom = await prisma.roomType.findFirst({
            where: { name: roomData.name }
        });

        if (existingRoom) {
            console.log(`🔄 Updating existing room: ${roomData.name}`);
            await prisma.roomType.update({
                where: { id: existingRoom.id },
                data: {
                    description: roomData.description,
                    capacity: roomData.capacity,
                    totalUnits: roomData.totalUnits,
                    basePrice: roomData.basePrice,
                    amenities: roomData.amenities,
                }
            });
            // Note: Not updating photos here to avoid complexity with existing ones, 
            // but for a new room type (Anexo) in prod, it will go to 'else' block.
        } else {
            console.log(`✨ Creating NEW room: ${roomData.name}`);
            await prisma.roomType.create({
                data: {
                    name: roomData.name,
                    description: roomData.description,
                    capacity: roomData.capacity,
                    totalUnits: roomData.totalUnits,
                    basePrice: roomData.basePrice,
                    amenities: roomData.amenities,
                    photos: {
                        create: roomData.photos.map(url => ({ url }))
                    }
                }
            });
        }
    }

    console.log('✅ Safe Seed completed!');
}

safeSeed()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
