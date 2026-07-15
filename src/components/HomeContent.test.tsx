import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import HomeContent from './HomeContent';

beforeAll(() => {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0];
    disconnect = vi.fn();
    observe = vi.fn();
    takeRecords = vi.fn(() => []);
    unobserve = vi.fn();
  }

  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('./SearchWidget', () => ({
  default: () => <div data-testid="search-widget" />,
}));

vi.mock('./SpecialDatesSection', () => ({
  default: () => <div data-testid="special-dates" />,
}));

const wingSummaries = [
  {
    id: 'ala-principal' as const,
    title: 'Ala Principal',
    description: 'Acomodações da ala principal.',
    highlights: ['Apartamentos térreo e superior', 'Até 4 hóspedes'],
  },
  {
    id: 'ala-anexo' as const,
    title: 'Ala Chalés e Anexos',
    description: 'Chalés e apartamentos anexos.',
    highlights: ['Chalés e apartamentos anexos', 'Até 4 hóspedes'],
  },
];

describe('HomeContent', () => {
  it('apresenta uma proposta comercial baseada apenas em informações confirmadas', () => {
    render(<HomeContent wingSummaries={wingSummaries} />);

    expect(screen.getByRole('heading', {
      level: 1,
      name: /Pousada em Serra Negra para descansar em família/i,
    })).toBeInTheDocument();
    expect(screen.getByText(/Piscinas, café da manhã e acomodações na ala principal/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver preços e disponibilidade/i })).toHaveAttribute('href', '/reservar');
    expect(screen.queryByText(/Melhor tarifa garantida/i)).not.toBeInTheDocument();
  });

  it('usa a capacidade recebida do cadastro, sem valor fixo na home', () => {
    render(<HomeContent wingSummaries={wingSummaries} />);

    expect(screen.getAllByText('Até 4 hóspedes')).toHaveLength(2);
  });
});
