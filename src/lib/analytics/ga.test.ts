import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gaEvent } from './ga';

describe('gaEvent debug mode', () => {
    const gtagMock = vi.fn();

    beforeEach(() => {
        gtagMock.mockReset();
        (window as any).gtag = gtagMock;
        localStorage.removeItem('analytics_test_mode');
    });

    afterEach(() => {
        localStorage.removeItem('analytics_test_mode');
    });

    it('continua disparando evento GA normalmente', () => {
        gaEvent('home_special_dates_click', { special_date_id: 'corpus' });

        expect(gtagMock).toHaveBeenCalledWith('event', 'home_special_dates_click', {
            special_date_id: 'corpus',
        });
    });

    it('adiciona debug_mode=true quando analytics_test_mode está ativo', () => {
        localStorage.setItem('analytics_test_mode', 'true');

        gaEvent('home_banner_special_date_click', { special_date_id: 'corpus' });

        expect(gtagMock).toHaveBeenCalledWith('event', 'home_banner_special_date_click', {
            special_date_id: 'corpus',
            debug_mode: true,
        });
    });
});
