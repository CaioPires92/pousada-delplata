const dayKeyRegex = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

function isLeapYear(year: number) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number) {
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
    return 31;
}

function parseDayKey(dayKey: string) {
    const [y, m, d] = dayKey.split('-').map((x) => Number.parseInt(x, 10));
    return { y, m, d };
}

export function isDayKey(dayKey: string) {
    return dayKeyRegex.test(dayKey);
}

export function assertDayKey(dayKey: string, label: string) {
    if (!isDayKey(dayKey)) {
        throw new Error(`Invalid ${label}. Expected YYYY-MM-DD`);
    }
}

export function compareDayKey(a: string, b: string) {
    return a.localeCompare(b);
}

export function nextDayKey(dayKey: string) {
    assertDayKey(dayKey, 'day');
    let { y, m, d } = parseDayKey(dayKey);

    d += 1;
    const dim = daysInMonth(y, m);
    if (d > dim) {
        d = 1;
        m += 1;
        if (m > 12) {
            m = 1;
            y += 1;
        }
    }

    return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function prevDayKey(dayKey: string) {
    assertDayKey(dayKey, 'day');
    let { y, m, d } = parseDayKey(dayKey);

    d -= 1;
    if (d < 1) {
        m -= 1;
        if (m < 1) {
            m = 12;
            y -= 1;
        }
        d = daysInMonth(y, m);
    }

    return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function isNextDay(prevDayKey: string, dayKey: string) {
    return nextDayKey(prevDayKey) === dayKey;
}

export function eachDayKeyInclusive(startDayKey: string, endDayKey: string) {
    assertDayKey(startDayKey, 'startDate');
    assertDayKey(endDayKey, 'endDate');
    if (compareDayKey(startDayKey, endDayKey) > 0) {
        throw new Error('Invalid date range: startDate must be <= endDate');
    }

    const out: string[] = [];
    let cur = startDayKey;
    while (compareDayKey(cur, endDayKey) <= 0) {
        out.push(cur);
        cur = nextDayKey(cur);
    }
    return out;
}
