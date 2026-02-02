

/**
 * Normalizes a date input into a strictly formatted ISO 8601 string (UTC Midnight).
 * Required because Prisma runtime validation for this schema expects ISO format
 * even if the type is String.
 * 
 * @param input Date string (ISO/SQL) or Date object or unknown
 * @returns 'YYYY-MM-DDTHH:mm:ss.000Z' string
 * @throws Error if format is invalid
 */
export function normalizeDateStr(input: unknown): string {
    let dateObj: Date;

    if (input instanceof Date) {
        dateObj = input;
    } else if (typeof input === "string") {
        const s = input.trim();

        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            dateObj = new Date(`${s}T00:00:00.000Z`);
        } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \+\d{2}:\d{2}$/.test(s)) {
            const converted = s.replace(' ', 'T').replace(' +', '+');
            dateObj = new Date(converted);
        } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
            dateObj = new Date(s.replace(' ', 'T') + '.000Z');
        } else if (s.includes('T')) {
            dateObj = new Date(s);
        } else {
            throw new Error(`Invalid date string format: "${input}"`);
        }
    } else {
        throw new Error(`Invalid date type: ${typeof input}`);
    }

    if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date input: "${input}"`);
    }

    // Always output ISO
    return dateObj.toISOString();
}

// Deprecated or alias helpers if needed for compatibility, 
// but sticking to the clean implementation requested.
export function formatLocalDate(date: Date): string {
    return normalizeDateStr(date);
}

/**
 * Parses a "YYYY-MM-DD" or ISO string into a Date object at local midnight.
 * Required for models that use DateTime (like Booking) instead of String.
 */
export function parseLocalDate(dateStr: string): Date {
    // normalize first to get a clean ISO string
    const s = normalizeDateStr(dateStr);
    // s is "YYYY-MM-DDTHH:mm:ss.000Z"
    // Extract logical YYYY-MM-DD
    const [y, m, d] = s.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d);
}

/**
 * Returns an ISO 8601 string for a given "YYYY-MM-DD" or ISO input.
 * If endOfDay is true, returns the end of the given day (23:59:59.999Z).
 */
export function parseISODateSafe(input: string, endOfDay: boolean = false): string | null {
    try {
        const iso = normalizeDateStr(input);
        const day = iso.slice(0, 10);
        if (endOfDay) return `${day}T23:59:59.999Z`;
        return `${day}T00:00:00.000Z`;
    } catch {
        return null;
    }
}

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

export function assertYmd(input: string | unknown, label: string): string {
    const s0 = String(input ?? '');
    const s = s0.replace(/[\u200B-\u200D\uFEFF\r\n\t]/g, '').trim();
    if (!ymdRegex.test(s)) {
        try {
            const json = (() => { try { return JSON.stringify(s0); } catch { return null; } })();
            const charCodes = Array.from(String(s0)).map((c) => c.charCodeAt(0));
            console.error('[assertYmd] INVALID', { label, value: s0, cleaned: s, type: typeof input, length: String(s0).length, json, charCodes, slice15: String(s0).slice(0, 15) });
        } catch {}
        const origin = '[THROW_ORIGIN=YMD_ASSERT v1]';
        const stack = new Error().stack;
        const valueStr = (() => { try { return JSON.stringify(s0); } catch { return String(s0); } })();
        throw new Error(`${origin} Invalid ${label}. Expected YYYY-MM-DD | value=${valueStr} | stack=${stack}`);
    }
    return s;
}

export function ymdToIso(ymd: string): string {
    return `${ymd}T00:00:00.000Z`;
}
