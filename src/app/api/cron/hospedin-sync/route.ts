import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { getDefaultHospedinPeriod, syncHospedinAvailability } from '@/lib/hospedin-sync';
import { opsLog } from '@/lib/ops-log';
import { addDays, format } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorized(request: Request) {
    const secret = String(process.env.CRON_SECRET || '');
    if (!secret) return 'missing' as const;
    const received = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(received);
    const b = Buffer.from(secret);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? ('ok' as const) : ('denied' as const);
}

const MAX_DAYS = 730;

/**
 * Sincroniza o inventário com o Hospedin sem login de admin (para cron/manutenção).
 * Protegida por `Authorization: Bearer $CRON_SECRET` (mesmo padrão dos crons da Vercel).
 * `?days=N` (1–730) define quantos dias à frente sincronizar (padrão 60).
 *
 * Quem chama (GitHub Actions a cada 30 min; cron diário da Vercel para o período longo) recebe
 * 502 se QUALQUER acomodação falhar, para a falha aparecer em vez de passar como sucesso.
 */
export async function GET(request: Request) {
    const auth = isAuthorized(request);
    if (auth === 'missing') return NextResponse.json({ error: 'CRON_SECRET_NOT_CONFIGURED' }, { status: 503 });
    if (auth === 'denied') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (process.env.HOSPEDIN_SYNC_ENABLED !== 'true') {
        return NextResponse.json({ error: 'Sincronização com Hospedin desativada.' }, { status: 503 });
    }

    const daysParam = Number.parseInt(new URL(request.url).searchParams.get('days') || '', 10);
    const period = Number.isFinite(daysParam) && daysParam >= 1 && daysParam <= MAX_DAYS
        ? { beginDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(addDays(new Date(), daysParam), 'yyyy-MM-dd') }
        : getDefaultHospedinPeriod();

    try {
        const sync = await syncHospedinAvailability(period);
        const failed = sync.results.filter((result) => 'error' in result);
        if (failed.length > 0) {
            opsLog('error', 'HOSPEDIN_CRON_SYNC_PARTIAL', {
                ...period,
                failed: failed.map((result) => ({ roomName: result.roomName, error: 'error' in result ? result.error : undefined })),
            });
            return NextResponse.json({ ok: false, error: 'HOSPEDIN_SYNC_FAILED', ...period, results: sync.results }, { status: 502 });
        }
        opsLog('info', 'HOSPEDIN_CRON_SYNC_DONE', { ...period, results: sync.results.length });
        return NextResponse.json({ ok: true, ...period, results: sync.results });
    } catch (error) {
        opsLog('error', 'HOSPEDIN_CRON_SYNC_FAILED', { message: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'HOSPEDIN_SYNC_FAILED', message: error instanceof Error ? error.message : 'Erro' }, { status: 502 });
    }
}
