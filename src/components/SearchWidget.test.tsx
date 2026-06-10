import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchWidget from './SearchWidget';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/home',
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

describe('SearchWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('desabilita Buscar quando faltam idades das crianças', async () => {
    render(<SearchWidget />);
    const adults = screen.getByLabelText('Hóspedes') as HTMLSelectElement;
    const children = document.getElementById('children') as HTMLSelectElement;
    fireEvent.change(adults, { target: { value: '2' } });
    fireEvent.change(children, { target: { value: '1' } });
    const button = screen.getByRole('button', { name: /Buscar/i });
    await waitFor(() => expect(button).toBeDisabled());
  });

  it('habilita Buscar quando entradas são válidas', async () => {
    render(<SearchWidget />);
    const adults = screen.getByLabelText('Hóspedes') as HTMLSelectElement;
    const children = document.getElementById('children') as HTMLSelectElement;
    fireEvent.change(adults, { target: { value: '2' } });
    fireEvent.change(children, { target: { value: '0' } });
    const button = screen.getByRole('button', { name: /Buscar/i });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('faz fetch com parâmetros corretos ao buscar', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'room-1' }],
    });
    global.fetch = mockFetch;
    render(<SearchWidget />);
    const adults = screen.getByLabelText('Hóspedes') as HTMLSelectElement;
    const children = document.getElementById('children') as HTMLSelectElement;
    fireEvent.change(adults, { target: { value: '2' } });
    fireEvent.change(children, { target: { value: '0' } });
    const button = screen.getByRole('button', { name: /Buscar/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  });

  it('mostra aviso inline quando faltam idades das crianças', async () => {
    render(<SearchWidget />);
    const children = screen.getByLabelText('Crianças') as HTMLSelectElement;

    fireEvent.change(children, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByText(/Informe a idade para continuar/i)).toBeInTheDocument();
    });
  });
});
