export type InventoryField = 'inventory' | 'fourGuestInventory';

export type InventoryDraftResult =
    | { ok: true; value: number }
    | { ok: false; error: string };

export function getHorizontalSelection(dateKeys: string[], startKey: string, endKey: string): string[] {
    const startIndex = dateKeys.indexOf(startKey);
    const endIndex = dateKeys.indexOf(endKey);

    if (startIndex < 0 || endIndex < 0) return [];

    const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    return dateKeys.slice(from, to + 1);
}

export function parseInventoryDraft(rawValue: string, maxValue: number, minValue = 0): InventoryDraftResult {
    const value = Number.parseInt(rawValue, 10);

    if (!Number.isFinite(value)) {
        return { ok: false, error: 'Informe um número válido.' };
    }

    if (value < minValue) {
        return { ok: false, error: `O valor mínimo é ${minValue}.` };
    }

    if (value > maxValue) {
        return { ok: false, error: `O valor máximo permitido é ${maxValue}.` };
    }

    return { ok: true, value };
}

export function getInventoryMaxAllowed(params: {
    field: InventoryField;
    capacityTotal?: number | null;
    bookingsCount?: number | null;
    fourGuestCapacityTotal?: number | null;
    bookingsFor4GuestsCount?: number | null;
}): number {
    if (params.field === 'fourGuestInventory') {
        const capacity = Math.max(0, Number(params.fourGuestCapacityTotal ?? 0));
        const bookings = Math.max(0, Number(params.bookingsFor4GuestsCount ?? 0));
        return Math.max(0, capacity - bookings);
    }

    const capacity = Math.max(0, Number(params.capacityTotal ?? 0));
    const bookings = Math.max(0, Number(params.bookingsCount ?? 0));
    return Math.max(0, capacity - bookings);
}
