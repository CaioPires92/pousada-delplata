import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchWidget from './SearchWidget';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/home',
}));

describe('SearchWidget', () => {
  it('desabilita Buscar quando faltam idades das crianças', () => {
    render(<SearchWidget />);
    const adults = screen.getByLabelText('Adultos') as HTMLSelectElement;
    const children = screen.getByLabelText('Crianças') as HTMLSelectElement;
    fireEvent.change(adults, { target: { value: '2' } });
    fireEvent.change(children, { target: { value: '1' } });
    const button = screen.getByRole('button', { name: /Buscar/i });
    expect(button).toBeDisabled();
  });

  it('habilita Buscar quando entradas são válidas', () => {
    render(<SearchWidget />);
    const adults = screen.getByLabelText('Adultos') as HTMLSelectElement;
    const children = screen.getByLabelText('Crianças') as HTMLSelectElement;
    fireEvent.change(adults, { target: { value: '2' } });
    fireEvent.change(children, { target: { value: '0' } });
    const button = screen.getByRole('button', { name: /Buscar/i });
    expect(button).not.toBeDisabled();
  });

  it('faz fetch com parâmetros corretos ao buscar', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'room-1' }],
    });
    global.fetch = mockFetch;
    render(<SearchWidget />);
    const adults = screen.getByLabelText('Adultos') as HTMLSelectElement;
    const children = screen.getByLabelText('Crianças') as HTMLSelectElement;
    fireEvent.change(adults, { target: { value: '2' } });
    fireEvent.change(children, { target: { value: '0' } });
    const button = screen.getByRole('button', { name: /Buscar/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(mockFetch).toHaveBeenCalled();
  });
});
