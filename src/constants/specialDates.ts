export type SpecialDateConfig = {
    id: string;
    title: string;
    description: string;
    dateFrom: string;
    dateTo?: string;
    useBaseReservarPath?: boolean;
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
        id: 'tiradentes-2026',
        title: 'Tiradentes',
        description: 'Feriado prolongado de Tiradentes com mínimo de 3 diárias.',
        dateFrom: '2026-04-18',
        dateTo: '2026-04-21',
        image: '/fotos/piscina-aptos/DJI_0863.jpg',
        minNights: 3,
        enabled: true,
    },
    {
        id: 'dia-do-trabalho-2026',
        title: 'Dia do Trabalho',
        description: 'Sexta-feira de feriado ideal para descanso em família.',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-03',
        image: '/fotos/piscina-aptos/DJI_0908.jpg',
        minNights: 2,
        enabled: true,
    },
    {
        id: 'corpus-christi-2026',
        title: 'Corpus Christi',
        description: 'Feriado de quinta-feira com alta procura em Serra Negra.',
        dateFrom: '2026-06-04',
        dateTo: '2026-06-07',
        image: '/fotos/piscina-chale/DJI_0918.jpg',
        minNights: 3,
        enabled: true,
        bannerLabel: 'Corpus Christi com alta procura. Consulte disponibilidade.',
    },
    {
        id: 'independencia-2026',
        title: 'Independência do Brasil',
        description: 'Feriado da Independência para aproveitar o descanso prolongado.',
        dateFrom: '2026-09-04',
        dateTo: '2026-09-07',
        image: '/fotos/piscina-chale/DJI_0917.jpg',
        minNights: 3,
        enabled: true,
    },
    {
        id: 'nossa-senhora-aparecida-2026',
        title: 'Nossa Sr.a Aparecida - Padroeira do Brasil',
        description: 'Feriado de Nossa Senhora Aparecida com alta procura.',
        dateFrom: '2026-10-09',
        dateTo: '2026-10-12',
        image: '/fotos/jardim-aptos/DJI_0904.jpg',
        minNights: 3,
        enabled: true,
    },
    {
        id: 'finados-2026',
        title: 'Finados',
        description: 'Feriado de Finados para estadia tranquila no início de novembro.',
        dateFrom: '2026-10-30',
        dateTo: '2026-11-02',
        image: '/fotos/jardim-aptos/DJI_0896.jpg',
        minNights: 3,
        enabled: true,
    },
    {
        id: 'republica-2026',
        title: 'Proclamação da República',
        description: 'Feriado nacional para programar sua hospedagem antecipada.',
        dateFrom: '2026-11-15',
        dateTo: '2026-11-16',
        image: '/fotos/churrasqueira-aptos/DJI_0902.jpg',
        // minNights: 1,
        enabled: false,
    },
    {
        id: 'consciencia-negra-2026',
        title: 'Dia da Consciência Negra',
        description: 'Sexta-feira de feriado com grande procura por finais de semana.',
        dateFrom: '2026-11-20',
        dateTo: '2026-11-22',
        image: '/fotos/churrasqueira-chale/DJI_0920.jpg',
        minNights: 2,
        enabled: true,
    },
    {
        id: 'natal-2026',
        title: 'Natal',
        description: 'Feriado de dezembro com alta procura para hospedagem em família.',
        dateFrom: '2026-12-24',
        dateTo: '2026-12-27',
        image: '/fotos/restaurante/DSC_0056.jpg',
        minNights: 3,
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
