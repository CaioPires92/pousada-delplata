export type SpecialDateConfig = {
    id: string;
    title: string;
    description: string;
    dateFrom: string;
    dateTo?: string;
    image?: string;
    minNights?: number;
    enabled: boolean;
    bannerLabel?: string;
};

export type BuildReservarUrlParams = {
    checkIn?: string | null;
    checkOut?: string | null;
    adults?: number;
    children?: number;
};

type ActiveBannerOptions = {
    leadDays?: number;
    dates?: SpecialDateConfig[];
};

const RESERVAR_BASE_PATH = '/reservar';
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const SPECIAL_DATE_BANNER_LEAD_DAYS = 30;

export const SPECIAL_DATES: SpecialDateConfig[] = [
    {
        id: 'corpus-christi-2026',
        title: 'Corpus Christi',
        description: 'Feriado prolongado com alta procura em Serra Negra.',
        dateFrom: '2026-06-04',
        dateTo: '2026-06-07',
        image: '/fotos/piscina-aptos/DJI_0845.jpg',
        minNights: 2,
        enabled: true,
        bannerLabel: 'Corpus Christi com alta procura. Consulte disponibilidade.',
    },
    {
        id: 'independencia-2026',
        title: 'Independência do Brasil',
        description: 'Fim de semana de feriado ideal para descanso em família.',
        dateFrom: '2026-09-05',
        dateTo: '2026-09-07',
        minNights: 2,
        enabled: true,
    },
    {
        id: 'republica-2026',
        title: 'Proclamação da República',
        description: 'Planeje sua viagem com antecedência para garantir vaga.',
        dateFrom: '2026-11-14',
        dateTo: '2026-11-16',
        minNights: 2,
        enabled: true,
    },
];

function toUtcStartOfDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseYmdToUtc(value: string) {
    const normalized = String(value || '').trim();
    if (!YMD_REGEX.test(normalized)) return null;

    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    if (parsed.toISOString().slice(0, 10) !== normalized) return null;
    return parsed;
}

function sanitizeAdults(value: number | undefined) {
    if (!Number.isFinite(value)) return 2;
    return Math.min(16, Math.max(1, Math.floor(value as number)));
}

function sanitizeChildren(value: number | undefined) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(10, Math.max(0, Math.floor(value as number)));
}

export function buildReservarUrl(params: BuildReservarUrlParams = {}) {
    const checkIn = parseYmdToUtc(String(params.checkIn || '').trim());
    const checkOut = parseYmdToUtc(String(params.checkOut || '').trim());

    if (!checkIn || !checkOut) return RESERVAR_BASE_PATH;
    if (checkOut.getTime() <= checkIn.getTime()) return RESERVAR_BASE_PATH;

    const searchParams = new URLSearchParams();
    searchParams.set('checkIn', checkIn.toISOString().slice(0, 10));
    searchParams.set('checkOut', checkOut.toISOString().slice(0, 10));
    searchParams.set('adults', String(sanitizeAdults(params.adults)));
    searchParams.set('children', String(sanitizeChildren(params.children)));
    return `${RESERVAR_BASE_PATH}?${searchParams.toString()}`;
}

export function getActiveBannerSpecialDate(today = new Date(), options: ActiveBannerOptions = {}) {
    const leadDays = Number.isFinite(options.leadDays)
        ? Math.max(0, Math.floor(options.leadDays as number))
        : SPECIAL_DATE_BANNER_LEAD_DAYS;
    const dates = Array.isArray(options.dates) ? options.dates : SPECIAL_DATES;
    const activeDates = dates
        .filter((item) => item.enabled)
        .slice()
        .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));

    const todayUtc = toUtcStartOfDay(today);

    for (const item of activeDates) {
        const start = parseYmdToUtc(item.dateFrom);
        const end = parseYmdToUtc(item.dateTo || item.dateFrom);
        if (!start || !end) continue;

        const windowStart = new Date(start.getTime() - leadDays * DAY_MS);
        const windowEnd = toUtcStartOfDay(end);
        if (todayUtc.getTime() >= windowStart.getTime() && todayUtc.getTime() <= windowEnd.getTime()) {
            return item;
        }
    }

    return null;
}
