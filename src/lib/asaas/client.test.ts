import { describe, expect, it } from 'vitest';
import { buildAsaasCustomerData } from '@/lib/asaas/client';

const billing = { postalCode: '13720000', address: 'Rua das Flores', addressNumber: '120', province: 'Centro' };

describe('buildAsaasCustomerData', () => {
    it('normaliza dados pessoais e inclui o endereço completo (sem cidade)', () => {
        const data = buildAsaasCustomerData(
            { name: '  Maria Silva ', email: ' MARIA@Example.COM ', phone: '+55 (11) 99999-0000', cpfCnpj: '123.456.789-09' },
            billing,
        );
        expect(data).toEqual({
            name: 'Maria Silva', email: 'maria@example.com', cpfCnpj: '12345678909', phone: '5511999990000',
            address: 'Rua das Flores', addressNumber: 120, postalCode: '13720000', province: 'Centro',
        });
        expect(Object.keys(data)).not.toContain('city');
    });

    it('número não numérico continua texto e complemento só entra se existir', () => {
        const data = buildAsaasCustomerData({ name: 'Ana', email: 'ana@example.com', phone: '', cpfCnpj: null }, { ...billing, addressNumber: '12A', complement: 'Apto 3' });
        expect(data).toMatchObject({ addressNumber: '12A', complement: 'Apto 3' });
        expect(data).not.toHaveProperty('cpfCnpj');
        expect(data).not.toHaveProperty('phone');
    });
});
