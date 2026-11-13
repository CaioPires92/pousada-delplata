// Cria SOMENTE os tipos de quarto que ainda não existem (por nome).
//
// Garantias (T1b):
// - Quartos existentes NUNCA são alterados (preço, unidades, capacidade, descrição, comodidades ficam intactos).
// - Nenhum usuário administrador é criado aqui: use scripts/reservas/db/bootstrap-admin.ts.
// - Dry-run primeiro; a execução real exige o plano devolvido pelo dry-run.
//
// Uso:
//   node scripts/reservas/db/seed-production.js --dry-run
//   node scripts/reservas/db/seed-production.js --confirm=YES --expect-plan=<plan do dry-run>
// Banco remoto (inclusive o dry-run): acrescente --allow-remote --confirm-host=<hostname do banco>.
const {
    GuardError,
    parseFlagsStrict,
    sanitizeErrorMessage,
    assertSafeTarget,
    assertWriteConfirmation,
    assertPlanFlagPresent,
    assertPlanMatches,
    planHash,
    targetFingerprint,
    COMMON_VALUE_FLAGS,
    COMMON_BOOLEAN_FLAGS,
} = require('../../shared/db-safety');

const ROOMS = [
    {
        name: 'Apartamento Superior',
        description: 'Apartamentos compostos por: Televisão LCD 39, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado, Tomadas 220v',
        capacity: 4,
        totalUnits: 3,
        basePrice: 499.00,
        amenities: 'Ar-condicionado, Ventilador de teto, TV, WiFi, Tomadas 220v',
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
        amenities: 'Ar-condicionado, Ventilador de teto, Smart TV, WiFi, Tomadas 220v',
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
        amenities: 'Varanda, TV, WiFi, Ventilador de teto, Tomadas 110v',
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
        const flags = parseFlagsStrict(argv, { value: COMMON_VALUE_FLAGS, boolean: COMMON_BOOLEAN_FLAGS });
        const dryRun = flags['dry-run'] === true;

        assertWriteConfirmation(flags, dryRun);
        const target = assertSafeTarget(env.DATABASE_URL, flags);
        if (!dryRun) assertPlanFlagPresent(flags);
        if (target.kind === 'remote' && !env.DATABASE_AUTH_TOKEN) {
            throw new GuardError('DATABASE_AUTH_TOKEN ausente para banco remoto.', 1);
        }

        io.log('Safe Seeding (somente cria quartos ausentes)...');
        io.log(`Target database: ${target.label}`);

        prisma = await loadPrisma();

        const toCreate = [];
        for (const roomData of ROOMS) {
            const existingRoom = await prisma.roomType.findFirst({ where: { name: roomData.name } });
            if (existingRoom) {
                io.log(`Preservado (já existe, não será alterado): ${roomData.name}`);
            } else {
                io.log(`${dryRun ? 'WOULD CREATE' : 'Creating'}: ${roomData.name}`);
                toCreate.push(roomData);
            }
        }

        const plan = planHash({ target: target.label, db: targetFingerprint(env.DATABASE_URL), create: toCreate.map((room) => room.name).sort() });
        io.log(`plan=${plan}`);

        if (dryRun) {
            io.log('Dry run complete. No rows written.');
            return 0;
        }

        assertPlanMatches(flags, plan);
        for (const roomData of toCreate) {
            await prisma.roomType.create({
                data: {
                    name: roomData.name,
                    description: roomData.description,
                    capacity: roomData.capacity,
                    totalUnits: roomData.totalUnits,
                    basePrice: roomData.basePrice,
                    amenities: roomData.amenities,
                    photos: {
                        create: roomData.photos.map((url) => ({ url })),
                    },
                },
            });
        }
        io.log(`Safe Seed completed! Criados: ${toCreate.length}`);
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
    const { PrismaLibSQL } = require('@prisma/adapter-libsql');
    const { createClient } = require('@libsql/client');
    const loadPrisma = async () => {
        if (process.env.DATABASE_AUTH_TOKEN) {
            const libsql = createClient({
                url: String(process.env.DATABASE_URL || '').split('?')[0],
                authToken: process.env.DATABASE_AUTH_TOKEN,
            });
            return new PrismaClient({ adapter: new PrismaLibSQL(libsql) });
        }
        return new PrismaClient();
    };
    run(process.argv.slice(2), process.env, loadPrisma, {
        log: (line) => console.log(line),
        error: (line) => console.error(line),
    }).then((code) => process.exit(code));
}
