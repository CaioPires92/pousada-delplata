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

vi.mock('./HomeAvailabilityOffers', () => ({
  default: () => <div data-testid="home-availability-offers" />,
}));

describe('HomeContent', () => {
  it('apresenta uma proposta comercial baseada apenas em informações confirmadas', () => {
    render(<HomeContent />);

    expect(screen.getByRole('heading', {
      level: 1,
      name: /Pousada em Serra Negra para descansar em família/i,
    })).toBeInTheDocument();
    expect(screen.getByText(/Piscinas, café da manhã e acomodações na ala principal/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver preços e disponibilidade/i })).toHaveAttribute('href', '/reservar');
    expect(screen.getByText(/Consulte valores para sua estadia/i)).toBeInTheDocument();
    expect(screen.getByTestId('home-availability-offers')).toBeInTheDocument();
    expect(screen.queryByText(/Melhor tarifa garantida/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ótimo custo-benefício/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mais privacidade/i)).not.toBeInTheDocument();
  });

});
