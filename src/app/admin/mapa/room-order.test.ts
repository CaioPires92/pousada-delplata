import { describe, expect, it } from 'vitest';
import { getRoomSortPriority, normalizeRoomName } from './room-order';

describe('room order', () => {
    it('orders the Delplata rooms as requested', () => {
        const rooms = [
            'Apartamento Anexo',
            'Chalé',
            'Apartamento Superior',
            'Apartamento Térreo',
        ];

        const ordered = rooms.sort((a, b) => {
            const priority = getRoomSortPriority(a) - getRoomSortPriority(b);
            return priority || normalizeRoomName(a).localeCompare(normalizeRoomName(b), 'pt-BR');
        });

        expect(ordered).toEqual([
            'Apartamento Térreo',
            'Apartamento Superior',
            'Chalé',
            'Apartamento Anexo',
        ]);
    });

    it('places unknown room names after the configured rooms', () => {
        expect(getRoomSortPriority('Suíte futura')).toBe(4);
    });
});
