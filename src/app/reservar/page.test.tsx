import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ReservarPage from './page';
import ReservationPageFallback from './components/ReservationPageFallback';
import { buildPaymentBrickInitializationPayer, normalizePaymentBrickPayer } from './payment-brick';
import {
  MERCADO_PAGO_DEVICE_CHECKOUT_WAIT_TIMEOUT_MS,
  startMercadoPagoDeviceIdObservation,
  waitForMercadoPagoDeviceId,
} from '@/lib/mercadopago/device-id';

vi.mock('@/lib/mercadopago/device-id', () => ({
  MERCADO_PAGO_DEVICE_CHECKOUT_WAIT_TIMEOUT_MS: 10_000,
  startMercadoPagoDeviceIdObservation: vi.fn(),
  waitForMercadoPagoDeviceId: vi.fn(),
}));

const searchParamState = {
  checkIn: '2026-01-01',
  checkOut: '2026-01-05',
  adults: '2',
  children: null as string | null,
  childrenAges: null as string | null,
  pets: null as string | null,
  promo: null as string | null,
  coupon: null as string | null,
  roomTypeId: null as string | null,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/reservar',
  useSearchParams: (() => {
    const params = {
      get: vi.fn((key: keyof typeof searchParamState) => searchParamState[key] ?? null),
      toString: vi.fn(() => {
        const params = new URLSearchParams();
        Object.entries(searchParamState).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
        return params.toString();
      }),
    };
    return () => params;
  })(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockHostedCheckoutApi() {
  mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/availability')) {
      return {
        ok: true,
        json: async () => [{
          id: 'room-standard-value',
          name: 'Suíte Especial',
          description: 'Acomodação',
          capacity: 2,
          amenities: 'Wi-Fi',
          totalPrice: 1000,
          photos: [],
        }],
        headers: { get: vi.fn(() => null) },
      };
    }
    if (url === '/api/bookings') {
      return {
        ok: true,
        json: async () => ({ id: 'booking-standard-value', totalPrice: 1000 }),
        headers: { get: vi.fn(() => null) },
      };
    }
    if (url.startsWith('/api/partial-payment/evaluate')) {
      return {
        ok: true,
        json: async () => ({ eligible: false, defaultPaymentMode: 'FULL', fullAmount: 1000 }),
        headers: { get: vi.fn(() => null) },
      };
    }
    if (url === '/api/mercadopago/checkout-pro') {
      return {
        ok: true,
        json: async () => ({ initPoint: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1' }),
        headers: { get: vi.fn(() => null) },
      };
    }
    return {
      ok: true,
      json: async () => ({}),
      headers: { get: vi.fn(() => null) },
    };
  });
}

async function renderHostedCheckout() {
  vi.stubEnv('NEXT_PUBLIC_ENABLE_TEST_PAYMENTS', 'true');
  mockHostedCheckoutApi();
  render(<ReservarPage />);
  await screen.findByText('Suíte Especial');
  fireEvent.click(screen.getByRole('button', { name: /^Escolher acomodação$/i }));
  fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Maria Silva' } });
  fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'maria@example.com' } });
  fireEvent.change(screen.getByLabelText(/Telefone\/WhatsApp/i), { target: { value: '(11) 99999-0000' } });
  fireEvent.change(screen.getByLabelText(/CPF do pagador/i), { target: { value: '529.982.247-25' } });
  fireEvent.click(screen.getByLabelText(/Declaro que li e aceito/i));
  fireEvent.submit(screen.getByRole('button', { name: /Continuar para o pagamento/i }).closest('form')!);
  return screen.findByRole('button', { name: /Continuar para o Mercado Pago/i });
}

describe('ReservarPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
    searchParamState.checkIn = '2026-01-01';
    searchParamState.checkOut = '2026-01-05';
    searchParamState.adults = '2';
    searchParamState.children = null;
    searchParamState.childrenAges = null;
    searchParamState.pets = null;
    searchParamState.promo = null;
    searchParamState.coupon = null;
    searchParamState.roomTypeId = null;
    vi.mocked(startMercadoPagoDeviceIdObservation).mockImplementation(() => vi.fn());
    vi.mocked(waitForMercadoPagoDeviceId).mockResolvedValue(undefined);
    // Mock scrollIntoView to avoid errors in tests
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders loading state initially', async () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => { })); // Hang forever to show loading
    render(<ReservarPage />);
    await waitFor(() => {
      expect(screen.getByText(/Buscando as melhores opções/i)).toBeInTheDocument();
    });
  });

  it('starts Device ID observation on page load and stops it on unmount', () => {
    const stopObservation = vi.fn();
    vi.mocked(startMercadoPagoDeviceIdObservation).mockReturnValueOnce(stopObservation);
    mockFetch.mockImplementationOnce(() => new Promise(() => { }));

    const { unmount } = render(<ReservarPage />);

    expect(startMercadoPagoDeviceIdObservation).toHaveBeenCalledTimes(1);
    unmount();
    expect(stopObservation).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ignores placeholder URLs and falls back to local photos', async () => {
    const mockRooms = [
      {
        id: 'room-1',
        name: 'Apartamento Térreo',
        description: 'Quarto térreo',
        capacity: 2,
        amenities: 'Wifi',
        totalPrice: 500,
        photos: [{ url: 'https://picsum.photos/seed/terreo1/600/400' }],
      },
      {
        id: 'room-2',
        name: 'Apartamento Anexo',
        description: 'Quarto anexo',
        capacity: 2,
        amenities: 'Wifi',
        totalPrice: 500,
        photos: [{ url: 'https://cdn.example.com/real-photo.jpg' }],
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockRooms,
      headers: {
        get: vi.fn(() => null),
      },
    });

    render(<ReservarPage />);

    await waitFor(() => {
      expect(screen.getByText('Apartamento Térreo')).toBeInTheDocument();
      expect(screen.getByText('Apartamento Anexo')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('heading', { name: /Escolha sua Acomodação/i })).toHaveLength(1);
    const resultsContainer = screen.getByRole('heading', { name: /Escolha sua Acomodação/i })
      .closest('main')?.firstElementChild;
    expect(resultsContainer).toHaveClass('max-w-[1440px]');

    const terreoImg = screen.getByAltText('Apartamento Térreo') as HTMLImageElement;
    expect(terreoImg.getAttribute('src')).toBe('/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0001-1200.webp');

    const anexoImg = screen.getByAltText('Apartamento Anexo') as HTMLImageElement;
    expect(anexoImg.getAttribute('src')).toBe('https://cdn.example.com/real-photo.jpg');
    expect(screen.queryByText(/Melhor tarifa garantida/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reserva 100% Segura/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/criptografia SSL/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Pix ou cartão/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Valor total exibido/i).length).toBeGreaterThan(0);
  });

  it('abre direto no checkout quando a URL informa a acomodação escolhida', async () => {
    searchParamState.roomTypeId = 'room-preferred';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'room-other', name: 'Outra acomodação', description: 'Outra', capacity: 2, amenities: 'WiFi', totalPrice: 400, photos: [] },
        { id: 'room-preferred', name: 'Acomodação escolhida', description: 'Escolhida', capacity: 2, amenities: 'WiFi', totalPrice: 500, photos: [] },
      ],
      headers: { get: vi.fn(() => null) },
    });

    render(<ReservarPage />);

    await waitFor(() => {
      expect(screen.getByText(/Passo 2 de 3/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText('Acomodação escolhida').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Escolher acomodação/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fechar busca/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver disponibilidade/i })).toBeInTheDocument();
  });

  it('oferece contexto útil no fallback renderizado antes do JavaScript', () => {
    render(<ReservationPageFallback />);

    expect(screen.getByRole('heading', {
      level: 1,
      name: /Preparando sua consulta de disponibilidade/i,
    })).toBeInTheDocument();
    expect(screen.getByText(/datas, a ocupação e as acomodações cadastradas/i)).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      headers: {
        get: vi.fn(() => null),
      },
    });

    render(<ReservarPage />);

    await waitFor(() => {
      expect(screen.getByText(/Erro ao carregar quartos/i)).toBeInTheDocument();
    });
  });

  it('repete a mesma busca após erro sem perder os parâmetros', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
        headers: { get: vi.fn(() => null) },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 'room-retry',
          name: 'Acomodação após retry',
          description: 'Descrição cadastrada',
          capacity: 2,
          amenities: 'WiFi',
          totalPrice: 500,
          photos: [],
        }],
        headers: { get: vi.fn(() => null) },
      });

    render(<ReservarPage />);

    await waitFor(() => {
      expect(screen.getByText(/Erro ao carregar quartos disponíveis/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    await waitFor(() => {
      expect(screen.getByText('Acomodação após retry')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[0][0])).toContain('checkIn=2026-01-01');
    expect(String(mockFetch.mock.calls[1][0])).toContain('checkIn=2026-01-01');
  });

  // NEW TESTS FROM PLAN

  it('should display skeleton loading UI while fetching availability', async () => {
    // Mock fetch to hang so we can verify loading state
    mockFetch.mockImplementationOnce(() => new Promise(() => { }));

    render(<ReservarPage />);

    // Check for skeleton loading indicators
    await waitFor(() => {
      expect(screen.getByText(/Buscando as melhores opções para você/i)).toBeInTheDocument();
    });

    // Verify skeleton structure elements exist (using class names or data-testid would be better in production)
    const loadingContainer = screen.getByText(/Buscando as melhores opções/i).closest('main');
    expect(loadingContainer).toHaveClass('min-h-screen');
  });

  it('should display price breakdown with extra adult and child fees', async () => {
    const mockRooms = [
      {
        id: 'room-1',
        name: 'Test Room',
        description: 'Nice room',
        capacity: 4,
        amenities: 'WiFi, TV',
        totalPrice: 760,
        priceBreakdown: {
          nights: 2,
          baseTotal: 400,
          effectiveAdults: 3,
          childrenUnder12: 1,
          extraAdults: 1,
          children6To11: 1,
          extrasPerNight: 180,
          extraAdultTotal: 200,
          childTotal: 160,
          total: 760,
        },
        photos: [{ url: '/test.jpg' }]
      }
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockRooms,
      headers: {
        get: vi.fn(() => null),
      },
    });

    render(<ReservarPage />);

    // Wait for room to load
    await waitFor(() => {
      expect(screen.getByText('Test Room')).toBeInTheDocument();
    });

    // Click to select room and show breakdown
    const selectButton = screen.getByText(/Escolher acomodação/i);
    fireEvent.click(selectButton);

    // Wait for breakdown to appear in summary
    await waitFor(() => {
      const totals = screen.getAllByText(/R\$\s*760,00/);
      expect(totals.length).toBeGreaterThan(0);
      expect(screen.getByText(/Base/i)).toBeInTheDocument();
      expect(screen.getByText(/Hóspedes adicionais/i)).toBeInTheDocument();
      expect(screen.getByText(/Crianças 6–11/i)).toBeInTheDocument();
    });
  });

  it('não exibe bloco de cupom aplicado quando não há código promocional', async () => {
    const mockRooms = [
      {
        id: 'room-1',
        name: 'Test Room Cupom',
        description: 'Nice room',
        capacity: 2,
        amenities: 'WiFi',
        totalPrice: 600,
        photos: [{ url: '/test.jpg' }],
      }
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockRooms,
      headers: {
        get: vi.fn(() => null),
      },
    });

    render(<ReservarPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Room Cupom')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Escolher acomodação/i));

    await waitFor(() => {
      expect(screen.getByText(/Passo 2 de 3/i)).toBeInTheDocument();
      expect(screen.queryByText(/Cupom aplicado/i)).not.toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText(/Digite o código do cupom/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Tenho um cupom de desconto/i }));
    expect(screen.getByPlaceholderText(/Digite o código do cupom/i)).toBeInTheDocument();
  });

  it('exibe resumo mobile com botão "Ver resumo" e expande detalhes', async () => {
    const mockRooms = [
      {
        id: 'room-1',
        name: 'Suite Mobile',
        description: 'Room summary',
        capacity: 2,
        amenities: 'WiFi',
        totalPrice: 650,
        photos: [{ url: '/test.jpg' }],
      }
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockRooms,
      headers: {
        get: vi.fn(() => null),
      },
    });

    render(<ReservarPage />);

    await waitFor(() => {
      expect(screen.getByText('Suite Mobile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Escolher acomodação/i));

    await waitFor(() => {
      expect(screen.getAllByText(/Resumo da Reserva/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Ver resumo/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Ver resumo/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Hóspedes/i).length).toBeGreaterThan(0);
    });
  });

  it('renova a reserva do cupom no submit antes de criar a booking', async () => {
    searchParamState.promo = 'VIP10';

    const mockRooms = [
      {
        id: 'room-1',
        name: 'Suite Cupom',
        description: 'Quarto com desconto',
        capacity: 2,
        amenities: 'WiFi',
        totalPrice: 540,
        priceOriginal: 600,
        discountAmount: 60,
        promoApplied: true,
        photos: [{ url: '/test.jpg' }],
      },
    ];

    let reserveCount = 0;
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);

      if (url.startsWith('/api/availability')) {
        return {
          ok: true,
          json: async () => mockRooms,
          headers: {
            get: vi.fn((key: string) => {
              if (key === 'x-promo-applied') return 'true';
              return null;
            }),
          },
        };
      }

      if (url === '/api/coupons/release') {
        return {
          ok: true,
          json: async () => ({ released: true }),
          headers: { get: vi.fn(() => null) },
        };
      }

      if (url === '/api/coupons/reserve') {
        reserveCount += 1;
        return {
          ok: true,
          json: async () => ({
            valid: true,
            reservationId: reserveCount === 1 ? 'res-1' : 'res-2',
            discountAmount: 60,
            subtotal: 600,
            total: 540,
            reservationExpiresAt: '2099-01-01T00:00:00.000Z',
          }),
          headers: { get: vi.fn(() => null) },
        };
      }

      if (url === '/api/bookings') {
        return {
          ok: true,
          json: async () => ({
            id: 'booking-1',
            totalPrice: 540,
          }),
          headers: { get: vi.fn(() => null) },
        };
      }

      return {
        ok: true,
        json: async () => ({}),
        headers: { get: vi.fn(() => null) },
      };
    });

    render(<ReservarPage />);

    await waitFor(() => {
      expect(screen.getByText('Suite Cupom')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Escolher acomodação/i));

    await waitFor(() => {
      expect(screen.getByText(/Passo 2 de 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Cupom aplicado/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText(/Telefone\/WhatsApp/i), { target: { value: '(11) 99999-0000' } });
    fireEvent.change(screen.getByLabelText(/CPF do pagador/i), { target: { value: '529.982.247-25' } });
    expect(screen.getByLabelText(/Nome Completo/i)).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText(/^Email/i)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/Telefone\/WhatsApp/i)).toHaveAttribute('autocomplete', 'tel');
    fireEvent.click(screen.getByLabelText(/Declaro que li e aceito/i));
    const guestForm = screen.getByRole('button', { name: /Continuar para o pagamento/i }).closest('form')!;
    fireEvent.submit(guestForm);
    fireEvent.submit(guestForm);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/bookings',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
    });

    const bookingCall = mockFetch.mock.calls.find((call) => call[0] === '/api/bookings');
    expect(bookingCall).toBeTruthy();
    expect(mockFetch.mock.calls.filter((call) => call[0] === '/api/bookings')).toHaveLength(1);

    const bookingPayload = JSON.parse(String(bookingCall?.[1]?.body));
    expect(bookingPayload.coupon).toEqual({
      reservationId: 'res-2',
      code: 'VIP10',
    });
  });

  it('inicializa o Brick apenas com email no payer', () => {
    expect(buildPaymentBrickInitializationPayer('maria@example.com')).toEqual({
      email: 'maria@example.com',
    });
  });

  it('aguarda o Device ID tardio, mostra processamento e bloqueia cliques duplicados no Checkout Pro', async () => {
    let resolveDeviceId: (deviceId: string | undefined) => void = () => {};
    vi.mocked(waitForMercadoPagoDeviceId).mockImplementationOnce(() => new Promise((resolve) => {
      resolveDeviceId = resolve;
    }));
    const continueButton = await renderHostedCheckout();
    expect(screen.getByText(/Modo teste Mercado Pago/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/mercadopago/checkout-pro',
      expect.anything()
    );

    fireEvent.click(continueButton);
    fireEvent.click(continueButton);

    expect(await screen.findByText(/Preparando pagamento seguro/i)).toBeInTheDocument();
    expect(waitForMercadoPagoDeviceId).toHaveBeenCalledTimes(1);
    expect(waitForMercadoPagoDeviceId).toHaveBeenCalledWith(MERCADO_PAGO_DEVICE_CHECKOUT_WAIT_TIMEOUT_MS);
    expect(mockFetch.mock.calls.filter((call) => call[0] === '/api/mercadopago/checkout-pro')).toHaveLength(0);

    await act(async () => {
      resolveDeviceId('device-session-123');
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/mercadopago/checkout-pro',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const checkoutCall = mockFetch.mock.calls.find((call) => call[0] === '/api/mercadopago/checkout-pro');
    expect(mockFetch.mock.calls.filter((call) => call[0] === '/api/mercadopago/checkout-pro')).toHaveLength(1);
    expect(JSON.parse(String(checkoutCall?.[1]?.body))).toMatchObject({
      deviceId: 'device-session-123',
    });
  });

  it('continua o Checkout Pro sem Device ID após timeout e registra somente indisponibilidade', async () => {
    window.dataLayer = [];
    vi.mocked(waitForMercadoPagoDeviceId).mockResolvedValueOnce(undefined);
    const continueButton = await renderHostedCheckout();

    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/mercadopago/checkout-pro',
        expect.objectContaining({ method: 'POST' })
      );
    });
    const checkoutCall = mockFetch.mock.calls.find((call) => call[0] === '/api/mercadopago/checkout-pro');
    const checkoutPayload = JSON.parse(String(checkoutCall?.[1]?.body));
    expect(checkoutPayload).not.toHaveProperty('deviceId');
    expect(JSON.stringify(window.dataLayer)).toContain('payment_device_id');
    expect(JSON.stringify(window.dataLayer)).toContain('unavailable');
  });

  // Fluxo completo de UI é lento sob carga (WSL/suíte completa); limite explícito só nestes testes.
  const PAYER_UI_TEST_TIMEOUT_MS = 20_000;

  async function fillGuestFormUntilPayer() {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_TEST_PAYMENTS', 'true');
    mockHostedCheckoutApi();
    vi.mocked(waitForMercadoPagoDeviceId).mockResolvedValue('device-session-123');
    render(<ReservarPage />);
    await screen.findByText('Suíte Especial');
    fireEvent.click(screen.getByRole('button', { name: /^Escolher acomodação$/i }));
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText(/Telefone\/WhatsApp/i), { target: { value: '(11) 99999-0000' } });
  }

  async function submitGuestFormAndOpenCheckout() {
    fireEvent.change(screen.getByLabelText(/CPF do pagador/i), { target: { value: '529.982.247-25' } });
    fireEvent.click(screen.getByLabelText(/Declaro que li e aceito/i));
    fireEvent.submit(screen.getByRole('button', { name: /Continuar para o pagamento/i }).closest('form')!);
    fireEvent.click(await screen.findByRole('button', { name: /Continuar para o Mercado Pago/i }));
    await waitFor(() => {
      expect(mockFetch.mock.calls.some((call) => call[0] === '/api/mercadopago/checkout-pro')).toBe(true);
    });
    const bookingCall = mockFetch.mock.calls.find((call) => call[0] === '/api/bookings');
    const checkoutCall = mockFetch.mock.calls.find((call) => call[0] === '/api/mercadopago/checkout-pro');
    return {
      bookingPayload: JSON.parse(String(bookingCall?.[1]?.body)),
      checkoutPayload: JSON.parse(String(checkoutCall?.[1]?.body)),
    };
  }

  it('envia o hóspede como responsável pelo pagamento por padrão', async () => {
    await fillGuestFormUntilPayer();
    expect(screen.getByLabelText(/Outra pessoa fará o pagamento/i)).not.toBeChecked();
    expect(screen.queryByLabelText(/Nome e sobrenome do pagador/i)).not.toBeInTheDocument();

    const { checkoutPayload } = await submitGuestFormAndOpenCheckout();

    expect(checkoutPayload).toMatchObject({
      payerCpf: '52998224725',
      payer: { type: 'GUEST' },
      deviceId: 'device-session-123',
    });
  }, PAYER_UI_TEST_TIMEOUT_MS);

  it('envia dados do terceiro ao Checkout Pro sem alterar os dados do hóspede na reserva', async () => {
    await fillGuestFormUntilPayer();
    fireEvent.click(screen.getByLabelText(/Outra pessoa fará o pagamento/i));
    fireEvent.change(screen.getByLabelText(/Nome e sobrenome do pagador/i), { target: { value: 'João Pereira' } });
    fireEvent.change(screen.getByLabelText(/E-mail do pagador/i), { target: { value: 'joao@example.com' } });

    const { bookingPayload, checkoutPayload } = await submitGuestFormAndOpenCheckout();

    expect(bookingPayload.guest).toEqual({ name: 'Maria Silva', email: 'maria@example.com', phone: '(11) 99999-0000' });
    expect(JSON.stringify(bookingPayload)).not.toContain('João');
    expect(JSON.stringify(bookingPayload)).not.toContain('52998224725');
    expect(checkoutPayload).toMatchObject({
      guestEmail: 'maria@example.com',
      payerCpf: '52998224725',
      payer: { type: 'THIRD_PARTY', name: 'João Pereira', email: 'joao@example.com' },
    });
    expect(checkoutPayload.payer).not.toHaveProperty('phone');
  }, PAYER_UI_TEST_TIMEOUT_MS);

  it('volta a enviar o hóspede como pagador ao desmarcar a opção de terceiro', async () => {
    await fillGuestFormUntilPayer();
    const thirdPartyToggle = screen.getByLabelText(/Outra pessoa fará o pagamento/i);
    fireEvent.click(thirdPartyToggle);
    fireEvent.change(screen.getByLabelText(/Nome e sobrenome do pagador/i), { target: { value: 'João Pereira' } });
    fireEvent.click(thirdPartyToggle);
    expect(screen.queryByLabelText(/Nome e sobrenome do pagador/i)).not.toBeInTheDocument();

    const { checkoutPayload } = await submitGuestFormAndOpenCheckout();

    expect(checkoutPayload.payer).toEqual({ type: 'GUEST' });
    expect(JSON.stringify(checkoutPayload)).not.toContain('João');
  }, PAYER_UI_TEST_TIMEOUT_MS);

  it('bloqueia o envio quando o terceiro não informa nome e sobrenome', async () => {
    await fillGuestFormUntilPayer();
    fireEvent.click(screen.getByLabelText(/Outra pessoa fará o pagamento/i));
    fireEvent.change(screen.getByLabelText(/Nome e sobrenome do pagador/i), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/CPF do pagador/i), { target: { value: '529.982.247-25' } });
    fireEvent.click(screen.getByLabelText(/Declaro que li e aceito/i));
    fireEvent.submit(screen.getByRole('button', { name: /Continuar para o pagamento/i }).closest('form')!);

    expect(await screen.findByText(/Informe nome e sobrenome do responsável pelo pagamento/i)).toBeInTheDocument();
    expect(mockFetch.mock.calls.filter((call) => call[0] === '/api/bookings')).toHaveLength(0);
  }, PAYER_UI_TEST_TIMEOUT_MS);

  it('bloqueia o envio com CPF inválido do pagador', async () => {
    await fillGuestFormUntilPayer();
    fireEvent.change(screen.getByLabelText(/CPF do pagador/i), { target: { value: '111.111.111-11' } });
    fireEvent.click(screen.getByLabelText(/Declaro que li e aceito/i));
    fireEvent.submit(screen.getByRole('button', { name: /Continuar para o pagamento/i }).closest('form')!);

    expect(await screen.findByText(/Informe um CPF válido/i)).toBeInTheDocument();
    expect(mockFetch.mock.calls.filter((call) => call[0] === '/api/bookings')).toHaveLength(0);
  }, PAYER_UI_TEST_TIMEOUT_MS);

  it('permite corrigir o pagador após erro de validação sem criar outra reserva', async () => {
    await fillGuestFormUntilPayer();
    let checkoutCalls = 0;
    const baseImplementation = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/mercadopago/checkout-pro') {
        checkoutCalls += 1;
        if (checkoutCalls === 1) {
          return {
            ok: false,
            json: async () => ({
              error: 'INVALID_PAYER_DATA',
              field: 'name',
              message: 'Informe nome e sobrenome do responsável pelo pagamento, como constam no CPF.',
            }),
            headers: { get: vi.fn(() => null) },
          };
        }
      }
      return baseImplementation(input, init);
    });

    await submitGuestFormAndOpenCheckout();

    expect(await screen.findByText(/Corrija os dados do responsável pelo pagamento/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Outra pessoa fará o pagamento/i));
    fireEvent.change(screen.getByLabelText(/Nome e sobrenome do pagador/i), { target: { value: 'João' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar e tentar novamente/i }));
    expect(await screen.findByText(/Informe nome e sobrenome do responsável pelo pagamento/i)).toBeInTheDocument();
    expect(checkoutCalls).toBe(1);

    fireEvent.change(screen.getByLabelText(/Nome e sobrenome do pagador/i), { target: { value: 'João Pereira' } });
    fireEvent.change(screen.getByLabelText(/CPF do pagador/i), { target: { value: '111.444.777-35' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar e tentar novamente/i }));

    await waitFor(() => expect(checkoutCalls).toBe(2));
    const checkoutRequests = mockFetch.mock.calls.filter((call) => call[0] === '/api/mercadopago/checkout-pro');
    const retryPayload = JSON.parse(String(checkoutRequests[1]?.[1]?.body));
    expect(retryPayload).toMatchObject({
      bookingId: 'booking-standard-value',
      payerCpf: '11144477735',
      payer: { type: 'THIRD_PARTY', name: 'João Pereira' },
    });
    expect(mockFetch.mock.calls.filter((call) => call[0] === '/api/bookings')).toHaveLength(1);
  }, PAYER_UI_TEST_TIMEOUT_MS);

  it('não oferece corrigir o pagador quando o erro não depende dele', async () => {
    await fillGuestFormUntilPayer();
    const baseImplementation = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/mercadopago/checkout-pro') {
        return {
          ok: false,
          json: async () => ({ error: 'PAYMENT_UNDER_REVIEW', message: 'Já existe um pagamento desta reserva em análise pelo Mercado Pago.' }),
          headers: { get: vi.fn(() => null) },
        };
      }
      return baseImplementation(input, init);
    });

    await submitGuestFormAndOpenCheckout();

    expect(await screen.findByText(/pagamento desta reserva em análise/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Corrigir dados do pagador/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Corrija os dados do responsável pelo pagamento/i)).not.toBeInTheDocument();
  }, PAYER_UI_TEST_TIMEOUT_MS);

  it('remove entityType inválido ao normalizar payer do Brick', () => {
    expect(
      normalizePaymentBrickPayer({
        payerFromBrick: {
          email: 'maria@example.com',
          entityType: 'company',
          identification: {
            type: 'CPF',
            number: '12345678909',
          },
        },
        guestName: 'Maria Silva',
        guestEmail: 'maria@example.com',
      })
    ).toEqual({
      email: 'maria@example.com',
      first_name: 'Maria',
      last_name: 'Silva',
      identification: {
        type: 'CPF',
        number: '12345678909',
      },
      entity_type: undefined,
    });
  });
});
