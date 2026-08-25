'use client';

import { useSyncExternalStore } from 'react';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

function getCurrentDateKey() {
    return DATE_FORMATTER.format(new Date());
}

function subscribeToDateChange(onStoreChange: () => void) {
    const intervalId = window.setInterval(onStoreChange, 60_000);
    return () => window.clearInterval(intervalId);
}

export function useCurrentDateKey() {
    return useSyncExternalStore(subscribeToDateChange, getCurrentDateKey, () => null);
}
