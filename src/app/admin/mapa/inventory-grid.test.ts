import { describe, expect, it } from 'vitest';
import {
    getHorizontalSelection,
    getInventoryMaxAllowed,
    parseInventoryDraft,
} from './inventory-grid';

describe('inventory-grid helpers', () => {
    it('returns a horizontal contiguous selection between two days', () => {
        expect(
            getHorizontalSelection(
                ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12'],
                '2026-03-10',
                '2026-03-12'
            )
        ).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
    });

    it('accepts a valid direct inventory value', () => {
        expect(parseInventoryDraft('3', 8)).toEqual({ ok: true, value: 3 });
    });

    it('blocks values above allowed maximum', () => {
        expect(parseInventoryDraft('9', 8)).toEqual({ ok: false, error: 'O valor máximo permitido é 8.' });
    });

    it('calculates max available for standard and quadruplo', () => {
        expect(getInventoryMaxAllowed({
            field: 'inventory',
            capacityTotal: 8,
            bookingsCount: 2,
        })).toBe(6);

        expect(getInventoryMaxAllowed({
            field: 'fourGuestInventory',
            fourGuestCapacityTotal: 2,
            bookingsFor4GuestsCount: 1,
        })).toBe(1);
    });
});
