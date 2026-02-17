'use client';

declare global {
    interface Window {
        clarity?: (...args: unknown[]) => void;
    }
}

export function clarityEvent(name: string): void {
    if (typeof window === 'undefined') return;
    if (typeof window.clarity !== 'function') return;
    window.clarity('event', name);
}

