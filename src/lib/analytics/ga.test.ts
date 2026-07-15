import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gaEvent, trackAddPaymentInfo, trackPurchase } from './ga';

describe('gaEvent debug mode', () => {
    const gtagMock = vi.fn();

    beforeEach(() => {
        gtagMock.mockReset();
        (window as any).gtag = gtagMock;
        window.dataLayer = [];
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

    it('enfileira o evento quando o gtag ainda não carregou', () => {
        (window as any).gtag = undefined;

        gaEvent('search', { adults: 2 });

        expect(window.dataLayer).toEqual([
            ['event', 'search', { adults: 2 }],
        ]);
    });

    it('registra informação de pagamento no formato de ecommerce', () => {
        trackAddPaymentInfo({
            bookingId: 'booking-1',
            value: 750,
            paymentType: 'pix',
            items: [{ item_id: 'room-1', item_name: 'Chalé', price: 750, quantity: 1 }],
        });

        expect(gtagMock).toHaveBeenCalledWith('event', 'add_payment_info', {
            booking_id: 'booking-1',
            currency: 'BRL',
            items: [{ item_id: 'room-1', item_name: 'Chalé', price: 750, quantity: 1 }],
            payment_type: 'pix',
            value: 750,
        });
    });

    it('não registra compra sem identificador da transação', () => {
        trackPurchase({ transactionId: '', value: 750 });

        expect(gtagMock).not.toHaveBeenCalled();
    });
});
