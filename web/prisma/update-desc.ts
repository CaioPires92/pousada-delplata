import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();


async function main() {
    console.log('Iniciando atualização das descrições no Turso (Pousada Delplata)...');

    try {
        // 1. Apartamento Superior (Ala Principal - 220v)
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Superior' } },
            data: {
                description: "Apartamentos compostos por: Televisão LCD 39, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado. Tomadas 220v."
            }
        });

        // 2. Apartamento Térreo (Ala Principal - 220v)
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Térreo' } },
            data: {
                description: "Apartamentos compostos por: TV Smart 32, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado. Tomadas 220v. A maioria dos aptos térreos não possui janelas."
            }
        });

        // 3. Anexo (Ala Anexa - 110v)
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Anexo' } },
            data: {
                description: "Localizados na ala anexa (a 70 metros da ala principal). Compostos por: TV Smart 32 polegadas, Frigobar e Ventilador. As tomadas são 110v."
            }
        });

        // 4. Chalé (Ala Anexa - 110v + Varanda)
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Chalé' } },
            data: {
                description: "Localizados na ala anexa (a 70 metros da ala principal). Compostos por: Varanda, TV Smart 32 polegadas, Frigobar e Ventilador. As tomadas são 110v."
            }
        });

        console.log('✅ Descrições atualizadas com sucesso no Turso!');
    } catch (error) {
        console.error('❌ Erro na atualização:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();