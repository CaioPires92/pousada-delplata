export function enableAnalyticsDebug() {
    if (typeof window === 'undefined') return;
    localStorage.setItem('analytics_test_mode', 'true');
    window.location.reload();
}

export function disableAnalyticsDebug() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('analytics_test_mode');
    window.location.reload();
}
