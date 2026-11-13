import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SearchWidget from './SearchWidget';

const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
let currentPathname = '/home';
let preferredRoomTypeId: string | null = null;
let campaignSource: string | null = null;
let promoCode: string | null = null;
let promoLocked = false;
let replaceStateSpy: ReturnType<typeof vi.spyOn>;
let pushStateSpy: ReturnType<typeof vi.spyOn>;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
  usePathname: () => currentPathname,
  useSearchParams: () => ({
    get: vi.fn((key: string) => {
      if (key === 'roomTypeId') return preferredRoomTypeId;
      if (key === 'utm_source') return campaignSource;
      if (key === 'promo') return promoCode;
      if (key === 'promoLock') return promoLocked ? '1' : null;
      return null;
    }),
  }),
}));

describe('SearchWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferredRoomTypeId = null;
    campaignSource = null;
    promoCode = null;
    promoLocked = false;
    currentPathname = '/home';
    window.sessionStorage.clear();
    replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
  });

  afterEach(() => {
    replaceStateSpy.mockRestore();
    pushStateSpy.mockRestore();
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

  it('atualiza o check-out e permite abrir seu calendário depois de alterar o check-in no mobile', async () => {
    render(<SearchWidget uiPreset="hero" />);
    const newCheckIn = addDays(new Date(), 10);
    const checkInTrigger = screen.getByTestId('checkin-trigger');
    const checkOutTrigger = screen.getByTestId('checkout-trigger');

    expect(checkInTrigger).toBeInstanceOf(HTMLButtonElement);
    expect(checkOutTrigger).toBeInstanceOf(HTMLButtonElement);

    fireEvent.click(checkInTrigger);
    const checkInDay = document.querySelector<HTMLButtonElement>(
      `[data-day="${format(newCheckIn, 'yyyy-MM-dd')}"] button`,
    );
    expect(checkInDay).not.toBeNull();
    fireEvent.click(checkInDay!);

    expect(checkOutTrigger).toHaveTextContent(
      format(addDays(newCheckIn, 1), 'dd MMM yyyy', { locale: ptBR }),
    );
    fireEvent.click(checkOutTrigger);
    await waitFor(() => expect(screen.getByTestId('checkout-popover')).toBeInTheDocument());
  }, 15000);

  it('permite pesquisar para cinco hóspedes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'room-5-guests' }],
      headers: { get: vi.fn(() => null) },
    });
    render(<SearchWidget />);

    fireEvent.change(screen.getByLabelText('Hóspedes'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('adults=5&children=0'));
    });
  });

  it('atualiza os resultados automaticamente ao alterar adultos depois da busca inicial', async () => {
    currentPathname = '/reservar';
    render(<SearchWidget prefillFromQuery />);

    fireEvent.change(screen.getByLabelText('Hóspedes'), { target: { value: '3' } });

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        '',
        expect.stringContaining('adults=3&children=0'),
      );
    });
  });

  it('atualiza os resultados automaticamente ao alterar crianças e pets', async () => {
    currentPathname = '/reservar';
    render(<SearchWidget prefillFromQuery />);

    fireEvent.change(screen.getByLabelText('Crianças'), { target: { value: '1' } });

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        '',
        expect.stringContaining('adults=2&children=1&childrenAges=0'),
      );
    });

    fireEvent.click(screen.getByRole('checkbox', { name: /Possui pets/i }));

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        '',
        expect.stringContaining('pets=1'),
      );
    });
  });

  it('em /reservar, "Ver disponibilidade" atualiza a URL pelo history (o router do Next descarta mudanças só de query)', async () => {
    currentPathname = '/reservar';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => [{ id: 'room-1' }],
    });
    render(<SearchWidget prefillFromQuery />);
    const button = screen.getByRole('button', { name: /Buscar/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() => expect(pushStateSpy).toHaveBeenCalledWith(null, '', expect.stringMatching(/^\/reservar\?checkIn=/)));
    expect(mockRouterPush).not.toHaveBeenCalled();
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

  it('inclui a quantidade de pets na busca quando selecionada', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'room-pet' }],
      headers: { get: vi.fn(() => null) },
    });
    render(<SearchWidget />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Possui pets/i }));
    fireEvent.change(screen.getByLabelText(/Quantidade de pets/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('pets=2'));
    });
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

  it('abre o campo de cupom no buscador da página inicial', () => {
    render(<SearchWidget uiPreset="hero" />);

    expect(screen.queryByLabelText('Código do cupom')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /adicionar cupom à busca/i }));
    expect(screen.getByLabelText('Código do cupom')).toBeInTheDocument();
  });

  it('abre e preenche automaticamente o cupom recebido pelo link', async () => {
    promoCode = 'VOLTE-ABC123';
    promoLocked = true;

    render(<SearchWidget uiPreset="hero" />);

    expect(await screen.findByLabelText('Código do cupom')).toHaveValue('VOLTE-ABC123');
    expect(screen.getByRole('checkbox', { name: /adicionar cupom à busca/i })).toBeChecked();
  });
});
