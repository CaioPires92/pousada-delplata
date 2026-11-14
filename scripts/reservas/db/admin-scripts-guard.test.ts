// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
// Scripts CommonJS exportam `run` e só executam main() quando chamados diretamente.
import { run as runDedupe } from './dedupe-rate-rows';
import { run as runSeedHospedin } from './seed-hospedin-ids';
import { run as runSeedProduction } from './seed-production';
import { run as runPrismaSeed } from '../../../prisma/seed';

const ROOT = join(__dirname, '../../..');
const SECRET = 'SEGREDO-tokenMuitoLongoQueNaoPodeVazar0123456789';
const HOST = 'pousada-exemplo.turso.io';
const REMOTE = `libsql://${HOST}?authToken=${SECRET}`;
const LOCAL = 'file:/tmp/vv-none.db';
const REMOTE_FLAGS = ['--allow-remote', `--confirm-host=${HOST}`];

function makeIo() {
    const out: string[] = [];
    const err: string[] = [];
    return { io: { log: (l: string) => out.push(l), error: (l: string) => err.push(l) }, out, err, all: () => [...out, ...err].join('\n') };
}
const planOf = (text: string) => /plan=([0-9a-f]{16})/.exec(text)?.[1] ?? '';

describe('package.json — nenhum atalho com confirmação embutida', () => {
    const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>;
    it('nenhum script contém --confirm=YES', () => {
        const offenders = Object.entries(scripts).filter(([, cmd]) => /--confirm(=|\s)/.test(cmd));
        expect(offenders).toEqual([]);
    });
    it('atalhos de escrita seguem existindo (sem confirmação) e os :dry foram preservados', () => {
        expect(scripts['db:hospedin:rates:dedupe']).toBe('node scripts/reservas/db/dedupe-rate-rows.js');
        expect(scripts['db:hospedin:seed']).toBe('node scripts/reservas/db/seed-hospedin-ids.js');
        expect(scripts['db:hospedin:rates:dedupe:dry']).toContain('--dry-run');
        expect(scripts['db:hospedin:seed:dry']).toContain('--dry-run');
    });
});

describe('dedupe-rate-rows — exclusão em massa de Rate', () => {
    const dup = (id: string) => ({ id, roomTypeId: 'rt1', roomName: 'Chalé', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-02T00:00:00.000Z', price: 350, cta: 0, ctd: 0, stopSell: 0, minLos: 1, createdAt: 'a', updatedAt: 'b' });
    function setup() {
        const execute = vi.fn(async (q: unknown) => (typeof q === 'string' ? { rows: [dup('r1'), dup('r2'), dup('r3')] } : { rows: [] }));
        const create = vi.fn(() => ({ execute }));
        return { execute, create, deletes: () => execute.mock.calls.filter(([q]) => typeof q !== 'string') };
    }
    const env = { DATABASE_URL: LOCAL };

    it('escrita sem --confirm=YES é recusada antes de conectar', async () => {
        const s = setup();
        const t = makeIo();
        expect(await runDedupe([], env, s.create, t.io)).toBe(2);
        expect(s.create).not.toHaveBeenCalled();
    });

    it('--confirm=YES sem plano (sem dry-run prévio) é recusado antes de conectar', async () => {
        const s = setup();
        const t = makeIo();
        expect(await runDedupe(['--confirm=YES'], env, s.create, t.io)).toBe(7);
        expect(s.create).not.toHaveBeenCalled();
    });

    it('plano divergente aborta sem nenhum DELETE', async () => {
        const s = setup();
        const t = makeIo();
        expect(await runDedupe(['--confirm=YES', '--expect-plan=0000000000000000'], env, s.create, t.io)).toBe(7);
        expect(s.deletes()).toHaveLength(0);
    });

    it('dry-run mostra plano e nunca apaga; execução com o plano apaga só os duplicados', async () => {
        const s = setup();
        const dry = makeIo();
        expect(await runDedupe(['--dry-run'], env, s.create, dry.io)).toBe(0);
        expect(s.deletes()).toHaveLength(0);
        const plan = planOf(dry.all());
        expect(plan).toHaveLength(16);

        const real = makeIo();
        expect(await runDedupe(['--confirm=YES', `--expect-plan=${plan}`], env, s.create, real.io)).toBe(0);
        expect(s.deletes()).toHaveLength(2); // mantém 1 de 3
    });

    it('remoto: bloqueado sem host; com --allow-remote + --confirm-host funciona; sem vazar URL/token', async () => {
        const remoteEnv = { DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: SECRET };
        const s = setup();
        const blocked = makeIo();
        expect(await runDedupe(['--dry-run'], remoteEnv, s.create, blocked.io)).toBe(6);
        expect(await runDedupe(['--dry-run', '--allow-remote'], remoteEnv, s.create, blocked.io)).toBe(6);
        expect(s.create).not.toHaveBeenCalled();

        const ok = makeIo();
        expect(await runDedupe(['--dry-run', ...REMOTE_FLAGS], remoteEnv, s.create, ok.io)).toBe(0);
        for (const text of [blocked.all(), ok.all()]) expect(text).not.toMatch(/SEGREDO|authToken|libsql:|tokenMuito/);
    });

    it('rejeita typo de flag e banco local fora do projeto', async () => {
        const s = setup();
        expect(await runDedupe(['--dryrun', '--confirm=YES'], env, s.create, makeIo().io)).toBe(1);
        expect(await runDedupe(['--dry-run'], { DATABASE_URL: 'file:../../../../etc/x.db' }, s.create, makeIo().io)).toBe(6);
        expect(s.create).not.toHaveBeenCalled();
    });
});

describe('seed-hospedin-ids — altera externalId', () => {
    function setup() {
        const update = vi.fn(async () => ({}));
        const prisma = {
            roomType: { findFirst: vi.fn(async ({ where }: { where: { name: string } }) => ({ id: `id-${where.name}`, name: where.name, externalId: null })), update },
            $disconnect: vi.fn(async () => undefined),
        };
        return { prisma, update, load: vi.fn(async () => prisma) };
    }
    const env = { DATABASE_URL: LOCAL };

    it('exige confirm, plano e host remoto; dry-run não escreve', async () => {
        const s = setup();
        expect(await runSeedHospedin([], env, s.load, makeIo().io)).toBe(2);
        expect(await runSeedHospedin(['--confirm=YES'], env, s.load, makeIo().io)).toBe(7);
        expect(await runSeedHospedin(['--dry-run'], { DATABASE_URL: REMOTE }, s.load, makeIo().io)).toBe(6);
        expect(s.load).not.toHaveBeenCalled();

        const dry = makeIo();
        expect(await runSeedHospedin(['--dry-run'], env, s.load, dry.io)).toBe(0);
        expect(s.update).not.toHaveBeenCalled();

        expect(await runSeedHospedin(['--confirm=YES', '--expect-plan=0000000000000000'], env, s.load, makeIo().io)).toBe(7);
        expect(s.update).not.toHaveBeenCalled();

        expect(await runSeedHospedin(['--confirm=YES', `--expect-plan=${planOf(dry.all())}`], env, s.load, makeIo().io)).toBe(0);
        expect(s.update).toHaveBeenCalledTimes(4);
    });
});

describe('seed-production — nunca sobrescreve nem cria admin', () => {
    function setup(existing: string[]) {
        const create = vi.fn(async () => ({}));
        const update = vi.fn(async () => ({}));
        const adminCreate = vi.fn(async () => ({}));
        const prisma = {
            roomType: { findFirst: vi.fn(async ({ where }: { where: { name: string } }) => (existing.includes(where.name) ? { id: 'x' } : null)), create, update, updateMany: update },
            adminUser: { findUnique: vi.fn(), create: adminCreate },
            $disconnect: vi.fn(async () => undefined),
        };
        return { prisma, create, update, adminCreate, load: vi.fn(async () => prisma) };
    }
    const env = { DATABASE_URL: LOCAL };

    it('o código não contém senha fixa nem criação de admin', () => {
        const src = readFileSync(join(__dirname, 'seed-production.js'), 'utf8');
        expect(src).not.toMatch(/admin123|bcrypt|adminUser\.create|passwordHash/);
        expect(src).not.toMatch(/roomType\.update/);
    });

    it('dry-run não escreve; execução cria só os quartos que faltam e preserva existentes', async () => {
        const s = setup(['Apartamento Superior']);
        const dry = makeIo();
        expect(await runSeedProduction(['--dry-run'], env, s.load, dry.io)).toBe(0);
        expect(s.create).not.toHaveBeenCalled();

        expect(await runSeedProduction(['--confirm=YES'], env, s.load, makeIo().io)).toBe(7);
        expect(await runSeedProduction(['--confirm=YES', '--expect-plan=0000000000000000'], env, s.load, makeIo().io)).toBe(7);
        expect(s.create).not.toHaveBeenCalled();

        expect(await runSeedProduction(['--confirm=YES', `--expect-plan=${planOf(dry.all())}`], env, s.load, makeIo().io)).toBe(0);
        expect(s.create).toHaveBeenCalledTimes(3);
        expect(s.update).not.toHaveBeenCalled();
        expect(s.adminCreate).not.toHaveBeenCalled();
    });

    it('--overwrite-existing e --create-admin não existem mais (flag desconhecida)', async () => {
        const s = setup(['Apartamento Superior']);
        for (const flag of ['--overwrite-existing', '--create-admin']) {
            expect(await runSeedProduction(['--confirm=YES', flag], env, s.load, makeIo().io)).toBe(1);
        }
        expect(s.update).not.toHaveBeenCalled();
        expect(s.adminCreate).not.toHaveBeenCalled();
    });

    it('remoto exige host confirmado', async () => {
        const s = setup([]);
        expect(await runSeedProduction(['--dry-run'], { DATABASE_URL: REMOTE }, s.load, makeIo().io)).toBe(6);
        expect(s.load).not.toHaveBeenCalled();
    });
});

describe('prisma/seed.js — seed destrutivo', () => {
    function setup(count: number, bookings = 0) {
        const del = () => vi.fn(async () => ({ count: 0 }));
        const prisma = {
            inventoryAdjustment: { deleteMany: del(), create: vi.fn(async () => ({})) },
            rate: { deleteMany: del(), create: vi.fn(async () => ({})) },
            photo: { deleteMany: del(), create: vi.fn(async () => ({})) },
            roomType: { count: vi.fn(async () => count), deleteMany: del(), create: vi.fn(async () => ({ id: 'rt' })) },
            booking: { count: vi.fn(async () => bookings) },
            $disconnect: vi.fn(async () => undefined),
        };
        return { prisma, load: vi.fn(async () => prisma) };
    }
    const local = { DATABASE_URL: 'file:./dev.db' };

    it('recusa banco remoto, ausente e local fora do projeto, sem carregar o Prisma', async () => {
        const s = setup(0);
        expect(await runPrismaSeed([], { DATABASE_URL: REMOTE, ALLOW_DESTRUCTIVE_SEED: 'YES' }, s.load, makeIo().io)).toBe(6);
        expect(await runPrismaSeed([], {}, s.load, makeIo().io)).toBe(6);
        expect(await runPrismaSeed([], { DATABASE_URL: 'file:/etc/prod.db', ALLOW_DESTRUCTIVE_SEED: 'YES' }, s.load, makeIo().io)).toBe(6);
        expect(s.load).not.toHaveBeenCalled();
    });

    it('banco local com quartos existentes não é apagado sem ALLOW_DESTRUCTIVE_SEED=YES', async () => {
        const s = setup(4);
        const t = makeIo();
        expect(await runPrismaSeed([], local, s.load, t.io)).toBe(4);
        expect(s.prisma.roomType.deleteMany).not.toHaveBeenCalled();
        expect(s.prisma.rate.deleteMany).not.toHaveBeenCalled();
        expect(s.prisma.roomType.create).not.toHaveBeenCalled();
        expect(await runPrismaSeed([], { ...local, ALLOW_DESTRUCTIVE_SEED: 'sim' }, s.load, t.io)).toBe(4);
        expect(s.prisma.roomType.deleteMany).not.toHaveBeenCalled();
    });

    it('banco local vazio é semeado; override explícito permite recriar', async () => {
        const empty = setup(0);
        expect(await runPrismaSeed([], local, empty.load, makeIo().io)).toBe(0);
        expect(empty.prisma.roomType.create).toHaveBeenCalledTimes(4);

        const full = setup(4);
        expect(await runPrismaSeed([], { ...local, ALLOW_DESTRUCTIVE_SEED: 'YES' }, full.load, makeIo().io)).toBe(0);
        expect(full.prisma.roomType.deleteMany).toHaveBeenCalledTimes(1);
        expect(full.prisma.roomType.create).toHaveBeenCalledTimes(4);
    });

    it('com reservas existentes aborta ANTES de apagar qualquer coisa, mesmo com override', async () => {
        const s = setup(4, 2);
        expect(await runPrismaSeed([], { ...local, ALLOW_DESTRUCTIVE_SEED: 'YES' }, s.load, makeIo().io)).toBe(4);
        for (const model of [s.prisma.inventoryAdjustment, s.prisma.rate, s.prisma.photo, s.prisma.roomType]) {
            expect(model.deleteMany).not.toHaveBeenCalled();
        }
    });

    it('localhost não-file (possível túnel para produção) é recusado', async () => {
        const s = setup(0);
        for (const url of ['http://localhost:8080', 'libsql://127.0.0.1:8080']) {
            expect(await runPrismaSeed([], { DATABASE_URL: url, ALLOW_DESTRUCTIVE_SEED: 'YES' }, s.load, makeIo().io)).toBe(6);
        }
        expect(s.load).not.toHaveBeenCalled();
    });

    it('argumentos inesperados são recusados', async () => {
        const s = setup(0);
        expect(await runPrismaSeed(['--force'], local, s.load, makeIo().io)).toBe(1);
        expect(s.load).not.toHaveBeenCalled();
    });
});

describe('scripts desativados (sem consumidores) e migração com host-confirm', { timeout: 90000 }, () => {
    const disabledJs = [
        'scripts/reservas/db/final-db-fix.js',
        'scripts/reservas/db/fix-rate-dates.js',
        'scripts/reservas/db/fix-rate-dates-iso.js',
        'scripts/reservas/maintenance/fix-rate-dates-hard.js',
        'scripts/reservas/maintenance/fix-rate-dates-sqlish-to-iso.js',
    ];
    const disabledTs = ['scripts/reservas/maintenance/force-update.ts', 'scripts/reservas/maintenance/update-rooms.ts'];
    // Ambiente mínimo e fictício: nunca herda credenciais reais do processo de teste.
    const childEnv = { PATH: process.env.PATH, DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: SECRET } as unknown as NodeJS.ProcessEnv;

    it.each([...disabledJs, ...disabledTs])('%s não contém mais código de escrita', (file) => {
        const src = readFileSync(join(ROOT, file), 'utf8');
        expect(src).not.toMatch(/UPDATE\s+Rate|DELETE\s+FROM|updateMany|deleteMany|prisma\.|createClient|PrismaClient/i);
        expect(src).toMatch(/desativado/i);
    });

    it.each(disabledJs)('%s encerra com erro sem conectar nem vazar credenciais', (file) => {
        const r = spawnSync(process.execPath, [join(ROOT, file)], { cwd: tmpdir(), env: childEnv, encoding: 'utf8', timeout: 20000 });
        expect(r.status).toBe(1);
        expect(`${r.stdout}${r.stderr}`).toMatch(/desativado/i);
        expect(`${r.stdout}${r.stderr}`).not.toMatch(/SEGREDO|authToken|libsql:/);
    });

    it.each(disabledTs)('%s encerra com erro (executado via tsx)', (file) => {
        const r = spawnSync(process.execPath, [join(ROOT, 'node_modules/tsx/dist/cli.mjs'), join(ROOT, file)], { cwd: tmpdir(), env: childEnv, encoding: 'utf8', timeout: 60000 });
        expect(r.status).toBe(1);
        expect(`${r.stdout}${r.stderr}`).toMatch(/desativado/i);
        expect(`${r.stdout}${r.stderr}`).not.toMatch(/SEGREDO|authToken|libsql:/);
    }, 90000);

    it('apply_migrations_turso exige confirmação e host antes de qualquer conexão', () => {
        const script = join(ROOT, 'scripts/reservas/db/apply_migrations_turso.js');
        const run = (args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: tmpdir(), env: childEnv, encoding: 'utf8', timeout: 20000 });
        const noFlags = run([]);
        expect(noFlags.status).toBe(2);
        const noHost = run(['--confirm=YES']);
        expect(noHost.status).toBe(6);
        const wrongHost = run(['--confirm=YES', '--allow-remote', '--confirm-host=outro.turso.io']);
        expect(wrongHost.status).toBe(6);
        for (const r of [noFlags, noHost, wrongHost]) expect(`${r.stdout}${r.stderr}`).not.toMatch(/SEGREDO|authToken|libsql:/);
    });
});
