import prisma from '../src/lib/prisma';

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

function parseArgs(argv: string[]) {
    const out: Record<string, string | boolean> = {};
    for (const a of argv.slice(2)) {
        if (a.startsWith('--')) {
            const [k, v] = a.replace(/^--/, '').split('=');
            out[k] = v === undefined ? true : v;
        }
    }
    return out;
}

async function updateDescriptions(dryRun: boolean) {
    const targets = [
        { contains: 'Superior', data: { description: CONFIG.superior.desc, extraAdultFee: CONFIG.superior.extraAdult, child6To11Fee: CONFIG.superior.childFee } },
        { contains: 'Térreo', data: { description: CONFIG.terreo.desc, extraAdultFee: CONFIG.terreo.extraAdult, child6To11Fee: CONFIG.terreo.childFee } },
        { contains: 'Anexo', data: { description: CONFIG.anexo.desc, extraAdultFee: CONFIG.anexo.extraAdult, child6To11Fee: CONFIG.anexo.childFee } },
        { contains: 'Chalé', data: { description: CONFIG.chale.desc, extraAdultFee: CONFIG.chale.extraAdult, child6To11Fee: CONFIG.chale.childFee } },
    ];
    for (const t of targets) {
        if (dryRun) {
            const count = await prisma.roomType.count({ where: { name: { contains: t.contains } } });
            console.log(`dry-run update-desc "${t.contains}": ${count} registros`);
        } else {
            const res = await prisma.roomType.updateMany({ where: { name: { contains: t.contains } }, data: t.data });
            console.log(`update-desc "${t.contains}": ${res.count} registros`);
        }
    }
}

async function updatePrices(value: number, dryRun: boolean) {
    if (dryRun) {
        const count = await prisma.roomType.count();
        console.log(`dry-run update-prices basePrice=${value}: ${count} registros`);
        return;
    }
    const res = await prisma.roomType.updateMany({ data: { basePrice: value } });
    console.log(`update-prices basePrice=${value}: ${res.count} registros`);
}

async function updateFees(extraAdult: number, childFee: number, dryRun: boolean) {
    if (dryRun) {
        const count = await prisma.roomType.count();
        console.log(`dry-run update-fees extraAdultFee=${extraAdult} child6To11Fee=${childFee}: ${count} registros`);
        return;
    }
    const res = await prisma.roomType.updateMany({ data: { extraAdultFee: extraAdult, child6To11Fee: childFee } });
    console.log(`update-fees extraAdultFee=${extraAdult} child6To11Fee=${childFee}: ${res.count} registros`);
}

async function main() {
    const args = parseArgs(process.argv);
    const action = String(args['action'] || '').trim();
    const dryRun = Boolean(args['dry-run']);
    const confirm = String(args['confirm'] || '').trim().toUpperCase() === 'YES';
    const dbUrl = process.env.DATABASE_URL || '';
    console.log(`db=${dbUrl ? dbUrl : 'N/A'} dry-run=${dryRun} action=${action}`);

    if (!dryRun && !confirm) {
        console.error('bloqueado: passe --confirm=YES para executar sem dry-run');
        process.exit(2);
    }

    try {
        if (action === 'update-desc') {
            await updateDescriptions(dryRun);
        } else if (action === 'update-prices') {
            const price = Number(String(args['price'] || '').trim());
            if (!Number.isFinite(price)) {
                console.error('price inválido');
                process.exit(3);
            }
            await updatePrices(price, dryRun);
        } else if (action === 'update-fees') {
            const extra = Number(String(args['extra'] || '').trim());
            const child = Number(String(args['child'] || '').trim());
            if (!Number.isFinite(extra) || !Number.isFinite(child)) {
                console.error('parâmetros de taxa inválidos');
                process.exit(4);
            }
            await updateFees(extra, child, dryRun);
        } else {
            console.error('ação inválida. use --action=update-desc|update-prices|update-fees');
            process.exit(1);
        }
        console.log('ok');
    } catch (e) {
        console.error('erro', e);
        process.exit(5);
    } finally {
        await prisma.$disconnect();
    }
}

main();
