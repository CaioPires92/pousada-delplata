import * as Sentry from '@sentry/nextjs';

export function register() {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        enabled: process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
    });
}

