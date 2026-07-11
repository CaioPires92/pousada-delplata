import { describe, expect, it } from 'vitest';
import {
    calculatePaymentPlan,
    evaluatePartialPaymentEligibility,
    normalizePartialPaymentSettings,
    validatePartialPaymentSettings,
} from './partial-payment';

const baseSettings = normalizePartialPaymentSettings({
    enabled: true,
    percentage: 50,
    minimumBookingAmount: null,
    minimumLeadTimeDays: null,
    balanceDueAt: 'CHECK_IN',
    balanceDueDaysBeforeCheckIn: null,
    defaultPaymentMode: 'FULL',
});

describe('partial-payment', () => {
    it('blocks partial payment when disabled', () => {
        const evaluation = evaluatePartialPaymentEligibility({
            settings: { ...baseSettings, enabled: false },
            totalAmount: 1000,
            checkIn: new Date('2026-07-20T12:00:00Z'),
            now: new Date('2026-07-10T12:00:00Z'),
        });

        expect(evaluation.eligible).toBe(false);
        expect(evaluation.reasons).toContain('disabled');
        expect(evaluation.defaultPaymentMode).toBe('FULL');
    });

    it('blocks reservations below the configured minimum and allows the exact minimum', () => {
        const below = evaluatePartialPaymentEligibility({
            settings: { ...baseSettings, minimumBookingAmount: 1000 },
            totalAmount: 999.99,
            checkIn: new Date('2026-07-20T12:00:00Z'),
            now: new Date('2026-07-10T12:00:00Z'),
        });
        const exact = evaluatePartialPaymentEligibility({
            settings: { ...baseSettings, minimumBookingAmount: 1000 },
            totalAmount: 1000,
            checkIn: new Date('2026-07-20T12:00:00Z'),
            now: new Date('2026-07-10T12:00:00Z'),
        });

        expect(below.eligible).toBe(false);
        expect(below.reasons).toContain('below_minimum_amount');
        expect(exact.eligible).toBe(true);
    });

    it('blocks reservations below lead time and allows the exact limit', () => {
        const below = evaluatePartialPaymentEligibility({
            settings: { ...baseSettings, minimumLeadTimeDays: 3 },
            totalAmount: 1000,
            checkIn: new Date('2026-07-12T12:00:00Z'),
            now: new Date('2026-07-10T12:00:00Z'),
        });
        const exact = evaluatePartialPaymentEligibility({
            settings: { ...baseSettings, minimumLeadTimeDays: 3 },
            totalAmount: 1000,
            checkIn: new Date('2026-07-13T12:00:00Z'),
            now: new Date('2026-07-10T12:00:00Z'),
        });

        expect(below.eligible).toBe(false);
        expect(below.reasons).toContain('below_minimum_lead_time');
        expect(exact.eligible).toBe(true);
    });

    it('validates invalid percentages', () => {
        expect(validatePartialPaymentSettings({ ...baseSettings, percentage: 0 }).valid).toBe(false);
        expect(validatePartialPaymentSettings({ ...baseSettings, percentage: 100 }).valid).toBe(false);
        expect(validatePartialPaymentSettings({ ...baseSettings, percentage: 50 }).valid).toBe(true);
    });

    it('calculates full and partial payment plans with currency rounding', () => {
        const full = calculatePaymentPlan({
            settings: baseSettings,
            totalAmount: 999.99,
            checkIn: new Date('2026-07-20T12:00:00Z'),
            paymentMode: 'FULL',
            now: new Date('2026-07-10T12:00:00Z'),
        });
        const partial = calculatePaymentPlan({
            settings: baseSettings,
            totalAmount: 999.99,
            checkIn: new Date('2026-07-20T12:00:00Z'),
            paymentMode: 'PARTIAL',
            now: new Date('2026-07-10T12:00:00Z'),
        });

        expect(full.ok && full.amountDueNow).toBe(999.99);
        expect(full.ok && full.remainingAmount).toBe(0);
        expect(partial.ok && partial.amountDueNow).toBe(500);
        expect(partial.ok && partial.remainingAmount).toBe(499.99);
    });

    it('sets balance due before check-in when configured', () => {
        const plan = calculatePaymentPlan({
            settings: {
                ...baseSettings,
                balanceDueAt: 'BEFORE_CHECK_IN',
                balanceDueDaysBeforeCheckIn: 2,
            },
            totalAmount: 1000,
            checkIn: new Date('2026-07-20T12:00:00Z'),
            paymentMode: 'PARTIAL',
            now: new Date('2026-07-10T12:00:00Z'),
        });

        expect(plan.ok && plan.balanceDueAt).toBe('BEFORE_CHECK_IN');
        expect(plan.ok && plan.balanceDueDate?.toISOString()).toBe('2026-07-18T12:00:00.000Z');
    });
});
