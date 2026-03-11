export type BulkUpdates = {
    price?: number;
    minLos?: number;
    stopSell?: boolean;
    cta?: boolean;
    ctd?: boolean;
    inventory?: number;
};

export type BulkFieldToggles = {
    price: boolean;
    minLos: boolean;
    inventory: boolean;
    stopSell: boolean;
    cta: boolean;
    ctd: boolean;
};

export type BulkFieldValues = {
    price: string;
    minLos: string;
    inventory: string;
    stopSell: '' | 'true' | 'false';
    cta: '' | 'true' | 'false';
    ctd: '' | 'true' | 'false';
};

export type WeekdayState = Record<number, boolean>;
export type WeekdayPreset = 'all' | 'weekdays' | 'weekend';
export type BulkInventoryTarget = 'standard' | 'fourGuests';

export const WEEKDAYS = [
    { label: 'dom', day: 0 },
    { label: 'seg', day: 1 },
    { label: 'ter', day: 2 },
    { label: 'qua', day: 3 },
    { label: 'qui', day: 4 },
    { label: 'sex', day: 5 },
    { label: 'sab', day: 6 },
] as const;

export const defaultWeekdays = (): WeekdayState =>
    WEEKDAYS.reduce<WeekdayState>((acc, weekday) => {
        acc[weekday.day] = true;
        return acc;
    }, {});

export const defaultBulkFieldToggles = (): BulkFieldToggles => ({
    price: false,
    minLos: false,
    inventory: false,
    stopSell: false,
    cta: false,
    ctd: false,
});

export const defaultBulkFieldValues = (): BulkFieldValues => ({
    price: '',
    minLos: '',
    inventory: '',
    stopSell: '',
    cta: '',
    ctd: '',
});

export function applyWeekdayPreset(preset: WeekdayPreset): WeekdayState {
    if (preset === 'all') return defaultWeekdays();

    if (preset === 'weekdays') {
        return {
            0: false,
            1: true,
            2: true,
            3: true,
            4: true,
            5: true,
            6: false,
        };
    }

    return {
        0: true,
        1: false,
        2: false,
        3: false,
        4: false,
        5: true,
        6: true,
    };
}

export function getSelectedWeekdays(weekdays: WeekdayState): number[] {
    return Object.entries(weekdays)
        .filter(([, checked]) => checked)
        .map(([day]) => Number(day))
        .sort((a, b) => a - b);
}

export function buildBulkUpdates(
    toggles: BulkFieldToggles,
    values: BulkFieldValues
): { updates: BulkUpdates; errors: string[] } {
    const updates: BulkUpdates = {};
    const errors: string[] = [];

    if (toggles.price) {
        const value = Number.parseFloat(values.price);
        if (!Number.isFinite(value)) errors.push('Preço inválido.');
        else updates.price = value;
    }

    if (toggles.minLos) {
        const value = Number.parseInt(values.minLos, 10);
        if (!Number.isFinite(value) || value < 1) errors.push('Mínimo de noites inválido.');
        else updates.minLos = value;
    }

    if (toggles.inventory) {
        const value = Number.parseInt(values.inventory, 10);
        if (!Number.isFinite(value) || value < 0) errors.push('Quantidade de quartos inválida.');
        else updates.inventory = value;
    }

    if (toggles.stopSell) {
        if (!values.stopSell) errors.push('Selecione o valor de Stop Sell.');
        else updates.stopSell = values.stopSell === 'true';
    }

    if (toggles.cta) {
        if (!values.cta) errors.push('Selecione o valor de CTA.');
        else updates.cta = values.cta === 'true';
    }

    if (toggles.ctd) {
        if (!values.ctd) errors.push('Selecione o valor de CTD.');
        else updates.ctd = values.ctd === 'true';
    }

    return { updates, errors };
}

function parseDay(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parsed = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function countAffectedDays(startDate: string, endDate: string, weekdays: WeekdayState): number {
    const start = parseDay(startDate);
    const end = parseDay(endDate);
    if (!start || !end || end.getTime() < start.getTime()) return 0;

    const selectedWeekdays = new Set(getSelectedWeekdays(weekdays));
    let count = 0;
    const cursor = new Date(start);

    while (cursor.getTime() <= end.getTime()) {
        if (selectedWeekdays.has(cursor.getDay())) count += 1;
        cursor.setDate(cursor.getDate() + 1);
    }

    return count;
}

export function hasActiveBulkChanges(toggles: BulkFieldToggles): boolean {
    return Object.values(toggles).some(Boolean);
}
