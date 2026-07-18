import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReservarPage from './page';
import ReservationPageFallback from './components/ReservationPageFallback';
import { buildPaymentBrickInitializationPayer, normalizePaymentBrickPayer } from './payment-brick';

const searchParamState = {
  checkIn: '2026-01-01',
  checkOut: '2026-01-05',
  adults: '2',
  children: null as string | null,
  childrenAges: null as string | null,
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

describe('ReservarPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
    searchParamState.checkIn = '2026-01-01';
    searchParamState.checkOut = '2026-01-05';
    searchParamState.adults = '2';
    searchParamState.children = null;
    searchParamState.childrenAges = null;
    searchParamState.promo = null;
    searchParamState.coupon = null;
    searchParamState.roomTypeId = null;
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
