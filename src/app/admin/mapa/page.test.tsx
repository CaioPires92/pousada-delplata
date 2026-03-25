import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import MapaPage from './page';
import { getOccupancyMetrics } from './occupancy';
import styles from './mapa.module.css';

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

const setupMapFetch = (calendarEntry: Record<string, unknown> | Record<string, unknown>[]) => {
    const rooms = [{ id: 'room-1', name: 'Apartamento Teste', basePrice: 100, inventoryFor4Guests: 2 }];
    const calendarEntries = Array.isArray(calendarEntry) ? calendarEntry : [calendarEntry];
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
            return createJsonResponse(calendarEntries);
        }
        return createJsonResponse([], true, 200);
    });
};

describe('Admin Mapa de Tarifas - UI refinements', () => {
    const fixedTodayKey = '2026-03-11';

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', {
            value: vi.fn(),
            writable: true
        });
    });

    it('renderiza o mapa com dados completos e remove o bloco de tarifa base', async () => {
        setupMapFetch({
            date: fixedTodayKey,
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
            fourGuestInventory: 2,
            fourGuestCapacityTotal: 2,
            isAdjusted: false
        });

        const { container } = render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
            expect(screen.getByText('Apartamento Teste')).toBeInTheDocument();
            expect(screen.getByText('HOJE')).toBeInTheDocument();
            expect(container.textContent).toContain('Standard');
            expect(container.textContent).toContain('Ocupação');
        });

        expect(screen.queryByText(/Tarifa base:/i)).not.toBeInTheDocument();
        expect(getOccupancyMetrics({ capacityTotal: 10, bookingsCount: 6, available: 4 }).occupancyPct).toBe(60);
    }, 30000);

    it('renderiza com capacidade = 0 e fallback de ocupacao sem crash', async () => {
        setupMapFetch({
            date: fixedTodayKey,
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
            fourGuestInventory: 0,
            fourGuestCapacityTotal: 0,
            isAdjusted: false
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
            expect(screen.getByText('Apartamento Teste')).toBeInTheDocument();
        });

        expect(getOccupancyMetrics({ capacityTotal: 0, bookingsCount: 0, available: 4 }).occupancyPct).toBeNull();
    }, 30000);

    it('renderiza com campos faltando e aplica fallback defensivo sem crash', async () => {
        setupMapFetch({
            date: fixedTodayKey,
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
            fourGuestInventory: 0,
            fourGuestCapacityTotal: 0,
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
    }, 30000);

    it('destaca o card inteiro em vermelho quando o quarto esta fechado', async () => {
        setupMapFetch({
            date: fixedTodayKey,
            price: 320,
            stopSell: true,
            cta: false,
            ctd: false,
            minLos: 1,
            rateId: 'rate-4',
            totalInventory: 8,
            capacityTotal: 8,
            bookingsCount: 0,
            available: 8,
            fourGuestInventory: 2,
            fourGuestCapacityTotal: 2,
            isAdjusted: false
        });

        const { container } = render(<MapaPage />);

        await waitFor(() => {
            expect(container.textContent).toContain('FECHADO');
            expect(screen.getAllByRole('button', { name: /Aumentar standard/i }).length).toBeGreaterThan(0);
        });

        expect(container.querySelector(`.${styles.inventoryClosed}`)).toBeTruthy();
    }, 30000);

    it('exibe a linha compacta de quadruplo no mapa', async () => {
        setupMapFetch({
            date: fixedTodayKey,
            price: 350,
            stopSell: false,
            cta: false,
            ctd: false,
            minLos: 1,
            rateId: 'rate-5',
            totalInventory: 8,
            capacityTotal: 8,
            bookingsCount: 0,
            available: 8,
            fourGuestInventory: 2,
            fourGuestCapacityTotal: 2,
            bookingsFor4GuestsCount: 0,
            isAdjusted: false,
            isFourGuestAdjusted: false
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Quadruplo')).toBeInTheDocument();
            expect(screen.getByText('Standard')).toBeInTheDocument();
            expect(screen.getAllByRole('button', { name: /Diminuir quadruplo/i }).length).toBeGreaterThan(0);
            expect(screen.getAllByRole('button', { name: /Aumentar quadruplo/i }).length).toBeGreaterThan(0);
            expect(screen.getAllByRole('button', { name: /Aumentar standard/i }).length).toBeGreaterThan(0);
        });
    }, 30000);

    it('envia no bulk edit apenas os campos ativados e expõe todos os controles operacionais', async () => {
        let bulkPayload: Record<string, unknown> | null = null;
        let inventoryPayload: Record<string, unknown> | null = null;

        mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url =
                typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.toString()
                        : input.url;

            if (url.includes('/api/rooms')) {
                return createJsonResponse([{ id: 'room-1', name: 'Apartamento Teste', basePrice: 100, inventoryFor4Guests: 2 }]);
            }
            if (url.includes('/api/admin/calendar')) {
                return createJsonResponse([{
                    date: fixedTodayKey,
                    price: 350,
                    stopSell: false,
                    cta: false,
                    ctd: false,
                    minLos: 1,
                    rateId: 'rate-6',
                    totalInventory: 8,
                    capacityTotal: 8,
                    bookingsCount: 0,
                    available: 8,
                    fourGuestInventory: 2,
                    fourGuestCapacityTotal: 2,
                    isAdjusted: false
                }]);
            }
            if (url.includes('/api/rates/bulk') && init?.method === 'POST') {
                bulkPayload = JSON.parse(String(init.body));
                return createJsonResponse({ success: true });
            }
            if (url.includes('/api/admin/inventory') && init?.method === 'POST') {
                inventoryPayload = JSON.parse(String(init.body));
                return createJsonResponse({ success: true });
            }
            return createJsonResponse([], true, 200);
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /edição em lote/i }));

        await waitFor(() => {
            expect(screen.getByTestId('bulk-modal')).toBeInTheDocument();
            expect(screen.getByLabelText('Tipo de quarto')).toBeInTheDocument();
            expect(screen.getByLabelText('Data inicial')).toBeInTheDocument();
            expect(screen.getByLabelText('Data final')).toBeInTheDocument();
            expect(screen.getByText('Alterar mínimo de noites')).toBeInTheDocument();
            expect(screen.getByText('Alterar quantidade de quartos disponíveis')).toBeInTheDocument();
            expect(screen.getByText('Alterar Stop Sell')).toBeInTheDocument();
            expect(screen.getByText('Alterar CTA')).toBeInTheDocument();
            expect(screen.getByText('Alterar CTD')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-03-09' } });
        fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-03-11' } });

        fireEvent.click(screen.getByLabelText('Alterar preço da diária'));
        fireEvent.change(screen.getByPlaceholderText('Ex.: 299'), { target: { value: '420' } });

        fireEvent.click(screen.getByLabelText('Alterar Stop Sell'));
        fireEvent.change(screen.getByLabelText('Valor de Stop Sell'), { target: { value: 'true' } });

        fireEvent.click(screen.getByRole('button', { name: /Aplicar alterações em lote/i }));

        await waitFor(() => {
            expect(bulkPayload).toEqual({
                roomTypeId: 'all',
                startDate: '2026-03-09',
                endDate: '2026-03-11',
                updates: {
                    price: 420,
                    stopSell: true,
                },
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            });
            expect(inventoryPayload).toBeNull();
        });
    }, 30000);

    it('envia inventário em lote de quadruplo para a rota administrativa correta', async () => {
        let ratePayload: Record<string, unknown> | null = null;
        let inventoryPayload: Record<string, unknown> | null = null;

        mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url =
                typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.toString()
                        : input.url;

            if (url.includes('/api/rooms')) {
                return createJsonResponse([{ id: 'room-1', name: 'Apartamento Teste', basePrice: 100, inventoryFor4Guests: 2 }]);
            }
            if (url.includes('/api/admin/calendar')) {
                return createJsonResponse([{
                    date: fixedTodayKey,
                    price: 350,
                    stopSell: false,
                    cta: false,
                    ctd: false,
                    minLos: 1,
                    rateId: 'rate-7',
                    totalInventory: 8,
                    capacityTotal: 8,
                    bookingsCount: 0,
                    available: 8,
                    fourGuestInventory: 2,
                    fourGuestCapacityTotal: 2,
                    isAdjusted: false
                }]);
            }
            if (url.includes('/api/rates/bulk') && init?.method === 'POST') {
                ratePayload = JSON.parse(String(init.body));
                return createJsonResponse({ success: true });
            }
            if (url.includes('/api/admin/inventory') && init?.method === 'POST') {
                inventoryPayload = JSON.parse(String(init.body));
                return createJsonResponse({ success: true });
            }
            return createJsonResponse([], true, 200);
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /edição em lote/i }));

        await waitFor(() => {
            expect(screen.getByTestId('bulk-modal')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-03-09' } });
        fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-03-11' } });
        fireEvent.click(screen.getByLabelText('Alterar quantidade de quartos disponíveis'));
        fireEvent.click(screen.getByRole('button', { name: 'Quadruplo' }));
        fireEvent.change(screen.getByPlaceholderText('Ex.: 4'), { target: { value: '1' } });
        fireEvent.click(screen.getByRole('button', { name: /Aplicar alterações em lote/i }));

        await waitFor(() => {
            expect(ratePayload).toBeNull();
            expect(inventoryPayload).toEqual({
                roomTypeId: 'all',
                startDate: '2026-03-09',
                endDate: '2026-03-11',
                updates: {
                    fourGuestInventory: 1,
                },
                inventoryType: 'fourGuests',
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            });
        });
    }, 30000);

    it('permite seleção horizontal por arrasto no inventário standard e abre ação contextual', async () => {
        const entries = [
            {
                date: '2026-03-11',
                price: 350,
                stopSell: false,
                cta: false,
                ctd: false,
                minLos: 1,
                rateId: 'rate-a',
                totalInventory: 8,
                capacityTotal: 8,
                bookingsCount: 0,
                available: 8,
                fourGuestInventory: 2,
                fourGuestCapacityTotal: 2,
                isAdjusted: false
            },
            {
                date: '2026-03-12',
                price: 350,
                stopSell: false,
                cta: false,
                ctd: false,
                minLos: 1,
                rateId: 'rate-b',
                totalInventory: 7,
                capacityTotal: 8,
                bookingsCount: 1,
                available: 7,
                fourGuestInventory: 2,
                fourGuestCapacityTotal: 2,
                bookingsFor4GuestsCount: 0,
                isAdjusted: false
            }
        ];
        let inventoryPayload: Record<string, unknown> | null = null;

        mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url =
                typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.toString()
                        : input.url;

            if (url.includes('/api/rooms')) {
                return createJsonResponse([{ id: 'room-1', name: 'Apartamento Teste', basePrice: 100, inventoryFor4Guests: 2 }]);
            }
            if (url.includes('/api/admin/calendar')) {
                return createJsonResponse(entries);
            }
            if (url.includes('/api/admin/inventory') && init?.method === 'POST') {
                inventoryPayload = JSON.parse(String(init.body));
                return createJsonResponse({ success: true, appliedLimit: false });
            }
            return createJsonResponse([], true, 200);
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
        });

        const startCell = screen.getByTestId('inventory-cell-room-1-2026-03-11');
        const endCell = screen.getByTestId('inventory-cell-room-1-2026-03-12');

        fireEvent.mouseDown(startCell, { button: 0 });
        fireEvent.mouseEnter(endCell);
        fireEvent.mouseUp(window);

        await waitFor(() => {
            expect(screen.getByText(/Aplicar quartos disponíveis em 2 dias/i)).toBeInTheDocument();
        });

        fireEvent.change(screen.getByRole('spinbutton', { name: 'Valor para aplicar em lote' }), { target: { value: '3' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

        await waitFor(() => {
            expect(inventoryPayload).toEqual({
                roomTypeId: 'room-1',
                startDate: '2026-03-11',
                endDate: '2026-03-12',
                updates: {
                    inventory: 3,
                },
                inventoryType: 'standard',
            });
        });
    }, 30000);

    it('cancela a seleção por arrasto sem aplicar alterações', async () => {
        setupMapFetch([
            {
                date: '2026-03-11',
                price: 350,
                stopSell: false,
                cta: false,
                ctd: false,
                minLos: 1,
                rateId: 'rate-a',
                totalInventory: 8,
                capacityTotal: 8,
                bookingsCount: 0,
                available: 8,
                fourGuestInventory: 2,
                fourGuestCapacityTotal: 2,
                isAdjusted: false
            },
            {
                date: '2026-03-12',
                price: 350,
                stopSell: false,
                cta: false,
                ctd: false,
                minLos: 1,
                rateId: 'rate-b',
                totalInventory: 7,
                capacityTotal: 8,
                bookingsCount: 1,
                available: 7,
                fourGuestInventory: 2,
                fourGuestCapacityTotal: 2,
                isAdjusted: false
            }
        ]);

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
        });

        const startCell = screen.getByTestId('inventory-cell-room-1-2026-03-11');
        const endCell = screen.getByTestId('inventory-cell-room-1-2026-03-12');

        fireEvent.mouseDown(startCell, { button: 0 });
        fireEvent.mouseEnter(endCell);
        fireEvent.mouseUp(window);

        await waitFor(() => {
            expect(screen.getByText(/Aplicar quartos disponíveis em 2 dias/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        await waitFor(() => {
            expect(screen.queryByText(/Aplicar quartos disponíveis em 2 dias/i)).not.toBeInTheDocument();
        });
    }, 30000);

    it('permite arrasto horizontal em preço e envia payload compatível para rates bulk', async () => {
        const entries = [
            {
                date: '2026-03-11',
                price: 350,
                stopSell: false,
                cta: false,
                ctd: false,
                minLos: 1,
                rateId: 'rate-a',
                totalInventory: 8,
                capacityTotal: 8,
                bookingsCount: 0,
                available: 8,
                fourGuestInventory: 2,
                fourGuestCapacityTotal: 2,
                isAdjusted: false
            },
            {
                date: '2026-03-12',
                price: 360,
                stopSell: false,
                cta: false,
                ctd: false,
                minLos: 1,
                rateId: 'rate-b',
                totalInventory: 8,
                capacityTotal: 8,
                bookingsCount: 0,
                available: 8,
                fourGuestInventory: 2,
                fourGuestCapacityTotal: 2,
                isAdjusted: false
            }
        ];
        let ratePayload: Record<string, unknown> | null = null;

        mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url =
                typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.toString()
                        : input.url;

            if (url.includes('/api/rooms')) {
                return createJsonResponse([{ id: 'room-1', name: 'Apartamento Teste', basePrice: 100, inventoryFor4Guests: 2 }]);
            }
            if (url.includes('/api/admin/calendar')) {
                return createJsonResponse(entries);
            }
            if (url.includes('/api/rates/bulk') && init?.method === 'POST') {
                ratePayload = JSON.parse(String(init.body));
                return createJsonResponse({ success: true });
            }
            return createJsonResponse([], true, 200);
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
        });

        const startCell = screen.getByTestId('price-cell-room-1-2026-03-11');
        const endCell = screen.getByTestId('price-cell-room-1-2026-03-12');

        fireEvent.mouseDown(startCell, { button: 0 });
        fireEvent.mouseEnter(endCell);
        fireEvent.mouseUp(window);

        await waitFor(() => {
            expect(screen.getByText(/Aplicar preço em 2 dias/i)).toBeInTheDocument();
        });

        fireEvent.change(screen.getByRole('spinbutton', { name: 'Preço para aplicar em lote' }), { target: { value: '499' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

        await waitFor(() => {
            expect(ratePayload).toEqual({
                roomTypeId: 'room-1',
                startDate: '2026-03-11',
                endDate: '2026-03-12',
                updates: {
                    price: 499,
                },
                daysOfWeek: [3, 4],
            });
        });
    }, 30000);

    it('permite arrasto horizontal em CTA e aplica a mesma ação no intervalo', async () => {
        const entries = [
            {
                date: '2026-03-11',
                price: 350,
                stopSell: false,
                cta: false,
                ctd: false,
                minLos: 1,
                rateId: 'rate-a',
                totalInventory: 8,
                capacityTotal: 8,
                bookingsCount: 0,
                available: 8,
                fourGuestInventory: 2,
                fourGuestCapacityTotal: 2,
                isAdjusted: false
            },
            {
                date: '2026-03-12',
                price: 350,
                stopSell: false,
                cta: false,
                ctd: false,
                minLos: 1,
                rateId: 'rate-b',
                totalInventory: 8,
                capacityTotal: 8,
                bookingsCount: 0,
                available: 8,
                fourGuestInventory: 2,
                fourGuestCapacityTotal: 2,
                isAdjusted: false
            }
        ];
        let ratePayload: Record<string, unknown> | null = null;

        mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url =
                typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.toString()
                        : input.url;

            if (url.includes('/api/rooms')) {
                return createJsonResponse([{ id: 'room-1', name: 'Apartamento Teste', basePrice: 100, inventoryFor4Guests: 2 }]);
            }
            if (url.includes('/api/admin/calendar')) {
                return createJsonResponse(entries);
            }
            if (url.includes('/api/rates/bulk') && init?.method === 'POST') {
                ratePayload = JSON.parse(String(init.body));
                return createJsonResponse({ success: true });
            }
            return createJsonResponse([], true, 200);
        });

        render(<MapaPage />);

        await waitFor(() => {
            expect(screen.getByText('Mapa de Tarifas')).toBeInTheDocument();
        });

        const startCell = screen.getByTestId('cta-cell-room-1-2026-03-11');
        const endCell = screen.getByTestId('cta-cell-room-1-2026-03-12');

        fireEvent.mouseDown(startCell, { button: 0 });
        fireEvent.mouseEnter(endCell);
        fireEvent.mouseUp(window);

        await waitFor(() => {
            expect(screen.getByText(/Aplicar bloqueio de entrada em 2 dias/i)).toBeInTheDocument();
        });

        fireEvent.change(screen.getByRole('combobox', { name: 'Valor de CTA para aplicar em lote' }), { target: { value: 'true' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

        await waitFor(() => {
            expect(ratePayload).toEqual({
                roomTypeId: 'room-1',
                startDate: '2026-03-11',
                endDate: '2026-03-12',
                updates: {
                    cta: true,
                },
                daysOfWeek: [3, 4],
            });
        });
    }, 30000);
});
