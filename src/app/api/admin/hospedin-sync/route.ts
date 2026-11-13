import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getDefaultHospedinPeriod, syncHospedinAvailability } from '@/lib/hospedin-sync';

export const maxDuration = 60;

export async function POST(request: Request) {
    const startTime = Date.now();
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        if (process.env.HOSPEDIN_SYNC_ENABLED !== 'true') {
            return NextResponse.json({ error: 'Sincronização com Hospedin desativada.' }, { status: 503 });
        }

        // Extract body early
        const body = await request.json().catch(() => ({}));
        const { startDate: reqStart, endDate: reqEnd, roomTypeId } = body;

        const defaults = getDefaultHospedinPeriod();
        const sync = await syncHospedinAvailability({
            beginDate: reqStart || defaults.beginDate,
            endDate: reqEnd || defaults.endDate,
            roomTypeId,
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        const allFailed = sync.results.length > 0 && sync.results.every((result) => 'error' in result);
        if (allFailed) {
            return NextResponse.json({
                error: 'O Hospedin não sincronizou nenhuma acomodação.',
                results: sync.results,
                duration: `${duration}s`,
            }, { status: 502 });
        }

        return NextResponse.json({
            message: 'Sincronização processada!',
            results: sync.results,
            duration: `${duration}s`
        });
    } catch (error) {
        console.error('Erro na sincronização Hospedin:', error);
        return NextResponse.json({
            error: 'Erro fatal na sincronização com Hospedin'
        }, { status: 500 });
    }
}
