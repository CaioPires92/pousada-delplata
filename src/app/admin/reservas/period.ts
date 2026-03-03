import {
    addDays,
    endOfMonth,
    endOfWeek,
    format,
    isValid,
    parseISO,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from 'date-fns';

export type PeriodMode = 'month' | 'week' | 'day' | 'range';
export type DateField = 'checkIn' | 'createdAt';

type BuildPeriodRangeParams = {
    mode: PeriodMode;
    anchorDate: Date;
    customFrom?: string;
    customTo?: string;
};

type BuildBookingsQueryParams = BuildPeriodRangeParams & {
    status?: string;
    dateField?: DateField;
    limit?: number;
    cursor?: string;
};

type PeriodRange = {
    from: string;
    to: string;
};

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toYmd(date: Date) {
    return format(date, 'yyyy-MM-dd');
}

function parseYmd(value?: string) {
    const normalized = String(value || '').trim();
    if (!YMD_REGEX.test(normalized)) return null;

    const parsed = parseISO(`${normalized}T00:00:00`);
    if (!isValid(parsed)) return null;
    if (toYmd(parsed) !== normalized) return null;
    return parsed;
}

export function buildPeriodRange(params: BuildPeriodRangeParams): PeriodRange | null {
    const anchor = isValid(params.anchorDate) ? params.anchorDate : new Date();

    if (params.mode === 'month') {
        return {
            from: toYmd(startOfMonth(anchor)),
            to: toYmd(endOfMonth(anchor)),
        };
    }

    if (params.mode === 'week') {
        return {
            from: toYmd(startOfWeek(anchor, { weekStartsOn: 1 })),
            to: toYmd(endOfWeek(anchor, { weekStartsOn: 1 })),
        };
    }

    if (params.mode === 'day') {
        const day = toYmd(startOfDay(anchor));
        return { from: day, to: day };
    }

    const fromDate = parseYmd(params.customFrom);
    const toDate = parseYmd(params.customTo);
    if (!fromDate || !toDate) return null;
    if (fromDate.getTime() > toDate.getTime()) return null;

    return {
        from: toYmd(fromDate),
        to: toYmd(toDate),
    };
}

export function shiftAnchorDate(anchorDate: Date, mode: PeriodMode, direction: -1 | 1) {
    const anchor = isValid(anchorDate) ? anchorDate : new Date();
    if (mode === 'month') {
        return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
    }
    if (mode === 'week') return addDays(anchor, direction * 7);
    if (mode === 'day') return addDays(anchor, direction);
    return anchor;
}

export function formatPeriodLabel(mode: PeriodMode, anchorDate: Date, range: PeriodRange | null) {
    const anchor = isValid(anchorDate) ? anchorDate : new Date();
    if (mode === 'month') return format(anchor, "MMMM 'de' yyyy");
    if (mode === 'week' && range) return `${range.from} - ${range.to}`;
    if (mode === 'day') return format(anchor, 'dd/MM/yyyy');
    if (mode === 'range' && range) return `${range.from} - ${range.to}`;
    return 'Periodo invalido';
}

export function buildBookingsQuery(params: BuildBookingsQueryParams) {
    const searchParams = new URLSearchParams();
    const range = buildPeriodRange(params);
    const normalizedStatus = String(params.status || '').trim().toUpperCase();
    const dateField = params.dateField === 'createdAt' ? 'createdAt' : 'checkIn';
    const limit = Number(params.limit);

    if (normalizedStatus && normalizedStatus !== 'ALL') {
        searchParams.set('status', normalizedStatus);
    }

    if (range) {
        searchParams.set('dateFrom', range.from);
        searchParams.set('dateTo', range.to);
        searchParams.set('dateField', dateField);
    }

    if (Number.isFinite(limit) && limit > 0) {
        searchParams.set('limit', String(Math.min(500, Math.floor(limit))));
    }

    const cursor = String(params.cursor || '').trim();
    if (cursor) searchParams.set('cursor', cursor);
    return searchParams.toString();
}
