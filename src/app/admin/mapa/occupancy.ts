export type OccupancyBand = 'low' | 'medium' | 'high' | 'veryHigh';

export type OccupancyMetrics = {
    occupancyPct: number | null;
    occupied: number | null;
    band: OccupancyBand | null;
};

type OccupancyInput = {
    capacityTotal?: number | null;
    bookingsCount?: number | null;
    available?: number | null;
} | null | undefined;

export const OCCUPANCY_BAND_LABEL: Record<OccupancyBand, string> = {
    low: 'baixa',
    medium: 'média',
    high: 'alta',
    veryHigh: 'muito alta'
};

const normalizeNonNegative = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    return numeric;
};

export const getOccupancyMetrics = (data?: OccupancyInput): OccupancyMetrics => {
    const capacity = normalizeNonNegative(data?.capacityTotal);
    if (!capacity || capacity <= 0) {
        return { occupancyPct: null, occupied: null, band: null };
    }

    const reserved = normalizeNonNegative(data?.bookingsCount);
    const available = normalizeNonNegative(data?.available);
    const occupiedRaw = reserved ?? (available !== null ? capacity - available : null);
    if (occupiedRaw === null) {
        return { occupancyPct: null, occupied: null, band: null };
    }

    const occupied = Math.min(capacity, Math.max(0, occupiedRaw));
    const occupancyPct = (occupied / capacity) * 100;
    let band: OccupancyBand = 'low';

    if (occupancyPct >= 85) band = 'veryHigh';
    else if (occupancyPct >= 60) band = 'high';
    else if (occupancyPct >= 30) band = 'medium';

    return { occupancyPct, occupied, band };
};
