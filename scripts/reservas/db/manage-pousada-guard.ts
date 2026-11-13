/**
 * Proteções puras (sem Prisma, sem rede) para scripts/reservas/db/manage-pousada.ts.
 * Tudo aqui é testável sem tocar em banco.
 */

import {
    GuardError,
    assertSafeTarget,
    assertWriteConfirmation,
    classifyDbTarget,
    parseFlagsStrict,
    sanitizeErrorMessage,
} from '../../shared/db-safety';

// Proteções compartilhadas (host-confirm, caminho local, parser estrito) vivem em scripts/shared/db-safety.js.
export { GuardError, classifyDbTarget, sanitizeErrorMessage };

export const PRICE_LIMITS = { min: 50, max: 20000 } as const;
export const FEE_LIMITS = { min: 0, max: 2000 } as const;

export type ParsedArgs = Record<string, string | boolean>;

export type DbTarget =
    | { kind: 'missing'; label: string }
    | { kind: 'local'; label: string }
    | { kind: 'remote'; label: string };

const VALUE_FLAGS = ['action', 'confirm', 'confirm-host', 'price', 'extra', 'child'] as const;
const BOOLEAN_FLAGS = ['dry-run', 'allow-remote'] as const;

/**
 * Parser estrito: recusa argumentos posicionais, flags desconhecidas (ex.: typo `--dryrun`, que faria
 * uma escrita real se houvesse --confirm=YES), flags repetidas e flags booleanas com valor (`--dry-run=false`).
 */
export function parseArgs(argv: string[]): ParsedArgs {
    return parseFlagsStrict(argv, { value: VALUE_FLAGS, boolean: BOOLEAN_FLAGS });
}

/** Número estrito: só dígitos com ponto decimal opcional (até 2 casas). Sem notação científica, sem vazio. */
export function parseStrictAmount(raw: unknown, name: string, limits: { min: number; max: number }): number {
    if (typeof raw !== 'string' || raw.trim() === '') {
        throw new GuardError(`--${name} é obrigatório e deve ser informado explicitamente.`, 3);
    }
    const text = raw.trim();
    if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text)) {
        throw new GuardError(`--${name} inválido: use número sem zeros à esquerda e com até 2 casas decimais.`, 3);
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
        throw new GuardError(`--${name} fora da faixa permitida (${limits.min} a ${limits.max}).`, 3);
    }
    return value;
}

export type PlannedAction =
    | { action: 'update-desc'; dryRun: boolean }
    | { action: 'update-prices'; dryRun: boolean; price: number }
    | { action: 'update-fees'; dryRun: boolean; extra: number; child: number };

/**
 * Valida argumentos e ambiente antes de qualquer acesso ao banco. Lança GuardError em caso de risco.
 * - Escrita exige --confirm=YES digitado (dry-run nunca escreve).
 * - Banco remoto (ou URL ausente/ilegível) é bloqueado por padrão; exige --allow-remote.
 * - Valores de preço/taxa nunca têm padrão: devem ser explícitos e estar na faixa.
 * - update-desc altera somente descrição; taxas só via update-fees.
 */
export function planAction(args: ParsedArgs, databaseUrl: string | undefined): PlannedAction {
    const action = String(args['action'] ?? '').trim();
    const dryRun = args['dry-run'] === true;

    if (!['update-desc', 'update-prices', 'update-fees'].includes(action)) {
        throw new GuardError('ação inválida. use --action=update-desc|update-prices|update-fees', 1);
    }

    assertWriteConfirmation(args, dryRun);
    // Remoto: --allow-remote + --confirm-host exato. Local: caminho precisa ficar dentro do projeto.
    assertSafeTarget(databaseUrl, args);

    if (action === 'update-prices') {
        return { action, dryRun, price: parseStrictAmount(args['price'], 'price', PRICE_LIMITS) };
    }
    if (action === 'update-fees') {
        return {
            action,
            dryRun,
            extra: parseStrictAmount(args['extra'], 'extra', FEE_LIMITS),
            child: parseStrictAmount(args['child'], 'child', FEE_LIMITS),
        };
    }
    return { action: 'update-desc', dryRun };
}
