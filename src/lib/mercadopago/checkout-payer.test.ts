import { describe, expect, it } from 'vitest';

import {
    buildCheckoutPayerRequest,
    parseCheckoutPayerRequest,
    resolveCheckoutPayer,
    validateThirdPartyPayerForm,
} from './checkout-payer';

const guest = {
    name: 'Maria da Silva',
    email: 'maria@example.com',
    phone: '+55 (19) 99900-2288',
};
const VALID_CPF = '529.982.247-25';

describe('resolveCheckoutPayer', () => {
    it('usa os dados do hóspede quando ele é o responsável pelo pagamento', () => {
        expect(resolveCheckoutPayer({ payer: { type: 'GUEST' }, cpf: VALID_CPF, guest })).toEqual({
            ok: true,
            type: 'GUEST',
            payer: {
                name: 'Maria',
                surname: 'da Silva',
                email: 'maria@example.com',
                phone: { area_code: '19', number: '999002288' },
                identification: { type: 'CPF', number: '52998224725' },
            },
        });
    });

    it('trata ausência do campo payer como hóspede pagador (clientes antigos)', () => {
        const result = resolveCheckoutPayer({ payer: undefined, cpf: VALID_CPF, guest });
        expect(result).toMatchObject({ ok: true, type: 'GUEST', payer: { email: 'maria@example.com' } });
    });

    it('usa somente dados do terceiro, sem completar com e-mail ou telefone do hóspede', () => {
        const result = resolveCheckoutPayer({
            payer: { type: 'THIRD_PARTY', name: '  João   Pereira  Souza ' },
            cpf: VALID_CPF,
            guest,
        });

        expect(result).toEqual({
            ok: true,
            type: 'THIRD_PARTY',
            payer: {
                name: 'João',
                surname: 'Pereira Souza',
                identification: { type: 'CPF', number: '52998224725' },
            },
        });
        const serialized = JSON.stringify(result);
        expect(serialized).not.toContain('maria@example.com');
        expect(serialized).not.toContain('999002288');
        expect(serialized).not.toContain('Maria');
    });

    it('envia e-mail e telefone do terceiro quando informados', () => {
        const result = resolveCheckoutPayer({
            payer: { type: 'THIRD_PARTY', name: 'João Pereira', email: ' JOAO@Example.com ', phone: '(11) 98888-7777' },
            cpf: VALID_CPF,
            guest,
        });

        expect(result).toMatchObject({
            ok: true,
            payer: {
                name: 'João',
                surname: 'Pereira',
                email: 'joao@example.com',
                phone: { area_code: '11', number: '988887777' },
            },
        });
    });

    it.each([
        ['apóstrofo tipográfico do iOS', 'Ana D’Ávila', 'Ana', "D'Ávila"],
        ['acento decomposto (NFD)', 'José Silva', 'José', 'Silva'],
        ['partículas e hífen', 'Maria das Graças Souza-Lima', 'Maria', 'das Graças Souza-Lima'],
        ['nome estrangeiro', 'Zoë O\'Brien', 'Zoë', "O'Brien"],
    ])('aceita nome legítimo de terceiro: %s', (_label, rawName, name, surname) => {
        expect(resolveCheckoutPayer({ payer: { type: 'THIRD_PARTY', name: rawName }, cpf: VALID_CPF, guest }))
            .toMatchObject({ ok: true, payer: { name, surname } });
    });

    it.each([
        ['DDI 55 com +', '+55 (11) 98888-7777', { area_code: '11', number: '988887777' }],
        ['DDI 55 sem +', '55 11 98888-7777', { area_code: '11', number: '988887777' }],
        ['fixo com DDD', '(19) 3842-1234', { area_code: '19', number: '38421234' }],
    ])('aceita telefone brasileiro do terceiro: %s', (_label, phone, expected) => {
        expect(resolveCheckoutPayer({ payer: { type: 'THIRD_PARTY', name: 'João Pereira', phone }, cpf: VALID_CPF, guest }))
            .toMatchObject({ ok: true, payer: { phone: expected } });
    });

    it.each([
        ['EUA', '+1 212 555 1234'],
        ['Portugal', '+351 912 345 678'],
    ])('recusa telefone estrangeiro do terceiro em vez de inventar DDD: %s', (_label, phone) => {
        expect(resolveCheckoutPayer({ payer: { type: 'THIRD_PARTY', name: 'João Pereira', phone }, cpf: VALID_CPF, guest }))
            .toEqual({ ok: false, error: 'INVALID_PAYER_DATA', field: 'phone' });
    });

    it('recusa CPF inválido nos dois modos', () => {
        expect(resolveCheckoutPayer({ payer: { type: 'GUEST' }, cpf: '111.111.111-11', guest }))
            .toEqual({ ok: false, error: 'INVALID_PAYER_IDENTIFICATION', field: 'cpf' });
        expect(resolveCheckoutPayer({ payer: { type: 'THIRD_PARTY', name: 'João Pereira' }, cpf: '123', guest }))
            .toEqual({ ok: false, error: 'INVALID_PAYER_IDENTIFICATION', field: 'cpf' });
    });

    it.each([
        ['nome ausente', { type: 'THIRD_PARTY' }, 'name'],
        ['somente primeiro nome', { type: 'THIRD_PARTY', name: 'João' }, 'name'],
        ['nome com dígitos', { type: 'THIRD_PARTY', name: 'João 123' }, 'name'],
        ['nome com e-mail', { type: 'THIRD_PARTY', name: 'joao@example.com' }, 'name'],
        ['e-mail inválido', { type: 'THIRD_PARTY', name: 'João Pereira', email: 'joao@' }, 'email'],
        ['telefone sem DDD', { type: 'THIRD_PARTY', name: 'João Pereira', phone: '98888-7777' }, 'phone'],
        ['tipo desconhecido', { type: 'COMPANY', name: 'João Pereira' }, 'type'],
        ['payer não-objeto', 'THIRD_PARTY', 'type'],
    ])('recusa dados incompletos ou inválidos: %s', (_label, payer, field) => {
        expect(resolveCheckoutPayer({ payer, cpf: VALID_CPF, guest }))
            .toEqual({ ok: false, error: 'INVALID_PAYER_DATA', field });
    });

    it('não altera o objeto do hóspede recebido', () => {
        const guestSnapshot = { ...guest };
        resolveCheckoutPayer({ payer: { type: 'THIRD_PARTY', name: 'João Pereira', email: 'joao@example.com' }, cpf: VALID_CPF, guest });
        expect(guest).toEqual(guestSnapshot);
    });
});

describe('parseCheckoutPayerRequest', () => {
    it('ignora campos de terceiro quando o tipo é GUEST', () => {
        expect(parseCheckoutPayerRequest({ type: 'GUEST', name: 'Outra Pessoa', email: 'x@example.com' }))
            .toEqual({ type: 'GUEST' });
    });
});

describe('formulário do responsável pelo pagamento', () => {
    it('monta GUEST sem dados de terceiro quando o hóspede paga, mesmo após alternância', () => {
        expect(buildCheckoutPayerRequest({
            payerIsGuest: true,
            thirdParty: { name: 'João Pereira', email: 'joao@example.com', phone: '(11) 98888-7777' },
        })).toEqual({ type: 'GUEST' });
    });

    it('monta THIRD_PARTY omitindo campos opcionais vazios', () => {
        expect(buildCheckoutPayerRequest({
            payerIsGuest: false,
            thirdParty: { name: ' João  Pereira ', email: ' ', phone: '' },
        })).toEqual({ type: 'THIRD_PARTY', name: 'João Pereira' });
    });

    it('valida com as mesmas regras do servidor', () => {
        expect(validateThirdPartyPayerForm({ name: 'João Pereira', email: '', phone: '' })).toBe('');
        expect(validateThirdPartyPayerForm({ name: 'João', email: '', phone: '' })).toMatch(/nome e sobrenome/i);
        expect(validateThirdPartyPayerForm({ name: 'João Pereira', email: 'x@', phone: '' })).toMatch(/e-mail/i);
        expect(validateThirdPartyPayerForm({ name: 'João Pereira', email: '', phone: '123' })).toMatch(/telefone/i);
    });
});
