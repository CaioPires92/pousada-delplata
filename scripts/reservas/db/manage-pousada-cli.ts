import { GuardError, classifyDbTarget, parseArgs, planAction, sanitizeErrorMessage } from './manage-pousada-guard';

/** Subconjunto do Prisma usado aqui; permite testar com um fake, sem banco. */
export interface RoomTypeDb {
    roomType: {
        count(args?: unknown): Promise<number>;
        updateMany(args: unknown): Promise<{ count: number }>;
    };
    $disconnect(): Promise<void>;
}

// update-desc altera SOMENTE descrições. Taxas só mudam via --action=update-fees com valores explícitos.
const DESCRIPTIONS = {
    superior: "Apartamentos compostos por: Televisão LCD 39, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado. Tomadas 220v.",
    terreo: "Apartamentos compostos por: TV Smart 32, Frigobar, Guarda-roupa, Ventilador de teto e Ar-condicionado. Tomadas 220v. A maioria dos aptos térreos não possui janelas.",
    anexo: "Localizados na ala anexa (a 70 metros da ala principal). Compostos por: TV Smart 32 polegadas, Frigobar e Ventilador de Teto. As tomadas são 110v.",
    chale: "Localizados na ala anexa (a 70 metros da ala principal). Compostos por: Varanda com rede, TV 32 polegadas, Frigobar e Ventilador de Teto. As tomadas são 110v.",
};

async function updateDescriptions(db: RoomTypeDb, dryRun: boolean, log: (line: string) => void) {
    const targets = [
        { contains: 'Superior', description: DESCRIPTIONS.superior },
        { contains: 'Térreo', description: DESCRIPTIONS.terreo },
        { contains: 'Anexo', description: DESCRIPTIONS.anexo },
        { contains: 'Chalé', description: DESCRIPTIONS.chale },
    ];
    for (const t of targets) {
        if (dryRun) {
            const count = await db.roomType.count({ where: { name: { contains: t.contains } } });
            log(`dry-run update-desc "${t.contains}": ${count} registros`);
        } else {
            const res = await db.roomType.updateMany({
                where: { name: { contains: t.contains } },
                data: { description: t.description },
            });
            log(`update-desc "${t.contains}": ${res.count} registros`);
        }
    }
}

async function updatePrices(db: RoomTypeDb, value: number, dryRun: boolean, log: (line: string) => void) {
    if (dryRun) {
        log(`dry-run update-prices basePrice=${value}: ${await db.roomType.count()} registros`);
        return;
    }
    const res = await db.roomType.updateMany({ data: { basePrice: value } });
    log(`update-prices basePrice=${value}: ${res.count} registros`);
}

async function updateFees(db: RoomTypeDb, extraAdult: number, childFee: number, dryRun: boolean, log: (line: string) => void) {
    if (dryRun) {
        log(`dry-run update-fees extraAdultFee=${extraAdult} child6To11Fee=${childFee}: ${await db.roomType.count()} registros`);
        return;
    }
    const res = await db.roomType.updateMany({ data: { extraAdultFee: extraAdult, child6To11Fee: childFee } });
    log(`update-fees extraAdultFee=${extraAdult} child6To11Fee=${childFee}: ${res.count} registros`);
}

export interface CliIo {
    log: (line: string) => void;
    error: (line: string) => void;
}

/**
 * Executa o CLI e devolve o código de saída. O banco só é carregado (`loadDb`) depois que todas as
 * validações passam, e nenhuma mensagem contém URL, token ou objetos de erro completos.
 */
export async function runCli(
    argv: string[],
    env: Record<string, string | undefined>,
    loadDb: () => Promise<RoomTypeDb>,
    io: CliIo
): Promise<number> {
    let plan;
    try {
        plan = planAction(parseArgs(argv), env.DATABASE_URL);
    } catch (error) {
        if (error instanceof GuardError) {
            io.error(error.message);
            return error.exitCode;
        }
        io.error(`erro: ${sanitizeErrorMessage(error)}`);
        return 5;
    }

    io.log(`db=${classifyDbTarget(env.DATABASE_URL).label} dry-run=${plan.dryRun} action=${plan.action}`);

    let db: RoomTypeDb | undefined;
    try {
        db = await loadDb();
        if (plan.action === 'update-desc') {
            await updateDescriptions(db, plan.dryRun, io.log);
        } else if (plan.action === 'update-prices') {
            await updatePrices(db, plan.price, plan.dryRun, io.log);
        } else {
            await updateFees(db, plan.extra, plan.child, plan.dryRun, io.log);
        }
        io.log('ok');
        return 0;
    } catch (error) {
        io.error(`erro: ${sanitizeErrorMessage(error)}`);
        return 5;
    } finally {
        if (db) {
            await db.$disconnect().catch(() => undefined);
        }
    }
}
