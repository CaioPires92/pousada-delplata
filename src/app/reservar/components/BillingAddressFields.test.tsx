import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BillingAddressFields, { emptyBillingForm, type BillingForm } from './BillingAddressFields';

function Harness({ onValue }: { onValue?: (value: BillingForm) => void }) {
    const [value, setValue] = useState<BillingForm>(emptyBillingForm);
    return (
        <BillingAddressFields
            value={value}
            onChange={(next) => {
                setValue(next);
                onValue?.(next);
            }}
        />
    );
}

describe('BillingAddressFields', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('formata o CEP e preenche rua, bairro e cidade pela consulta; o número fica para o hóspede', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ postalCode: '13720000', address: 'Rua das Flores', province: 'Centro', city: 'Serra Negra', state: 'SP' }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        render(<Harness />);

        fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '13720000' } });

        await waitFor(() => expect(screen.getByLabelText(/Rua/i)).toHaveValue('Rua das Flores'));
        expect(screen.getByLabelText(/CEP/i)).toHaveValue('13720-000');
        expect(screen.getByLabelText(/Bairro/i)).toHaveValue('Centro');
        expect(screen.getByRole('status')).toHaveTextContent('Serra Negra – SP');
        expect(screen.getByLabelText(/Número/i)).toHaveValue('');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/api/cep/13720000', expect.anything());
    });

    it('CEP não encontrado avisa e permite preencher manualmente', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: 'POSTAL_CODE_NOT_FOUND' }) })));
        render(<Harness />);

        fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '00000000' } });
        expect(await screen.findByText(/CEP não encontrado/i)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/Rua/i), { target: { value: 'Rua Nova' } });
        expect(screen.getByLabelText(/Rua/i)).toHaveValue('Rua Nova');
    });

    it('falha da consulta não bloqueia: mostra aviso e os campos continuam editáveis', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        render(<Harness />);

        fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '13720000' } });
        expect(await screen.findByText(/Não foi possível buscar o CEP/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Bairro/i)).not.toBeDisabled();
    });

    it('CEP incompleto não consulta nada', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        render(<Harness />);
        fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '1372' } });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
