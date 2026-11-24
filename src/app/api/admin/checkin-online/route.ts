import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin-auth';
import { HospedinApiError } from '@/lib/hospedin';
import { isValidIsoDate, listCheckinRows } from '@/lib/hospedin-checkin';

export const maxDuration = 60;

const MAX_RANGE_DAYS = 31;

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Lista, só para leitura, as UHs com check-in no período e o link do check-in online do Hospedin. */
export async function GET(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const today = todayInSaoPaulo();
  const from = searchParams.get('from') || today;
  const to = searchParams.get('to') || addDays(from, 7);

  if (!isValidIsoDate(from) || !isValidIsoDate(to) || to < from) {
    return NextResponse.json({ error: 'invalid_period' }, { status: 400 });
  }
  if (addDays(from, MAX_RANGE_DAYS) < to) {
    return NextResponse.json({ error: 'period_too_long', maxDays: MAX_RANGE_DAYS }, { status: 400 });
  }

  try {
    const listing = await listCheckinRows(from, to);
    // Os links do check-in são credenciais: nada de cache nem de log.
    return NextResponse.json(listing, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'hospedin_v3_not_configured') {
      return NextResponse.json({ error: 'hospedin_v3_not_configured' }, { status: 503 });
    }
    const status = error instanceof HospedinApiError ? error.status : 0;
    console.error('CHECKIN_ONLINE_LIST_FAILED', { status });
    return NextResponse.json({ error: 'hospedin_request_failed', hospedinStatus: status || null }, { status: 502 });
  }
}
