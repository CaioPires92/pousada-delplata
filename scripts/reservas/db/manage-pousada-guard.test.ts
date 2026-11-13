import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runCli, type RoomTypeDb } from './manage-pousada-cli';
import {
    FEE_LIMITS,
    GuardError,
    PRICE_LIMITS,
    classifyDbTarget,
    parseArgs,
    parseStrictAmount,
    planAction,
    sanitizeErrorMessage,
} from './manage-pousada-guard';

const LOCAL = 'file:./dev.db';
const SECRET = 'SEGREDO-NAO-VAZAR-0123456789abcdefghij';
const REMOTE = `libsql://user:senha123@pousada-exemplo.turso.io/db?authToken=${SECRET}`;

function expectGuard(fn: () => unknown, code: number, message?: RegExp) {
    let thrown: unknown;
    try {
        fn();
    } catch (error) {
        thrown = error;
    }
    expect(thrown, 'esperava GuardError').toBeInstanceOf(GuardError);
    expect((thrown as GuardError).exitCode).toBe(code);
    if (message) expect((thrown as GuardError).message).toMatch(message);
}

function plan(argv: string[], url: string | undefined = LOCAL) {
    return planAction(parseArgs(argv), url);
}

function makeFakeDb(countImpl?: () => Promise<number>) {
    const roomType = {
        count: vi.fn(async (_args?: unknown): Promise<number> => (countImpl ? countImpl() : 7)),
        updateMany: vi.fn(async (_args: unknown): Promise<{ count: number }> => ({ count: 7 })),
    };
    const db: RoomTypeDb = { roomType, $disconnect: vi.fn(async () => undefined) };
    return { db, roomType };
}

async function run(argv: string[], env: Record<string, string | undefined>, loadDb: () => Promise<RoomTypeDb>) {
    const lines: string[] = [];
    const code = await runCli(argv, env, loadDb, {
        log: (l) => lines.push(`LOG ${l}`),
        error: (l) => lines.push(`ERR ${l}`),
    });
    return { code, output: lines.join('\n') };
}

describe('package.json (riscos anteriores)', () => {
    const pkgPath = join(__dirname, '../../../package.json');
    const scripts: Record<string, string> = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts;

    it('não expõe atalhos de escrita para update-desc/prices/fees', () => {
        expect(scripts['db:update:desc']).toBeUndefined();
        expect(scripts['db:update:prices']).toBeUndefined();
        expect(scripts['db:update:fees']).toBeUndefined();
    });

    it('nenhum script db:update embute --confirm nem valores fixos', () => {
        const names = Object.keys(scripts).filter((name) => name.startsWith('db:update'));
        expect(names.length).toBeGreaterThan(0);
        for (const name of names) {
            expect(scripts[name], name).not.toMatch(/--confirm/);
            expect(scripts[name], name).not.toMatch(/--(price|extra|child)=/);
            expect(scripts[name], name).toMatch(/--dry-run/);
        }
    });

    it('preserva os comandos de dry-run', () => {
        for (const name of ['db:update', 'db:update:desc:dry', 'db:update:prices:dry', 'db:update:fees:dry']) {
            expect(scripts[name], name).toMatch(/--dry-run/);
        }
    });
});

describe('parser estrito de argumentos', () => {
    it('recusa flag desconhecida (typo --dryrun com --confirm=YES não pode virar escrita)', () => {
        expectGuard(() => parseArgs(['--action=update-prices', '--price=350', '--dryrun', '--confirm=YES']), 1, /desconhecida/);
    });

    it('recusa argumento posicional', () => {
        expectGuard(() => parseArgs(['update-prices']), 1, /posicional/);
    });

    it('recusa flag repetida (ex.: --price=350 --price=0.10)', () => {
        expectGuard(() => parseArgs(['--price=350', '--price=0.10']), 1, /repetida/);
        expectGuard(() => parseArgs(['--dry-run', '--dry-run']), 1, /repetida/);
    });

    it('recusa flag booleana com valor (--dry-run=false)', () => {
        expectGuard(() => parseArgs(['--dry-run=false']), 1, /não aceita valor/);
        expectGuard(() => parseArgs(['--allow-remote=no']), 1, /não aceita valor/);
    });

    it('aceita flags conhecidas', () => {
        expect(parseArgs(['--action=update-desc', '--dry-run', '--allow-remote', '--confirm=YES'])).toEqual({
            action: 'update-desc',
            'dry-run': true,
            'allow-remote': true,
            confirm: 'YES',
        });
    });
});

describe('preço (caso R$ 0,10 em todos os quartos)', () => {
    it('rejeita o valor que o script antigo gravava (0.10)', () => {
        expectGuard(() => plan(['--action=update-prices', '--price=0.10', '--confirm=YES']), 3, /faixa/);
    });

    it.each(['', '   ', 'abc', 'NaN', '-5', '0', '1e3', '350,50', '350.999', 'Infinity', '0x10', '0350', '00350', '+350'])(
        'rejeita preço inválido %j',
        (raw) => {
            expectGuard(() => parseStrictAmount(raw, 'price', PRICE_LIMITS), 3);
        }
    );

    it('rejeita ausência de --price e --price sem valor', () => {
        expectGuard(() => plan(['--action=update-prices', '--confirm=YES']), 3, /obrigatório/);
        expectGuard(() => plan(['--action=update-prices', '--price', '--confirm=YES']), 3, /obrigatório/);
    });

    it('rejeita fora da faixa e aceita exatamente os limites', () => {
        expectGuard(() => parseStrictAmount('49.99', 'price', PRICE_LIMITS), 3);
        expectGuard(() => parseStrictAmount('20000.01', 'price', PRICE_LIMITS), 3);
        expect(parseStrictAmount('50', 'price', PRICE_LIMITS)).toBe(50);
        expect(parseStrictAmount('20000', 'price', PRICE_LIMITS)).toBe(20000);
    });

    it('aceita preço explícito válido', () => {
        expect(plan(['--action=update-prices', '--price=350.50', '--confirm=YES'])).toEqual({
            action: 'update-prices',
            dryRun: false,
            price: 350.5,
        });
    });
});

describe('taxas', () => {
    it('exige --extra e --child explícitos (sem padrão 100/80)', () => {
        expectGuard(() => plan(['--action=update-fees', '--confirm=YES']), 3, /obrigatório/);
        expectGuard(() => plan(['--action=update-fees', '--extra=100', '--confirm=YES']), 3, /obrigatório/);
    });

    it('rejeita negativa, texto e acima do limite; aceita zero explícito', () => {
        expectGuard(() => parseStrictAmount('-1', 'extra', FEE_LIMITS), 3);
        expectGuard(() => parseStrictAmount('abc', 'child', FEE_LIMITS), 3);
        expectGuard(() => parseStrictAmount('2000.01', 'extra', FEE_LIMITS), 3);
        expect(plan(['--action=update-fees', '--extra=0', '--child=80', '--confirm=YES'])).toEqual({
            action: 'update-fees',
            dryRun: false,
            extra: 0,
            child: 80,
        });
    });
});

describe('confirmação, dry-run e ação', () => {
    it('escrita exige --confirm=YES exato', () => {
        for (const confirm of [[], ['--confirm'], ['--confirm=yes'], ['--confirm=SIM'], ['--confirm=']]) {
            expectGuard(() => plan(['--action=update-prices', '--price=350', ...confirm]), 2, /--confirm=YES/);
        }
    });

    it('dry-run não exige confirmação mas valida valores explícitos', () => {
        expect(plan(['--action=update-prices', '--price=350', '--dry-run'])).toMatchObject({ dryRun: true });
        expectGuard(() => plan(['--action=update-prices', '--dry-run']), 3, /obrigatório/);
    });

    it('rejeita ação ausente ou desconhecida', () => {
        expectGuard(() => plan(['--confirm=YES']), 1);
        expectGuard(() => plan(['--action=drop-all', '--confirm=YES']), 1);
    });
});

describe('banco remoto bloqueado por padrão', () => {
    it('bloqueia libsql://, https:// e URL ilegível, inclusive em dry-run', () => {
        for (const url of [REMOTE, 'https://exemplo.turso.io', 'isto nao e url', 'LIBSQL://EXEMPLO.TURSO.IO']) {
            expectGuard(() => plan(['--action=update-desc', '--dry-run'], url), 6, /--allow-remote/);
            expectGuard(() => plan(['--action=update-desc', '--confirm=YES'], url), 6, /--allow-remote/);
        }
    });

    it('bloqueia hosts que apenas contêm localhost/127.0.0.1 e IPv6 público', () => {
        for (const url of ['https://localhost.evil.com', 'libsql://127.0.0.1.nip.io', 'https://[2001:db8::1]']) {
            expectGuard(() => plan(['--action=update-desc', '--dry-run'], url), 6);
        }
    });

    it('bloqueia file:// com host (compartilhamento remoto)', () => {
        expectGuard(() => plan(['--action=update-desc', '--dry-run'], 'file://servidor/share/prod.db'), 6);
    });

    it('bloqueia quando DATABASE_URL não está definido ou está em branco', () => {
        expectGuard(() => planAction(parseArgs(['--action=update-desc', '--dry-run']), undefined), 6, /não definido/);
        expectGuard(() => plan(['--action=update-desc', '--dry-run'], '   '), 6);
    });

    it('permite local (file:, file:///, localhost) e remoto só com --allow-remote', () => {
        for (const url of ['file:./dev.db', 'file:/tmp/x.db', 'file:///tmp/x.db']) {
            expect(plan(['--action=update-desc', '--dry-run'], url)).toBeTruthy();
        }
        // localhost não-file pode ser túnel para um banco remoto: exige as mesmas confirmações (T1b).
        for (const [url, host] of [['http://localhost:8080', 'localhost'], ['http://127.0.0.1:8080', '127.0.0.1']]) {
            expectGuard(() => plan(['--action=update-desc', '--dry-run'], url), 6);
            expect(plan(['--action=update-desc', '--dry-run', '--allow-remote', `--confirm-host=${host}`], url)).toBeTruthy();
        }
        expect(
            plan(['--action=update-desc', '--dry-run', '--allow-remote', '--confirm-host=pousada-exemplo.turso.io'], REMOTE)
        ).toBeTruthy();
    });

    it('--allow-remote sozinho não basta: exige --confirm-host exato (T1b)', () => {
        const base = ['--action=update-desc', '--dry-run', '--allow-remote'];
        expectGuard(() => plan(base, REMOTE), 6, /confirm-host/);
        expectGuard(() => plan([...base, '--confirm-host=outro.turso.io'], REMOTE), 6, /confirm-host/);
        expectGuard(() => plan([...base, '--confirm-host=turso.io'], REMOTE), 6);
    });

    it('bloqueia file: que escapa do projeto (T1b)', () => {
        for (const url of ['file:../../../../etc/passwd.db', 'file:/etc/prod.db', 'file:/home/outro/prod.db']) {
            expectGuard(() => plan(['--action=update-desc', '--dry-run'], url), 6, /fora do projeto/);
        }
    });

    it('o bloqueio remoto vem antes da avaliação de valores', () => {
        expectGuard(() => plan(['--action=update-prices', '--price=0.10', '--confirm=YES'], REMOTE), 6);
    });
});

describe('credenciais nunca vazam', () => {
    it('o rótulo do destino não contém token, usuário, senha, query nem caminho', () => {
        const label = classifyDbTarget(REMOTE).label;
        expect(label).toBe('remoto (pousada-exemplo.turso.io)');
        expect(label).not.toMatch(/SEGREDO|senha123|user|authToken/);
        expect(classifyDbTarget('file:/home/caio/segredo/prod.db').label).toBe('arquivo local (file:)');
    });

    it('sanitizeErrorMessage remove URLs, caminhos file: e tokens longos, e só usa a 1ª linha', () => {
        const message = sanitizeErrorMessage(
            new Error(`Falha em ${REMOTE} e file:/home/caio/prod.db token ${SECRET}\nstack: libsql://outra.turso.io`)
        );
        expect(message).not.toMatch(/SEGREDO|senha123|authToken|libsql:|file:|outra/);
        expect(message).toContain('[url removida]');
        expect(sanitizeErrorMessage(undefined)).toBe('falha desconhecida');
    });

    it('mensagens de bloqueio não ecoam a URL', () => {
        for (const url of [REMOTE, `isto nao e url ${SECRET}`]) {
            try {
                plan(['--action=update-desc', '--dry-run'], url);
            } catch (error) {
                expect((error as Error).message).not.toMatch(/SEGREDO|senha123|authToken|libsql:/);
            }
        }
    });
});

describe('runCli (comportamento ponta a ponta com banco fake)', () => {
    const LOCAL_ENV = { DATABASE_URL: LOCAL };

    it('bloqueio remoto: o banco nunca é carregado', async () => {
        const loadDb = vi.fn(async () => makeFakeDb().db);
        const { code, output } = await run(['--action=update-desc', '--dry-run'], { DATABASE_URL: REMOTE }, loadDb);
        expect(code).toBe(6);
        expect(loadDb).not.toHaveBeenCalled();
        expect(output).not.toMatch(/SEGREDO|senha123|authToken|libsql:/);
    });

    it('argumento inválido, flag desconhecida ou preço antigo: o banco nunca é carregado', async () => {
        const cases = [
            ['--action=update-prices', '--price=0.10', '--confirm=YES'],
            ['--action=update-prices', '--price=350', '--dryrun', '--confirm=YES'],
            ['--action=update-prices', '--confirm=YES'],
            ['--action=update-prices', '--price=350'],
        ];
        for (const argv of cases) {
            const loadDb = vi.fn(async () => makeFakeDb().db);
            const { code } = await run(argv, LOCAL_ENV, loadDb);
            expect(code, argv.join(' ')).not.toBe(0);
            expect(loadDb, argv.join(' ')).not.toHaveBeenCalled();
        }
    });

    it('dry-run só conta: updateMany nunca é chamado', async () => {
        for (const argv of [
            ['--action=update-desc', '--dry-run'],
            ['--action=update-prices', '--price=350', '--dry-run'],
            ['--action=update-fees', '--extra=100', '--child=80', '--dry-run'],
        ]) {
            const { db, roomType } = makeFakeDb();
            const { code } = await run(argv, LOCAL_ENV, async () => db);
            expect(code).toBe(0);
            expect(roomType.updateMany).not.toHaveBeenCalled();
            expect(roomType.count).toHaveBeenCalled();
            expect(db.$disconnect).toHaveBeenCalledTimes(1);
        }
    });

    it('update-desc grava somente description, nunca taxas nem preço (mesmo com --extra/--child na linha)', async () => {
        const { db, roomType } = makeFakeDb();
        const { code } = await run(['--action=update-desc', '--extra=999', '--child=999', '--confirm=YES'], LOCAL_ENV, async () => db);
        expect(code).toBe(0);
        expect(roomType.updateMany).toHaveBeenCalledTimes(4);
        for (const [args] of roomType.updateMany.mock.calls as unknown as [{ data: Record<string, unknown> }][]) {
            expect(Object.keys(args.data)).toEqual(['description']);
        }
    });

    it('update-prices grava somente basePrice com o valor explícito', async () => {
        const { db, roomType } = makeFakeDb();
        const { code } = await run(['--action=update-prices', '--price=350.5', '--confirm=YES'], LOCAL_ENV, async () => db);
        expect(code).toBe(0);
        expect(roomType.updateMany).toHaveBeenCalledTimes(1);
        expect(roomType.updateMany).toHaveBeenCalledWith({ data: { basePrice: 350.5 } });
    });

    it('update-fees grava somente as taxas explícitas', async () => {
        const { db, roomType } = makeFakeDb();
        const { code } = await run(['--action=update-fees', '--extra=120', '--child=90', '--confirm=YES'], LOCAL_ENV, async () => db);
        expect(code).toBe(0);
        expect(roomType.updateMany).toHaveBeenCalledWith({ data: { extraAdultFee: 120, child6To11Fee: 90 } });
    });

    it('erro do banco contendo URL/token é sanitizado e devolve código 5', async () => {
        const { db } = makeFakeDb(async () => {
            throw new Error(`Error opening ${REMOTE} token ${SECRET}`);
        });
        const { code, output } = await run(['--action=update-desc', '--dry-run'], LOCAL_ENV, async () => db);
        expect(code).toBe(5);
        expect(output).not.toMatch(/SEGREDO|senha123|authToken|libsql:/);
        expect(db.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('falha ao carregar o banco (ex.: URL inválida no cliente) é tratada sem vazar a URL', async () => {
        const { code, output } = await run(['--action=update-desc', '--dry-run'], LOCAL_ENV, async () => {
            throw new Error(`invalid url ${REMOTE}`);
        });
        expect(code).toBe(5);
        expect(output).not.toMatch(/SEGREDO|senha123|authToken|libsql:/);
    });

    it('a saída de sucesso nunca contém a DATABASE_URL', async () => {
        const url = 'file:./segredo-local-NAO-IMPRIMIR.db';
        const { db } = makeFakeDb();
        const { output } = await run(['--action=update-desc', '--dry-run'], { DATABASE_URL: url }, async () => db);
        expect(output).not.toMatch(/segredo-local|NAO-IMPRIMIR|\.db/);
    });
});
