import { fireEvent, render, screen } from '@testing-library/react';
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
        expect(screen.queryByText(/Próximos feriados/i)).not.toBeInTheDocument();
    });

    it('renderiza a versão editorial com CTA único', () => {
        render(<SpecialDatesSection dates={[baseDate]} />);
        expect(screen.getByText(/Próximos feriados/i)).toBeInTheDocument();
        expect(screen.getByText('Corpus Christi')).toBeInTheDocument();
        expect(screen.getByAltText('Corpus Christi')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Ver disponibilidade/i })).toHaveAttribute(
            'href',
            '/reservar?checkIn=2026-06-04&checkOut=2026-06-07&adults=2&children=0'
        );
    });

    it('usa /reservar sem datas quando useBaseReservarPath estiver ativo', () => {
        render(
            <SpecialDatesSection
                dates={[{
                    ...baseDate,
                    useBaseReservarPath: true,
                }]}
            />
        );

        expect(screen.getByRole('link', { name: /Ver disponibilidade/i })).toHaveAttribute('href', '/reservar');
    });

    it('renderiza fallback sem imagem quando image não existe', () => {
        render(<SpecialDatesSection dates={[{ ...baseDate, image: undefined }]} />);
        expect(screen.getByText('Corpus Christi')).toBeInTheDocument();
        expect(screen.queryByAltText('Corpus Christi')).not.toBeInTheDocument();
    });

    it('permite trocar a data ativa pelos botões da faixa', () => {
        const dates = [
            baseDate,
            {
                ...baseDate,
                id: 'independencia',
                title: 'Independência',
                dateFrom: '2026-09-04',
                dateTo: '2026-09-07',
            },
        ];

        render(<SpecialDatesSection dates={dates} />);

        fireEvent.click(screen.getByRole('button', { name: /04 - 07 SET independência/i }));

        expect(screen.getByRole('link', { name: /Ver disponibilidade/i })).toHaveAttribute(
            'href',
            '/reservar?checkIn=2026-09-04&checkOut=2026-09-07&adults=2&children=0'
        );
    });

    it('limita a faixa às três próximas datas habilitadas', () => {
        const dates = [
            baseDate,
            { ...baseDate, id: 'independencia', title: 'Independência', dateFrom: '2026-09-04', dateTo: '2026-09-07' },
            { ...baseDate, id: 'aparecida', title: 'Aparecida', dateFrom: '2026-10-09', dateTo: '2026-10-12' },
            { ...baseDate, id: 'finados', title: 'Finados', dateFrom: '2026-10-30', dateTo: '2026-11-02' },
        ];

        render(<SpecialDatesSection dates={dates} />);

        expect(screen.getByText('Corpus Christi')).toBeInTheDocument();
        expect(screen.getByText('Independência')).toBeInTheDocument();
        expect(screen.getByText('Aparecida')).toBeInTheDocument();
        expect(screen.queryByText('Finados')).not.toBeInTheDocument();
    });
});
