import prisma from '../src/lib/prisma';

// --- PAINEL DE CONTROLE (Edite aqui) ---
const CONFIG = {
    superior: {
        desc: "Apartamentos compostos por: Televisão LCD 39, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado. Tomadas 220v.",
        extraAdult: 100,
        childFee: 80
    },
    terreo: {
        desc: "Apartamentos compostos por: TV Smart 32, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado. Tomadas 220v. A maioria dos aptos térreos não possui janelas.",
        extraAdult: 100,
        childFee: 80
    },
    anexo: {
        desc: "Localizados na ala anexa (a 70 metros da ala principal). Compostos por: TV Smart 32 polegadas, Frigobar e Ventilador de Teto. As tomadas são 110v.",
        extraAdult: 100,
        childFee: 80
    },
    chale: {
        desc: "Localizados na ala anexa (a 70 metros da ala principal). Compostos por: Varanda com rede, TV 32 polegadas, Frigobar e Ventilador de Teto. As tomadas são 110v.",
        extraAdult: 100,
        childFee: 80
    }
};

async function main() {
    console.log('🚀 Iniciando atualização global (Turso)...');
    try {
        // Update Superior
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Superior' } },
            data: { description: CONFIG.superior.desc, extraAdultFee: CONFIG.superior.extraAdult, child6To11Fee: CONFIG.superior.childFee }
        });

        // Update Térreo
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Térreo' } },
            data: { description: CONFIG.terreo.desc, extraAdultFee: CONFIG.terreo.extraAdult, child6To11Fee: CONFIG.terreo.childFee }
        });

        // Update Anexo
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Anexo' } },
            data: { description: CONFIG.anexo.desc, extraAdultFee: CONFIG.anexo.extraAdult, child6To11Fee: CONFIG.anexo.childFee }
        });

        // Update Chalé
        await prisma.roomType.updateMany({
            where: { name: { contains: 'Chalé' } },
            data: { description: CONFIG.chale.desc, extraAdultFee: CONFIG.chale.extraAdult, child6To11Fee: CONFIG.chale.childFee }
        });

        console.log('✅ Tudo atualizado! Descrições, taxas e voltagens estão no ar.');
    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();