import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PoliticaDeCancelamentoPage from './page';

describe('PoliticaDeCancelamentoPage', () => {
    it('publica as regras de cancelamento vigentes', () => {
        render(<PoliticaDeCancelamentoPage />);

        expect(screen.getByText(/Deliberação Normativa nº 165\/95/i)).toBeInTheDocument();
        expect(screen.getByText(/saída antecipada/i)).toBeInTheDocument();
        expect(screen.getByText(/acima de 14 dias.*estorno de 100%/i)).toBeInTheDocument();
        expect(screen.getByText(/mais de 7 dias.*estorno de 50%/i)).toBeInTheDocument();
        expect(screen.getByText(/menos de 7 dias.*não há estorno nem crédito/i)).toBeInTheDocument();
        expect(screen.getByText(/menos de 24 horas ou no-show/i)).toBeInTheDocument();
        expect(screen.getByText(/crédito é em valor e não em número de diárias/i)).toBeInTheDocument();
        expect(screen.queryByText(/não anuncia prazos, percentuais, multas/i)).not.toBeInTheDocument();
    });
});
