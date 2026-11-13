'use strict';
/**
 * Proteções compartilhadas (CommonJS, sem Prisma e sem rede) para scripts administrativos de banco.
 * Usado por scripts .js e .ts. Tudo aqui é testável sem tocar em banco.
 *
 * Regras:
 * - Banco ausente/ilegível/remoto é bloqueado por padrão.
 * - Remoto só com --allow-remote E --confirm-host=<hostname exato do DATABASE_URL>.
 * - Banco local (file:) precisa resolver para dentro do repositório (ou da pasta temporária do SO).
 * - Escrita exige --confirm=YES digitado; escrita em massa também exige --expect-plan=<hash do dry-run>.
 * - Nenhuma função devolve ou imprime URL, caminho completo, usuário, senha ou token.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

class GuardError extends Error {
    constructor(message, exitCode) {
        super(message);
        this.name = 'GuardError';
        this.exitCode = exitCode;
    }
}

/**
 * Parser estrito: recusa argumentos posicionais, flags desconhecidas (ex.: typo `--dryrun`),
 * flags repetidas e flags booleanas com valor (`--dry-run=false`).
 * @param {string[]} argv
 * @param {{ value: readonly string[], boolean: readonly string[] }} spec
 * @returns {Record<string, string | boolean>}
 */
function parseFlagsStrict(argv, spec) {
    /** @type {Record<string, string | boolean>} */
    const out = {};
    for (const arg of argv) {
        if (!arg.startsWith('--')) {
            throw new GuardError('argumento posicional não permitido; use apenas flags --nome[=valor].', 1);
        }
        const body = arg.slice(2);
        const eq = body.indexOf('=');
        const key = eq === -1 ? body : body.slice(0, eq);
        const hasValue = eq !== -1;

        const isBoolean = spec.boolean.includes(key);
        const isValue = spec.value.includes(key);
        if (!isBoolean && !isValue) {
            throw new GuardError(`flag desconhecida: --${key.slice(0, 40)}.`, 1);
        }
        if (Object.prototype.hasOwnProperty.call(out, key)) {
            throw new GuardError(`flag repetida: --${key}.`, 1);
        }
        if (isBoolean && hasValue) {
            throw new GuardError(`--${key} não aceita valor.`, 1);
        }
        out[key] = hasValue ? body.slice(eq + 1) : true;
    }
    return out;
}

/** Remove URLs e tokens longos de mensagens de erro antes de qualquer log. */
function sanitizeErrorMessage(error) {
    const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : 'falha desconhecida';
    return (
        raw
            .split('\n')[0]
            .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"`)]+/gi, '[url removida]')
            .replace(/\bfile:[^\s'"`)]+/gi, '[url removida]')
            .replace(/\b[A-Za-z]:\\[^\s'"`)]+/g, '[caminho removido]')
            .replace(/(^|[\s(=:'"])\/[\w.@~-]+(?:\/[\w.@~-]*)+/g, '$1[caminho removido]')
            .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token removido]')
            .slice(0, 200) || 'falha desconhecida'
    );
}

/**
 * Classifica o destino do banco sem expor credenciais: o rótulo nunca contém
 * caminho, usuário, senha, query string ou token. `host` só existe para destinos remotos/localhost.
 * @param {string | undefined} rawUrl
 * @returns {{ kind: 'missing' | 'local' | 'remote', label: string, host?: string }}
 */
function classifyDbTarget(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) return { kind: 'missing', label: 'não definido' };
    // file: só é local sem host. `file://servidor/...` pode apontar para compartilhamento remoto.
    if (/^file:(?!\/\/[^/])/i.test(url)) return { kind: 'local', label: 'arquivo local (file:)' };
    if (/^file:/i.test(url)) return { kind: 'remote', label: 'remoto (file: com host)' };

    let host = '';
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        // URL ilegível: tratar como remoto (falha fechada), sem ecoar o conteúdo.
        return { kind: 'remote', label: 'remoto (URL não reconhecida)' };
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
        return { kind: 'local', label: 'localhost', host };
    }
    return { kind: 'remote', label: `remoto (${host})`, host };
}

function isInside(root, candidate) {
    const rel = path.relative(root, candidate);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** realpath do ancestral existente mais próximo + resto do caminho (o arquivo pode ainda não existir). */
function realpathLoose(target) {
    let current = target;
    const rest = [];
    for (let i = 0; i < 64; i++) {
        try {
            const real = fs.realpathSync(current);
            return rest.length ? path.join(real, ...rest.reverse()) : real;
        } catch {
            const parent = path.dirname(current);
            if (parent === current) return target;
            rest.push(path.basename(current));
            current = parent;
        }
    }
    return target;
}

/**
 * Valida o caminho de um `file:` para impedir que `file:../../...`, caminhos absolutos ou symlinks
 * contornem o isolamento do projeto. O Prisma resolve caminhos relativos a partir de `prisma/` e o libsql a
 * partir do cwd: ambos os candidatos precisam ficar dentro das raízes permitidas.
 * Lança GuardError(6) sem ecoar o caminho.
 * @param {string} rawUrl
 * @param {{ repoRoot?: string, cwd?: string, tmpDir?: string }} [options]
 */
function validateLocalDbPath(rawUrl, options = {}) {
    const repoRoot = options.repoRoot ?? REPO_ROOT;
    const cwd = options.cwd ?? process.cwd();
    const tmpDir = options.tmpDir ?? os.tmpdir();
    const reject = () => new GuardError('bloqueado: caminho do banco local fora do projeto (ou inválido).', 6);

    let body = String(rawUrl || '').trim().replace(/^file:/i, '');
    if (/^\/\/\//.test(body)) body = body.slice(2); // file:///abs -> /abs
    else if (/^\/\//.test(body)) throw reject(); // file://host/...
    body = body.split('?')[0].split('#')[0];
    try {
        body = decodeURIComponent(body);
    } catch {
        throw reject();
    }
    body = body.replace(/\\/g, '/');
    if (!body || body.includes('\0') || body.startsWith('//')) throw reject();
    if (/^\/[A-Za-z]:\//.test(body)) body = body.slice(1); // /C:/x -> C:/x

    const roots = [repoRoot, tmpDir].map((root) => realpathLoose(path.resolve(root)));
    const isAbsolute = path.isAbsolute(body) || /^[A-Za-z]:\//.test(body);
    const candidates = isAbsolute
        ? [path.resolve(body)]
        : [path.resolve(repoRoot, 'prisma', body), path.resolve(cwd, body)];

    for (const candidate of candidates) {
        const real = realpathLoose(candidate);
        if (!roots.some((root) => isInside(root, real))) throw reject();
    }
}

/**
 * Avalia o destino do banco e lança GuardError(6) se não for seguro.
 * - ausente → bloqueia; local → valida caminho; remoto → exige --allow-remote + --confirm-host exato.
 * @param {string | undefined} databaseUrl
 * @param {Record<string, string | boolean>} flags
 * @param {{ repoRoot?: string, cwd?: string, tmpDir?: string }} [pathOptions]
 */
function assertSafeTarget(databaseUrl, flags, pathOptions) {
    const target = classifyDbTarget(databaseUrl);
    if (target.kind === 'missing') {
        throw new GuardError('bloqueado: DATABASE_URL não definido.', 6);
    }
    const isFileUrl = /^file:/i.test(String(databaseUrl).trim());
    // Só `file:` é "local" de verdade. localhost/127.0.0.1 não-file pode ser túnel (ssh -L, sqld, turso dev)
    // para um banco remoto; por isso exige as mesmas confirmações de um destino remoto.
    if (target.kind === 'remote' || (target.kind === 'local' && !isFileUrl)) {
        if (flags['allow-remote'] !== true) {
            throw new GuardError(
                `bloqueado: banco ${target.label}. Execução em banco remoto exige --allow-remote e --confirm-host=<host>.`,
                6
            );
        }
        const confirmed = String(flags['confirm-host'] ?? '').trim().toLowerCase();
        if (!target.host || !confirmed || confirmed !== target.host) {
            throw new GuardError(
                'bloqueado: --allow-remote exige também --confirm-host=<hostname exato do banco de destino>.',
                6
            );
        }
        return target;
    }
    validateLocalDbPath(String(databaseUrl), pathOptions);
    return target;
}

/** Identificador curto do destino (sem query/credenciais) para vincular o plano ao banco exato. */
function targetFingerprint(databaseUrl) {
    return crypto.createHash('sha256').update(String(databaseUrl || '').split('?')[0].trim()).digest('hex').slice(0, 8);
}

/** Escrita real exige --confirm=YES exato; dry-run nunca escreve. */
function assertWriteConfirmation(flags, dryRun) {
    if (!dryRun && String(flags['confirm'] ?? '').trim() !== 'YES') {
        throw new GuardError('bloqueado: passe --confirm=YES (maiúsculas) para executar sem --dry-run.', 2);
    }
}

/** JSON estável (chaves ordenadas) para hash determinístico do plano. */
function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
}

/** Hash curto do plano (destino + ações). Mudou o banco ou os alvos → o hash muda. */
function planHash(plan) {
    return crypto.createHash('sha256').update(stableStringify(plan)).digest('hex').slice(0, 16);
}

/** Exige --expect-plan=<hash> (exit 7) antes de conectar; compara depois com o plano recalculado. */
function assertPlanFlagPresent(flags) {
    if (!String(flags['expect-plan'] ?? '').trim()) {
        throw new GuardError('bloqueado: rode antes com --dry-run e passe --expect-plan=<plan do dry-run>.', 7);
    }
}

function assertPlanMatches(flags, currentHash) {
    if (String(flags['expect-plan'] ?? '').trim() !== currentHash) {
        throw new GuardError('bloqueado: o plano mudou desde o dry-run (--expect-plan não confere). Rode o dry-run novamente.', 7);
    }
}

/** Flags comuns a todos os scripts protegidos. */
const COMMON_VALUE_FLAGS = ['confirm', 'confirm-host', 'expect-plan'];
const COMMON_BOOLEAN_FLAGS = ['dry-run', 'allow-remote'];

module.exports = {
    GuardError,
    parseFlagsStrict,
    sanitizeErrorMessage,
    classifyDbTarget,
    validateLocalDbPath,
    assertSafeTarget,
    assertWriteConfirmation,
    planHash,
    targetFingerprint,
    assertPlanFlagPresent,
    assertPlanMatches,
    COMMON_VALUE_FLAGS,
    COMMON_BOOLEAN_FLAGS,
    REPO_ROOT,
};
