import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReservarPage from './page';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ReservarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('mantém cupom colapsado por padrão e expande ao clicar em "Tenho um cupom"', async () => {
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
    });

    render(<ReservarPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Room Cupom')).toBeInTheDocument();
    });

    screen.getByText(/Selecionar e Continuar/i).click();

    await waitFor(() => {
      expect(screen.getByText(/Passo 2 de 3/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tenho um cupom/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/Cupom de desconto/i)).not.toBeInTheDocument();
    });

    screen.getByRole('button', { name: /Tenho um cupom/i }).click();

    await waitFor(() => {
      expect(screen.getByLabelText(/Cupom de desconto/i)).toBeInTheDocument();
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
});
