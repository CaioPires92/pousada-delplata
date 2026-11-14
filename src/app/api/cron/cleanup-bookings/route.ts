import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { runPendingBookingMaintenance } from '@/lib/expire-stale-bookings';
import { opsLog } from '@/lib/ops-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request, secret: string) {
    const received = Buffer.from(request.headers.get('authorization') || '');
    const expected = Buffer.from(`Bearer ${secret}`);
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

// Agendado em vercel.json (diário). A Vercel envia `Authorization: Bearer $CRON_SECRET`.
// Também pode ser chamado por um agendador externo com o mesmo cabeçalho.
export async function GET(request: Request) {
    const secret = String(process.env.CRON_SECRET || '').trim();
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            opsLog('error', 'CRON_CONFIG_ERROR', { reason: 'MISSING_CRON_SECRET' });
            return NextResponse.json({ error: 'CRON_NOT_CONFIGURED' }, { status: 500 });
        }
    } else if (!isAuthorized(request, secret)) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    try {
        const result = await runPendingBookingMaintenance({ source: 'cron', sendAdminAlerts: true });
        return NextResponse.json({ ok: true, ...result });
    } catch (error) {
        opsLog('error', 'CRON_CLEANUP_BOOKINGS_FAILED', {
            message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: 'CLEANUP_FAILED' }, { status: 500 });
    }
}
