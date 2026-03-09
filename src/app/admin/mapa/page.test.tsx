import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { format } from 'date-fns';
import type { ReactNode } from 'react';
import MapaPage from './page';
import { getOccupancyMetrics } from './occupancy';

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
        <a href={href} {...props}>{children}</a>
    )
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createJsonResponse = (data: unknown, ok = true, status = 200): Response => ({
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data)
} as Response);

const setupMapFetch = (calendarEntry: Record<string, unknown>) => {
    const rooms = [{ id: 'room-1', name: 'Apartamento Teste', basePrice: 100 }];
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url =
            typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url;
        if (url.includes('/api/rooms')) {
            return createJsonResponse(rooms);
        }
        if (url.includes('/api/admin/calendar')) {
            return createJsonResponse([calendarEntry]);
        }
        return createJsonResponse([], true, 200);
    });
};

describe('Admin Mapa de Tarifas - UI refinements', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', {
            value: vi.fn(),
            writable: true
        });
    });

    it('renderiza o mapa com dados completos e remove o bloco de tarifa base', async () => {
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        setupMapFetch({
            date: todayKey,
            price: 350,
            stopSell: false,
            cta: true,
            ctd: true,
            minLos: 2,
            rateId: 'rate-1',
            totalInventory: 10,
            capacityTotal: 10,
            bookingsCount: 6,
            available: 4,
            isAdjusted: false
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
            expect(screen.getByText('Apartamento Teste')).toBeInTheDocument();
            expect(screen.getByText('HOJE')).toBeInTheDocument();
            expect(screen.getByText('Disponíveis: 4')).toBeInTheDocument();
        });

        expect(screen.queryByText(/Tarifa base:/i)).not.toBeInTheDocument();
        expect(getOccupancyMetrics({ capacityTotal: 10, bookingsCount: 6, available: 4 }).occupancyPct).toBe(60);
    });

    it('renderiza com capacidade = 0 e fallback de ocupacao sem crash', async () => {
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        setupMapFetch({
            date: todayKey,
            price: 250,
            stopSell: false,
            cta: false,
            ctd: false,
            minLos: 1,
            rateId: 'rate-2',
            totalInventory: 4,
            capacityTotal: 0,
            bookingsCount: 0,
            available: 4,
            isAdjusted: false
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
            expect(screen.getByText('Apartamento Teste')).toBeInTheDocument();
        });

        expect(getOccupancyMetrics({ capacityTotal: 0, bookingsCount: 0, available: 4 }).occupancyPct).toBeNull();
    });

    it('renderiza com campos faltando e aplica fallback defensivo sem crash', async () => {
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        setupMapFetch({
            date: todayKey,
            price: 199,
            stopSell: false,
            cta: false,
            ctd: false,
            minLos: 1,
            rateId: 'rate-3',
            totalInventory: 3,
            capacityTotal: 3,
            bookingsCount: null,
            available: null,
            isAdjusted: false
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
            expect(screen.getByText('Apartamento Teste')).toBeInTheDocument();
        });

        const metrics = getOccupancyMetrics({ capacityTotal: 3, bookingsCount: null, available: null });
        expect(metrics.occupancyPct).toBeNull();
        expect(metrics.band).toBeNull();
    });
});
