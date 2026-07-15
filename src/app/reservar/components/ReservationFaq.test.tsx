import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReservationFaq from './ReservationFaq';

describe('ReservationFaq', () => {
    it('responde apenas com informações disponíveis no fluxo', () => {
        render(<ReservationFaq />);

        expect(screen.getByRole('heading', { name: /Dúvidas antes de reservar/i })).toBeInTheDocument();
        expect(screen.getByText(/Pix ou cartão/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /política de cancelamento/i })).toHaveAttribute('href', '/politica-de-cancelamento');
        expect(screen.queryByText(/estacionamento|acessibilidade|pet/i)).not.toBeInTheDocument();
    });
});
