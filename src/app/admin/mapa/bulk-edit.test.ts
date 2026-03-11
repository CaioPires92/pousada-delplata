import { describe, expect, it } from 'vitest';
import {
    applyWeekdayPreset,
    buildBulkUpdates,
    countAffectedDays,
    defaultBulkFieldToggles,
    defaultBulkFieldValues,
    getSelectedWeekdays,
    hasActiveBulkChanges,
} from './bulk-edit';

describe('bulk-edit helpers', () => {
    it('applies all preset to every weekday', () => {
        expect(getSelectedWeekdays(applyWeekdayPreset('all'))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('applies weekdays preset to mon-fri', () => {
        expect(getSelectedWeekdays(applyWeekdayPreset('weekdays'))).toEqual([1, 2, 3, 4, 5]);
    });

    it('applies weekend preset to fri-sun', () => {
        expect(getSelectedWeekdays(applyWeekdayPreset('weekend'))).toEqual([0, 5, 6]);
    });

    it('builds payload only with enabled fields', () => {
        const toggles = {
            ...defaultBulkFieldToggles(),
            price: true,
            cta: true,
        };
        const values = {
            ...defaultBulkFieldValues(),
            price: '299',
            cta: 'true' as const,
            inventory: '8',
        };

        const result = buildBulkUpdates(toggles, values);

        expect(result.errors).toEqual([]);
        expect(result.updates).toEqual({
            price: 299,
            cta: true,
        });
    });

    it('builds payload for all supported bulk fields when enabled', () => {
        const toggles = {
            ...defaultBulkFieldToggles(),
            price: true,
            minLos: true,
            inventory: true,
            stopSell: true,
            cta: true,
            ctd: true,
        };
        const values = {
            ...defaultBulkFieldValues(),
            price: '450',
            minLos: '3',
            inventory: '5',
            stopSell: 'true' as const,
            cta: 'false' as const,
            ctd: 'true' as const,
        };

        const result = buildBulkUpdates(toggles, values);

        expect(result.errors).toEqual([]);
        expect(result.updates).toEqual({
            price: 450,
            minLos: 3,
            inventory: 5,
            stopSell: true,
            cta: false,
            ctd: true,
        });
    });

    it('returns validation errors for enabled invalid fields', () => {
        const toggles = {
            ...defaultBulkFieldToggles(),
            minLos: true,
            inventory: true,
        };
        const values = {
            ...defaultBulkFieldValues(),
            minLos: '0',
            inventory: '-1',
        };

        const result = buildBulkUpdates(toggles, values);

        expect(result.updates).toEqual({});
        expect(result.errors).toEqual([
            'Mínimo de noites inválido.',
            'Quantidade de quartos inválida.',
        ]);
    });

    it('counts only affected selected weekdays in the summary', () => {
        const count = countAffectedDays('2026-03-09', '2026-03-15', applyWeekdayPreset('weekdays'));

        expect(count).toBe(5);
    });

    it('detects if any editable bulk field is active', () => {
        expect(hasActiveBulkChanges(defaultBulkFieldToggles())).toBe(false);
        expect(hasActiveBulkChanges({
            ...defaultBulkFieldToggles(),
            inventory: true,
        })).toBe(true);
    });
});
