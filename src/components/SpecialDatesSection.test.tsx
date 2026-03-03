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
        expect(screen.getAllByRole('link', { name: /Ver disponibilidade/i })).toHaveLength(1);
    });

    it('renderiza múltiplos cards sem quebrar', () => {
        const dates = [
            baseDate,
            { ...baseDate, id: 'independencia', title: 'Independência', dateFrom: '2026-09-05', dateTo: '2026-09-07' },
            { ...baseDate, id: 'republica', title: 'República', dateFrom: '2026-11-14', dateTo: '2026-11-16' },
        ];

        render(<SpecialDatesSection dates={dates} />);
        expect(screen.getByText('Corpus Christi')).toBeInTheDocument();
        expect(screen.getByText('Independência')).toBeInTheDocument();
        expect(screen.getByText('República')).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: /Ver disponibilidade/i })).toHaveLength(3);
    });
});
