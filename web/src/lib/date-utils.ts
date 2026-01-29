import { format } from 'date-fns';

/**
 * Parses a date string in "YYYY-MM-DD" format into a Date object
 * set to local midnight. This prevents timezone shifts that occur
 * when using `new Date("YYYY-MM-DD")` which defaults to UTC.
 * 
 * @param dateStr Date string in "YYYY-MM-DD" format
 * @returns Date object at local midnight
 */
export function parseLocalDate(dateStr: string): Date {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/**
 * Converts a Date object (or date string) to a safe "YYYY-MM-DD" string.
 * Uses UTC-based extraction if the input is a Date object to ensure
 * consistency when working with ISO strings from the database.
 * 
 * @param date Date object or string
 * @returns String in "YYYY-MM-DD" format
 */
export function toISODateString(date: Date | string): string {
    if (typeof date === 'string') {
        // If it's already a string, assume it might be an ISO string and clean it
        if (date.includes('T')) {
            return date.split('T')[0];
        }
        return date;
    }
    return format(date, 'yyyy-MM-dd');
}

/**
 * Formats a local date object to "YYYY-MM-DD" using local time.
 * Use this when you have a Date object created via `parseLocalDate` or `new Date()`.
 */
export function formatLocalDate(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}
