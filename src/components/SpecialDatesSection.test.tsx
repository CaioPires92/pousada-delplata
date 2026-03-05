import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import SpecialDatesSection from './SpecialDatesSection';
import type { SpecialDateConfig } from '@/constants/specialDates';

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

const baseDate: SpecialDateConfig = {
    id: 'corpus',
    title: 'Corpus Christi',
    description: 'Alta procura',
    dateFrom: '2026-06-04',
    dateTo: '2026-06-07',
    image: '/fotos/piscina-aptos/DJI_0845.jpg',
    minNights: 2,
    enabled: true,
};

describe('SpecialDatesSection', () => {
    it('não renderiza seção quando não há itens habilitados', () => {
        render(<SpecialDatesSection dates={[{ ...baseDate, enabled: false }]} />);
        expect(screen.queryByText(/Próximas Datas Especiais/i)).not.toBeInTheDocument();
    });

    it('renderiza seção com 1 card', () => {
        render(<SpecialDatesSection dates={[baseDate]} />);
        expect(screen.getByText(/Próximas Datas Especiais/i)).toBeInTheDocument();
        expect(screen.getByText('Corpus Christi')).toBeInTheDocument();
        expect(screen.getByAltText('Corpus Christi')).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: /Ver disponibilidade/i })).toHaveLength(1);
    });

    it('usa dateFrom/dateTo no link dos cards normais', () => {
        render(<SpecialDatesSection dates={[baseDate]} />);
        const link = screen.getByRole('link', { name: /Ver disponibilidade/i });
        expect(link).toHaveAttribute('href', '/reservar?checkIn=2026-06-04&checkOut=2026-06-07&adults=2&children=0');
    });

    it('renderiza card sem imagem quando o campo image não existe', () => {
        render(<SpecialDatesSection dates={[{ ...baseDate, image: undefined }]} />);
        expect(screen.getByText('Corpus Christi')).toBeInTheDocument();
        expect(screen.queryByAltText('Corpus Christi')).not.toBeInTheDocument();
    });

    it('renderiza múltiplos cards sem quebrar', () => {
        const dates = [
            baseDate,
            { ...baseDate, id: 'independencia', title: 'Independência', dateFrom: '2026-09-05', dateTo: '2026-09-07', image: undefined },
            { ...baseDate, id: 'republica', title: 'República', dateFrom: '2026-11-14', dateTo: '2026-11-16' },
        ];

        render(<SpecialDatesSection dates={dates} />);
        expect(screen.getByText('Corpus Christi')).toBeInTheDocument();
        expect(screen.getByText('Independência')).toBeInTheDocument();
        expect(screen.getByText('República')).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: /Ver disponibilidade/i })).toHaveLength(3);
    });

    it('renderiza controles do slider para navegar entre cards', () => {
        const dates = [
            baseDate,
            { ...baseDate, id: 'independencia', title: 'Independência', dateFrom: '2026-09-05', dateTo: '2026-09-07', image: undefined },
        ];

        render(<SpecialDatesSection dates={dates} />);
        expect(screen.getByRole('button', { name: /Ver datas anteriores/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ver próximas datas/i })).toBeInTheDocument();
    });

    it('formata mês do período em UTC para evitar mudança de mês por fuso', () => {
        const marchPromo: SpecialDateConfig = {
            ...baseDate,
            id: 'marco-promo',
            title: 'Março - Baixa Temporada',
            dateFrom: '2026-03-01',
            dateTo: '2026-03-31',
        };

        render(<SpecialDatesSection dates={[marchPromo]} />);
        expect(screen.getByText('01-31 mar')).toBeInTheDocument();
    });

    it('usa /reservar sem datas para o card de março configurado com useBaseReservarPath', () => {
        const marchPromo: SpecialDateConfig = {
            ...baseDate,
            id: 'marco-promo',
            title: 'Março - Baixa Temporada',
            dateFrom: '2026-03-01',
            dateTo: '2026-03-31',
            useBaseReservarPath: true,
        };

        render(<SpecialDatesSection dates={[marchPromo]} />);
        const link = screen.getByRole('link', { name: /Ver disponibilidade/i });
        expect(link).toHaveAttribute('href', '/reservar');
    });

});
