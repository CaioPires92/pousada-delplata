// @vitest-environment node
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    GuardError,
    assertPlanFlagPresent,
    assertPlanMatches,
    assertSafeTarget,
    assertWriteConfirmation,
    classifyDbTarget,
    parseFlagsStrict,
    planHash,
    sanitizeErrorMessage,
    targetFingerprint,
    validateLocalDbPath,
} from './db-safety';

const SPEC = { value: ['confirm', 'confirm-host', 'expect-plan'], boolean: ['dry-run', 'allow-remote'] } as const;
const SECRET = 'SEGREDO-tokenMuitoLongoQueNaoPodeVazar0123456789';
const REMOTE = `libsql://pousada-exemplo.turso.io?authToken=${SECRET}`;
const HOST = 'pousada-exemplo.turso.io';

function guardCode(fn: () => unknown): { code: number; message: string } {
    try {
        fn();
    } catch (error) {
        expect(error).toBeInstanceOf(GuardError);
        return { code: (error as GuardError).exitCode, message: (error as Error).message };
    }
    throw new Error('esperava GuardError');
}

describe('parseFlagsStrict', () => {
    it('recusa posicional, desconhecida, repetida e booleana com valor', () => {
        expect(guardCode(() => parseFlagsStrict(['x'], SPEC)).code).toBe(1);
        expect(guardCode(() => parseFlagsStrict(['--dryrun'], SPEC)).code).toBe(1);
        expect(guardCode(() => parseFlagsStrict(['--confirm=YES', '--confirm=YES'], SPEC)).code).toBe(1);
        expect(guardCode(() => parseFlagsStrict(['--dry-run=false'], SPEC)).code).toBe(1);
        expect(parseFlagsStrict(['--dry-run', '--confirm=YES'], SPEC)).toEqual({ 'dry-run': true, confirm: 'YES' });
    });
});

describe('assertSafeTarget — banco remoto exige host confirmado', () => {
    it('bloqueia remoto sem flags, com só --allow-remote, com host errado, sufixo e prefixo', () => {
        expect(guardCode(() => assertSafeTarget(REMOTE, {})).code).toBe(6);
        expect(guardCode(() => assertSafeTarget(REMOTE, { 'allow-remote': true })).code).toBe(6);
        for (const host of ['outro.turso.io', 'turso.io', `x.${HOST}`, `${HOST}.evil.com`, '']) {
            expect(guardCode(() => assertSafeTarget(REMOTE, { 'allow-remote': true, 'confirm-host': host })).code).toBe(6);
        }
        // confirm-host sem allow-remote também não basta
        expect(guardCode(() => assertSafeTarget(REMOTE, { 'confirm-host': HOST })).code).toBe(6);
    });

    it('libera somente com --allow-remote e hostname exato (case-insensitive)', () => {
        expect(assertSafeTarget(REMOTE, { 'allow-remote': true, 'confirm-host': HOST }).kind).toBe('remote');
        expect(assertSafeTarget(REMOTE, { 'allow-remote': true, 'confirm-host': HOST.toUpperCase() }).kind).toBe('remote');
    });

    it('URL ilegível ou ausente nunca é liberada, nem com flags', () => {
        expect(guardCode(() => assertSafeTarget('isto nao e url', { 'allow-remote': true, 'confirm-host': 'x' })).code).toBe(6);
        expect(guardCode(() => assertSafeTarget(undefined, {})).code).toBe(6);
        expect(guardCode(() => assertSafeTarget('file://servidor/share/prod.db', { 'allow-remote': true, 'confirm-host': 'servidor' })).code).toBe(6);
    });

    it('localhost não-file exige host confirmado (pode ser túnel para banco remoto)', () => {
        expect(guardCode(() => assertSafeTarget('http://localhost:8080', {})).code).toBe(6);
        expect(guardCode(() => assertSafeTarget('libsql://127.0.0.1:8080', { 'allow-remote': true })).code).toBe(6);
        expect(assertSafeTarget('http://localhost:8080', { 'allow-remote': true, 'confirm-host': 'localhost' }).kind).toBe('local');
    });

    it('sanitizeErrorMessage mascara caminhos de arquivo de erros de terceiros', () => {
        const message = sanitizeErrorMessage(new Error('Unable to open the database file at /home/caio/segredo/prod.db e C:\\Users\\caio\\x.db'));
        expect(message).not.toMatch(/caio|segredo|prod\.db/);
        expect(message).toContain('[caminho removido]');
    });

    it('targetFingerprint distingue bancos locais diferentes sem expor o caminho', () => {
        const a = targetFingerprint('file:./a.db');
        expect(a).toMatch(/^[0-9a-f]{8}$/);
        expect(targetFingerprint('file:./b.db')).not.toBe(a);
        expect(targetFingerprint('file:./a.db?x=1')).toBe(a);
    });

    it('mensagens nunca ecoam URL, token ou caminho', () => {
        const flagSets: Record<string, string | boolean>[] = [{}, { 'allow-remote': true }, { 'allow-remote': true, 'confirm-host': 'x' }];
        for (const flags of flagSets) {
            const { message } = guardCode(() => assertSafeTarget(REMOTE, flags));
            expect(message).not.toMatch(/SEGREDO|authToken|libsql:|tokenMuito/);
        }
        const { message } = guardCode(() => assertSafeTarget('file:../../../../etc/segredo-prod.db', {}));
        expect(message).not.toMatch(/segredo-prod|etc/);
    });
});

describe('validateLocalDbPath — isolamento do projeto', () => {
    const base = mkdtempSync(join(tmpdir(), 'vv-guard-'));
    const repo = join(base, 'repo');
    const outside = join(base, 'fora');
    mkdirSync(join(repo, 'prisma'), { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'prod.db'), '');
    symlinkSync(outside, join(repo, 'prisma', 'atalho'));
    // tmpDir isolado, diferente de `base`, para que "fora" realmente esteja fora.
    const tmpOnly = mkdtempSync(join(tmpdir(), 'vv-tmp-'));
    const opts = { repoRoot: repo, cwd: repo, tmpDir: tmpOnly };

    it('aceita caminhos dentro do repositório e da pasta temporária', () => {
        for (const url of ['file:./dev.db', 'file:dev.db', 'file:./sub/x.db?mode=rwc', `file:${join(repo, 'prisma', 'dev.db')}`, `file://${join(tmpOnly, 'x.db')}`, `file:${join(tmpOnly, 'x.db')}`]) {
            // `file://` + caminho absoluto começa com 3 barras
            expect(() => validateLocalDbPath(url, opts), url).not.toThrow();
        }
    });

    it('rejeita file:../../ que escapa, absolutos fora, UNC, NUL e codificação de ..', () => {
        for (const url of [
            'file:../../../../etc/prod.db',
            'file:./../../fora/prod.db',
            `file:${join(outside, 'prod.db')}`,
            'file:/etc/prod.db',
            'file:%2e%2e/%2e%2e/%2e%2e/etc/prod.db',
            'file:..\\..\\..\\..\\etc\\prod.db',
            'file:\\\\servidor\\share\\prod.db',
            'file:./a\0b.db',
            'file:',
        ]) {
            expect(guardCode(() => validateLocalDbPath(url, opts)).code, url).toBe(6);
        }
    });

    it('rejeita symlink dentro do repositório que aponta para fora', () => {
        expect(guardCode(() => validateLocalDbPath('file:./atalho/prod.db', opts)).code).toBe(6);
    });
});

describe('confirmação de escrita e plano', () => {
    it('escrita exige --confirm=YES exato; dry-run dispensa', () => {
        expect(guardCode(() => assertWriteConfirmation({}, false)).code).toBe(2);
        expect(guardCode(() => assertWriteConfirmation({ confirm: 'yes' }, false)).code).toBe(2);
        expect(() => assertWriteConfirmation({ confirm: 'YES' }, false)).not.toThrow();
        expect(() => assertWriteConfirmation({}, true)).not.toThrow();
    });

    it('planHash é estável, independe da ordem das chaves e muda com host ou alvos', () => {
        const a = planHash({ host: 'a', ids: ['1', '2'] });
        expect(a).toMatch(/^[0-9a-f]{16}$/);
        expect(planHash({ ids: ['1', '2'], host: 'a' })).toBe(a);
        expect(planHash({ host: 'b', ids: ['1', '2'] })).not.toBe(a);
        expect(planHash({ host: 'a', ids: ['1', '3'] })).not.toBe(a);
    });

    it('exige --expect-plan antes de conectar e que ele confira com o plano atual (exit 7)', () => {
        expect(guardCode(() => assertPlanFlagPresent({})).code).toBe(7);
        expect(guardCode(() => assertPlanMatches({ 'expect-plan': 'errado' }, 'abc')).code).toBe(7);
        expect(() => assertPlanMatches({ 'expect-plan': 'abc' }, 'abc')).not.toThrow();
    });
});

describe('classifyDbTarget (mesma semântica da T1)', () => {
    it('expõe só o rótulo, nunca credenciais', () => {
        expect(classifyDbTarget(REMOTE).label).toBe(`remoto (${HOST})`);
        expect(classifyDbTarget('file:/x/y.db').label).toBe('arquivo local (file:)');
    });
});
