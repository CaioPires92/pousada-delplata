import { describe, expect, it } from 'vitest';
import { roomAcceptsPets } from './pet-policy';

describe('pet policy', () => {
    it('aceita pets só nos térreos, chalés e anexos', () => {
        expect(roomAcceptsPets('Apartamento Térreo')).toBe(true);
        expect(roomAcceptsPets('Chalé')).toBe(true);
        expect(roomAcceptsPets('Apartamento Anexo')).toBe(true);
        expect(roomAcceptsPets('Apartamento Superior')).toBe(false);
        expect(roomAcceptsPets(null)).toBe(false);
    });
});
