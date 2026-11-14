import { describe, expect, it } from 'vitest';
import { isValidEmail } from './email-validation';

describe('isValidEmail', () => {
    it.each([
        'maria@gmail.com',
        'joao.silva+reserva@empresa.com.br',
        '  Ana@Hotmail.com  ',
        'contato@sub-dominio.exemplo.org',
    ])('aceita %s', (email) => {
        expect(isValidEmail(email)).toBe(true);
    });

    it.each([
        '',
        'pepeke@pepeke',
        'pepeke',
        '@gmail.com',
        'maria@',
        'maria@gmail',
        'maria@gmail.c',
        'maria@gmail.com.',
        'maria@.gmail.com',
        'maria@gmail..com',
        'ma..ria@gmail.com',
        '.maria@gmail.com',
        'maria @gmail.com',
        'maria@gm ail.com',
        'maria@@gmail.com',
        'maria@gmail.123',
        'maria@-gmail.com',
        null,
        undefined,
    ])('recusa %s', (email) => {
        expect(isValidEmail(email)).toBe(false);
    });
});
