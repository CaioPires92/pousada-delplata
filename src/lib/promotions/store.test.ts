import { describe, expect, it } from 'vitest';
import { parseDaysOfWeek, parseExcludedStayRanges, toPromotionRule } from '@/lib/promotions/store';

const row = {
    id: 'p1', name: 'Genius', badgeLabel: null, type: 'CUSTOM', active: true, discountPercent: 20,
    maxDiscountAmount: null, minDaysBeforeCheckIn: null, maxDaysBeforeCheckIn: null, stayStart: null, stayEnd: null,
    bookableFrom: null, bookableUntil: null, minNights: null, allowedRoomTypeIds: null, stackWithCoupons: false,
    exclusive: false,
};

describe('toPromotionRule', () => {
    it('showBadge: linhas antigas (sem a coluna) mostram a etiqueta; false oculta', () => {
        expect(toPromotionRule(row)?.showBadge).toBe(true);
        expect(toPromotionRule({ ...row, showBadge: null })?.showBadge).toBe(true);
        expect(toPromotionRule({ ...row, showBadge: true })?.showBadge).toBe(true);
        expect(toPromotionRule({ ...row, showBadge: false })?.showBadge).toBe(false);
    });
});

describe('excludedStayDates', () => {
    it('linhas antigas (sem a coluna) não têm exclusões', () => {
        expect(toPromotionRule(row)?.excludedStayRanges).toEqual([]);
        expect(toPromotionRule({ ...row, excludedStayDates: null })?.excludedStayRanges).toEqual([]);
    });

    it('lê o JSON gravado pelo painel', () => {
        const json = JSON.stringify([{ from: '2026-11-25', to: '2026-11-25' }, { from: '2026-12-24', to: '2026-12-26' }]);
        expect(toPromotionRule({ ...row, excludedStayDates: json })?.excludedStayRanges).toEqual([
            { from: '2026-11-25', to: '2026-11-25' },
            { from: '2026-12-24', to: '2026-12-26' },
        ]);
    });

    it('JSON quebrado ou entradas inválidas são ignorados, sem derrubar a cotação', () => {
        expect(parseExcludedStayRanges('{nao é json')).toEqual([]);
        expect(parseExcludedStayRanges('{"from":"2026-11-25"}')).toEqual([]);
        expect(parseExcludedStayRanges(JSON.stringify([{ from: 'x' }, { from: '2026-11-26', to: '2026-11-25' }, { from: '2026-11-25' }]))).toEqual([
            { from: '2026-11-25', to: '2026-11-25' },
        ]);
    });
});

describe('daysOfWeek', () => {
    it('linhas antigas e valores inválidos valem em todos os dias (null)', () => {
        expect(toPromotionRule(row)?.daysOfWeek).toBeNull();
        expect(parseDaysOfWeek(null)).toBeNull();
        expect(parseDaysOfWeek('{nao é json')).toBeNull();
        expect(parseDaysOfWeek('"5"')).toBeNull();
        expect(parseDaysOfWeek('[]')).toBeNull();
        expect(parseDaysOfWeek('[0,1,2,3,4,5,6]')).toBeNull();
    });

    it('lê os dias gravados pelo painel, ignorando valores fora de 0-6', () => {
        expect(toPromotionRule({ ...row, daysOfWeek: '[5,6]' })?.daysOfWeek).toEqual([5, 6]);
        expect(parseDaysOfWeek('[6,5,9,-1,5]')).toEqual([5, 6]);
    });
});
