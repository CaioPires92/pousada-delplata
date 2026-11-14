// Seed DESTRUTIVO de desenvolvimento: apaga inventário, tarifas, fotos e tipos de quarto e recria tudo.
//
// Proteções (T1b):
// - Nunca roda em banco remoto, ausente ou fora do projeto (sem override).
// - Em banco local que já tem tipos de quarto, só roda com ALLOW_DESTRUCTIVE_SEED=YES (variável de
//   ambiente, porque `prisma db seed` / `migrate reset` não repassam flags).
// - Banco local recém-criado (vazio) continua sendo semeado normalmente (ex.: scripts/shared/setup-local.js).
const {
    GuardError,
    parseFlagsStrict,
    sanitizeErrorMessage,
    assertSafeTarget,
} = require('../scripts/shared/db-safety');

const ROOMS = [
    {
        name: 'Apartamento Térreo',
        description: 'Apartamento na ala principal, próximo ao café da manhã, com Smart TV, frigobar, ventilador de teto e ar-condicionado.',
        capacity: 3,
        maxGuests: 4,
        inventoryFor4Guests: 2,
        includedAdults: 2,
        extraAdultFee: 100,
        child6To11Fee: 50,
        totalUnits: 8,
        basePrice: 599.00,
        amenities: 'Ar-condicionado, Ventilador de teto, Smart TV, WiFi',
        photo: '/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0005-1200.webp',
    },

    {
        name: 'Apartamento Superior',
        description: 'Apartamento na ala principal, próximo ao café da manhã, com Smart TV, frigobar, ventilador de teto e ar-condicionado.',
        capacity: 3,
        maxGuests: 4,
        inventoryFor4Guests: 2,
        includedAdults: 2,
        extraAdultFee: 100,
        child6To11Fee: 50,
        totalUnits: 8,
        basePrice: 699.00,
        amenities: 'Ar-condicionado, Ventilador de teto, Smart TV, WiFi',
        photo: '/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp',
    },

    {
        name: 'Chalé',
        description: 'Chalé com varanda, Smart TV e café da manhã a 70 metros da ala principal. Não possui ar-condicionado.',
        capacity: 3,
        maxGuests: 4,
        inventoryFor4Guests: 2,
        includedAdults: 2,
        extraAdultFee: 100,
        child6To11Fee: 50,
        totalUnits: 6,
        basePrice: 499.00,
        amenities: 'Varanda, Smart TV, WiFi, Ventilador de teto, Tomadas 110v',
        photo: '/fotos/ala-chales/chales/IMG_0109-1200.webp',
    },
    {
        name: 'Apartamento Anexo',
        description: 'Apartamento anexo com Smart TV, mais privacidade e apoio de micro-ondas no bar. Não possui varanda nem copa.',
        capacity: 3,
        maxGuests: 3,
        inventoryFor4Guests: 0,
        includedAdults: 2,
        extraAdultFee: 100,
        child6To11Fee: 50,
        totalUnits: 8,
        basePrice: 399.00,
        amenities: 'Smart TV, WiFi',
        photo: '/fotos/ala-chales/apartamentos-anexo/IMG_0029-1200.webp',
    }
];

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @param {() => Promise<any>} loadPrisma carregado somente depois que todas as proteções passam
 * @param {{ log: (l: string) => void, error: (l: string) => void }} io
 * @returns {Promise<number>} código de saída
 */
async function run(argv, env, loadPrisma, io) {
    let prisma;
    try {
        parseFlagsStrict(argv, { value: [], boolean: [] });

        const target = assertSafeTarget(env.DATABASE_URL, {});
        if (target.kind !== 'local') {
            throw new GuardError('bloqueado: este seed destrutivo só roda em banco local.', 6);
        }

        prisma = await loadPrisma();

        const existing = await prisma.roomType.count();
        if (existing > 0 && env.ALLOW_DESTRUCTIVE_SEED !== 'YES') {
            throw new GuardError(
                'bloqueado: o banco local já possui tipos de quarto. Este seed apaga tudo; defina ALLOW_DESTRUCTIVE_SEED=YES para confirmar.',
                4
            );
        }

        if (existing > 0) {
            // As exclusões abaixo não são transacionais; reservas referenciam RoomType e fariam o último
            // passo falhar depois de apagar inventário/tarifas. Aborta antes de apagar qualquer coisa.
            if ((await prisma.booking.count()) > 0) {
                throw new GuardError('bloqueado: o banco possui reservas; este seed apagaria tarifas e inventário sem poder concluir.', 4);
            }
            io.log('Deletando inventory, rates, photos e room types antigos...');
            await prisma.inventoryAdjustment.deleteMany({});
            await prisma.rate.deleteMany({});
            await prisma.photo.deleteMany({});
            await prisma.roomType.deleteMany({});
        }

        io.log('Inserindo novos quartos...');

        for (const acc of ROOMS) {
            const roomType = await prisma.roomType.create({
                data: {
                    name: acc.name,
                    description: acc.description,
                    capacity: acc.capacity,
                    maxGuests: acc.maxGuests,
                    inventoryFor4Guests: acc.inventoryFor4Guests,
                    includedAdults: acc.includedAdults,
                    totalUnits: acc.totalUnits,
                    basePrice: acc.basePrice,
                    extraAdultFee: acc.extraAdultFee,
                    child6To11Fee: acc.child6To11Fee,
                    amenities: acc.amenities,
                },
            });

            // Add a photo
            await prisma.photo.create({
                data: {
                    url: acc.photo,
                    roomTypeId: roomType.id,
                },
            });

            // Add inventory and rates for the next 30 days
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of day

            for (let i = 0; i < 30; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() + i);
                const dateKey = date.toISOString().split('T')[0];

                await prisma.inventoryAdjustment.create({
                    data: {
                        roomTypeId: roomType.id,
                        date: date,
                        dateKey: dateKey,
                        totalUnits: acc.totalUnits,
                        occupiedUnits: 0,
                    },
                });

                const nextDay = new Date(date);
                nextDay.setDate(nextDay.getDate() + 1);

                await prisma.rate.create({
                    data: {
                        roomTypeId: roomType.id,
                        startDate: date,
                        endDate: nextDay,
                        price: acc.basePrice,
                    },
                });
            }
        }

        io.log('Novos quartos criados com sucesso!');
        return 0;
    } catch (error) {
        if (error instanceof GuardError) {
            io.error(error.message);
            return error.exitCode;
        }
        io.error(`erro: ${sanitizeErrorMessage(error)}`);
        return 5;
    } finally {
        if (prisma) await prisma.$disconnect().catch(() => undefined);
    }
}

module.exports = { run, ROOMS };

if (require.main === module) {
    const { PrismaClient } = require('@prisma/client');
    run(process.argv.slice(2), process.env, async () => new PrismaClient(), {
        log: (line) => console.log(line),
        error: (line) => console.error(line),
    }).then((code) => process.exit(code));
}
