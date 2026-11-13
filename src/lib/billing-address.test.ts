import { describe, expect, it } from 'vitest';
import { formatGuestAddressLine, formatPostalCode, guestAddressData, parseBillingAddress } from '@/lib/billing-address';

const valid = { postalCode: '13720-000', address: 'Rua das Flores', addressNumber: '120', province: 'Centro' };

describe('parseBillingAddress', () => {
    it('normaliza CEP (só dígitos) e aparas de texto', () => {
        expect(parseBillingAddress({ ...valid, address: '  Rua   das  Flores ', complement: ' Casa 2 ' })).toEqual({
            postalCode: '13720000', address: 'Rua das Flores', addressNumber: '120', province: 'Centro', complement: 'Casa 2',
        });
    });

    it('aceita número não numérico (S/N, 12A) e omite complemento vazio', () => {
        expect(parseBillingAddress({ ...valid, addressNumber: 'S/N' })).toMatchObject({ addressNumber: 'S/N' });
        expect(parseBillingAddress(valid)).not.toHaveProperty('complement');
    });

    it('recusa quando falta CEP, rua, número ou bairro', () => {
        expect(parseBillingAddress({ ...valid, postalCode: '1372' })).toBeNull();
        expect(parseBillingAddress({ ...valid, address: '' })).toBeNull();
        expect(parseBillingAddress({ ...valid, addressNumber: '  ' })).toBeNull();
        expect(parseBillingAddress({ ...valid, province: '' })).toBeNull();
        expect(parseBillingAddress(null)).toBeNull();
        expect(parseBillingAddress('x')).toBeNull();
    });
});

describe('formatPostalCode', () => {
    it('formata 00000-000 enquanto digita', () => {
        expect(formatPostalCode('13720')).toBe('13720');
        expect(formatPostalCode('137200')).toBe('13720-0');
        expect(formatPostalCode('13720-000 99')).toBe('13720-000');
    });
});

describe('guestAddressData', () => {
    it('devolve os campos a gravar no hóspede, com cidade/UF opcionais', () => {
        expect(guestAddressData({ ...valid, complement: 'Apto 3', city: 'Serra Negra', state: 'sp' })).toEqual({
            postalCode: '13720000', address: 'Rua das Flores', addressNumber: '120', complement: 'Apto 3',
            province: 'Centro', city: 'Serra Negra', state: 'SP',
        });
        expect(guestAddressData(valid)).toMatchObject({ complement: null, city: null, state: null });
    });

    it('endereço incompleto não grava nada (não apaga o que já existe)', () => {
        expect(guestAddressData({ ...valid, province: '' })).toEqual({});
        expect(guestAddressData(undefined)).toEqual({});
    });
});

describe('formatGuestAddressLine', () => {
    it('monta a linha completa para o admin', () => {
        expect(formatGuestAddressLine({
            address: 'Rua das Flores', addressNumber: '120', complement: 'Apto 3', province: 'Centro', city: 'Serra Negra', state: 'sp', postalCode: '13720000',
        })).toBe('Rua das Flores, 120 (Apto 3) · Centro · Serra Negra/SP · CEP 13720-000');
    });

    it('omite o que não existe e devolve null quando não há endereço', () => {
        expect(formatGuestAddressLine({ address: 'Rua X', addressNumber: '5', province: 'Vila' })).toBe('Rua X, 5 · Vila');
        expect(formatGuestAddressLine({})).toBeNull();
        expect(formatGuestAddressLine({ address: null, postalCode: null })).toBeNull();
    });
});
