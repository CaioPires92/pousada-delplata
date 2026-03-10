function toFiniteInt(value: unknown, fallback = 0) {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export function normalizeChildrenAgesInput(childrenAges: unknown): number[] {
    if (Array.isArray(childrenAges)) {
        return childrenAges
            .map((age) => toFiniteInt(age, -1))
            .filter((age) => age >= 0 && age <= 17);
    }

    if (typeof childrenAges === 'string') {
        const trimmed = childrenAges.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((age) => toFiniteInt(age, -1))
                    .filter((age) => age >= 0 && age <= 17);
            }
        } catch {
            return trimmed
                .split(',')
                .map((age) => toFiniteInt(age.trim(), -1))
                .filter((age) => age >= 0 && age <= 17);
        }
    }

    return [];
}

export function getEffectiveGuestCounts(input: { adults: unknown; childrenAges?: unknown }) {
    const adults = Math.max(0, toFiniteInt(input.adults, 0));
    const childrenAges = normalizeChildrenAgesInput(input.childrenAges);
    const adultsFromChildren = childrenAges.filter((age) => age >= 12).length;
    const childrenUnder12 = childrenAges.filter((age) => age < 12).length;
    const effectiveAdults = adults + adultsFromChildren;
    const effectiveGuests = effectiveAdults + childrenUnder12;

    return {
        adults,
        childrenAges,
        effectiveAdults,
        childrenUnder12,
        effectiveGuests,
    };
}

export function requiresFourGuestInventory(effectiveGuests: number) {
    return effectiveGuests >= 4;
}
