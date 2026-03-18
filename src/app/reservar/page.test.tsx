import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReservarPage from './page';
import { buildPaymentBrickInitializationPayer, normalizePaymentBrickPayer } from './payment-brick';

const searchParamState = {
  checkIn: '2026-01-01',
  checkOut: '2026-01-05',
  adults: '2',
  children: null as string | null,
  childrenAges: null as string | null,
  promo: null as string | null,
  coupon: null as string | null,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/reservar',
  useSearchParams: () => ({
    get: vi.fn((key: keyof typeof searchParamState) => searchParamState[key] ?? null),
    toString: vi.fn(() => {
      const params = new URLSearchParams();
      Object.entries(searchParamState).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      return params.toString();
    }),
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ReservarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamState.checkIn = '2026-01-01';
    searchParamState.checkOut = '2026-01-05';
    searchParamState.adults = '2';
    searchParamState.children = null;
    searchParamState.childrenAges = null;
    searchParamState.promo = null;
    searchParamState.coupon = null;
    // Mock scrollIntoView to avoid errors in tests
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders loading state initially', async () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => { })); // Hang forever to show loading
    render(<ReservarPage />);
    expect(screen.getByText(/Buscando as melhores opções/i)).toBeInTheDocument();
  });

  it('renders available rooms after fetch', async () => {
    const mockRooms = [
      {
        id: 'room-1',
        name: 'Apartamento Anexo',
        description: 'Quarto legal',
        capacity: 2,
        amenities: 'Wifi',
        totalPrice: 500,
        photos: [{ url: '/fake.jpg' }]
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
      expect(screen.getByText('Apartamento Anexo')).toBeInTheDocument();
      const prices = screen.getAllByText('R$ 500.00');
      expect(prices.length).toBeGreaterThan(0);
      expect(screen.getByText(/Passo 1 de 3/i)).toBeInTheDocument();
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

    const terreoImg = screen.getByAltText('Apartamento Térreo') as HTMLImageElement;
    expect(terreoImg.getAttribute('src')).toBe('/fotos/ala-principal/apartamentos/terreo/com-janela/DSC_0001-1200.webp');

    const anexoImg = screen.getByAltText('Apartamento Anexo') as HTMLImageElement;
    expect(anexoImg.getAttribute('src')).toBe('https://cdn.example.com/real-photo.jpg');
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
    const selectButton = screen.getByText(/Selecionar e Continuar/i);
    selectButton.click();

    // Wait for breakdown to appear in summary
    await waitFor(() => {
      const totals = screen.getAllByText(/R\$ 760\.00/);
      expect(totals.length).toBeGreaterThan(0);
      expect(screen.getByText(/Base/i)).toBeInTheDocument();
      expect(screen.getByText(/Adulto extra/i)).toBeInTheDocument();
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

    screen.getByText(/Selecionar e Continuar/i).click();

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

    screen.getByText(/Selecionar e Continuar/i).click();

    await waitFor(() => {
      expect(screen.getAllByText(/Resumo da Reserva/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Ver resumo/i })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /Ver resumo/i }).click();

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

    fireEvent.click(screen.getByText(/Selecionar e Continuar/i));

    await waitFor(() => {
      expect(screen.getByText(/Passo 2 de 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Cupom aplicado/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText(/Telefone\/WhatsApp/i), { target: { value: '(11) 99999-0000' } });
    fireEvent.click(screen.getByLabelText(/Declaro que li e aceito/i));
    fireEvent.submit(screen.getByRole('button', { name: /Ir para Pagamento Seguro/i }).closest('form')!);

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
