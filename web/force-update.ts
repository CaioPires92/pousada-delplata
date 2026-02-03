import prisma from './src/lib/prisma';

async function run() {
    console.log("Iniciando atualização no Turso...");
    try {
        // Atualizando Apartamento Superior
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Superior' } },
            data: {
                description: "Apartamentos compostos por: Televisão LCD 39, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado. Tomadas 220v"
            }
        });

        // Atualizando Apartamento Térreo
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Térreo' } },
            data: {
                description: "Apartamentos compostos por: TV Smart 32, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado. IMPORTANTE: A maioria não possui janelas."
            }
        });

        console.log("✅ Descrições atualizadas com sucesso!");
    } catch (e) {
        console.error("❌ Erro:", e);
    } finally {
        await prisma.$disconnect();
    }
}

run();