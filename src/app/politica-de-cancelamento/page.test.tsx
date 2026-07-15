import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PoliticaDeCancelamentoPage from './page';

describe('PoliticaDeCancelamentoPage', () => {
    it('não publica condições comerciais sem validação', () => {
        render(<PoliticaDeCancelamentoPage />);

        expect(screen.getByText(/precisam ser confirmados com a Pousada Delplata/i)).toBeInTheDocument();
        expect(screen.getByText(/não anuncia prazos, percentuais, multas/i)).toBeInTheDocument();
        expect(screen.queryByText(/reserva poderá ser considerada utilizada/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/mesmo meio de pagamento/i)).not.toBeInTheDocument();
    });
});
