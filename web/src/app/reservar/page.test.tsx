import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReservarPage from './page';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ReservarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Hang forever to show loading
    render(<ReservarPage />);
    expect(screen.getByText(/Buscando as melhores opções/i)).toBeInTheDocument();
  });

  it('renders available rooms after fetch', async () => {
    const mockRooms = [
      {
        id: 'room-1',
        name: 'Luxo',
        description: 'Quarto legal',
        capacity: 2,
        amenities: 'Wifi',
        totalPrice: 500,
        photos: [{ url: '/fake.jpg' }]
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRooms,
    });

    render(<ReservarPage />);

    await waitFor(() => {
      expect(screen.getByText('Luxo')).toBeInTheDocument();
      const prices = screen.getAllByText('R$ 500.00');
      expect(prices.length).toBeGreaterThan(0);
    });
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
});
