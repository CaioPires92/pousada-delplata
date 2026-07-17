import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchWidget from './SearchWidget';

const mockRouterPush = vi.fn();
let preferredRoomTypeId: string | null = null;
let campaignSource: string | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => '/home',
  useSearchParams: () => ({
    get: vi.fn((key: string) => {
      if (key === 'roomTypeId') return preferredRoomTypeId;
      if (key === 'utm_source') return campaignSource;
      return null;
    }),
  }),
}));

describe('SearchWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferredRoomTypeId = null;
    campaignSource = null;
    window.sessionStorage.clear();
  });

  it('seleciona 0 anos por padrão ao adicionar uma criança', async () => {
    render(<SearchWidget />);
    const adults = screen.getByLabelText('Hóspedes') as HTMLSelectElement;
    const children = document.getElementById('children') as HTMLSelectElement;
    fireEvent.change(adults, { target: { value: '2' } });
    fireEvent.change(children, { target: { value: '1' } });
    const button = screen.getByRole('button', { name: /Buscar/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.getByLabelText('Idade da criança 1')).toHaveValue('0');
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

  it('preserva a acomodação de origem ao seguir para os resultados', async () => {
    preferredRoomTypeId = 'room-origin';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'room-origin' }],
      headers: { get: vi.fn(() => null) },
    });

    render(<SearchWidget />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('roomTypeId=room-origin'));
    });
  });

  it('preserva a origem da campanha ao seguir para os resultados', async () => {
    campaignSource = 'google';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'room-1' }],
      headers: { get: vi.fn(() => null) },
    });

    render(<SearchWidget />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('utm_source=google'));
    });
  });

  it('explica quando a consulta excede o tempo limite', async () => {
    global.fetch = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    render(<SearchWidget />);

    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    expect(await screen.findByText(/demorou mais que o esperado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Falar com a pousada no WhatsApp/i })).toBeInTheDocument();
  });

  it('envia childrenAges=0 quando a criança permanece com idade padrão', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'room-1' }],
      headers: { get: vi.fn(() => null) },
    });
    render(<SearchWidget />);
    const children = screen.getByLabelText('Crianças') as HTMLSelectElement;

    fireEvent.change(children, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('childrenAges=0'));
    });
  });

  it('não promete melhor tarifa no buscador da página inicial', () => {
    render(<SearchWidget uiPreset="hero" />);

    expect(screen.getByText('Consulte valores')).toBeInTheDocument();
    expect(screen.queryByText(/melhor tarifa/i)).not.toBeInTheDocument();
  });
});
