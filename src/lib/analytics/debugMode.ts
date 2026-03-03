export function isAnalyticsDebug() {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('analytics_test_mode') === 'true';
}
