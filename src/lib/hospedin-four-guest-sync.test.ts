import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    roomTypeFindMany: vi.fn(),
    roomTypeUpdate: vi.fn(),
    bookingFindMany: vi.fn(),
    adjFindMany: vi.fn(),
    adjUpsert: vi.fn(),
    listRooms: vi.fn(),
    getRoomAvailability: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        roomType: { findMany: mocks.roomTypeFindMany, update: mocks.roomTypeUpdate },
        booking: { findMany: mocks.bookingFindMany },
        fourGuestInventoryAdjustment: { findMany: mocks.adjFindMany, upsert: mocks.adjUpsert },
    },
}));
vi.mock('@/lib/hospedin', () => ({
    hospedinV3: { listRooms: mocks.listRooms, getRoomAvailability: mocks.getRoomAvailability },
    isHospedinV3Configured: () => true,
}));

import { computeFourGuestUnits, parseFourGuestPlaceIds, syncFourGuestInventory } from './hospedin-four-guest-sync';

describe('computeFourGuestUnits', () => {
    it('soma quartos de 4 livres e reservas de 4 já lançadas, limitado à capacidade', () => {
        const units = computeFourGuestUnits({
            dayKeys: ['2026-12-10', '2026-12-11', '2026-12-12'],
            freeRoomsByDay: new Map([['2026-12-10', 2], ['2026-12-11', 1]]),
            registeredBookingsByDay: new Map([['2026-12-11', 1]]),
            capacity: 2,
        });
        expect(units.get('2026-12-10')).toBe(2);
        expect(units.get('2026-12-11')).toBe(2); // 1 livre + 1 já lançada (a cotação ainda a subtrai)
        expect(units.has('2026-12-12')).toBe(false); // noite desconhecida não grava
    });

    it('nunca passa da capacidade nem fica negativo', () => {
        const units = computeFourGuestUnits({
            dayKeys: ['2026-12-10'],
            freeRoomsByDay: new Map([['2026-12-10', 5]]),
            registeredBookingsByDay: new Map(),
            capacity: 2,
        });
        expect(units.get('2026-12-10')).toBe(2);
    });
});

describe('parseFourGuestPlaceIds', () => {
    it('lê ids separados por vírgula e ignora lixo', () => {
        expect(parseFourGuestPlaceIds('20181, 20183,abc,,0')).toEqual([20181, 20183]);
        expect(parseFourGuestPlaceIds('')).toEqual([]);
    });
});

describe('syncFourGuestInventory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.HOSPEDIN_FOUR_GUEST_PLACE_IDS = '20181,20183,99999';
        mocks.roomTypeFindMany.mockResolvedValue([{ id: 'terreo', name: 'Apartamento Térreo', externalId: '100', totalUnits: 6, inventoryFor4Guests: 0 }]);
        mocks.listRooms.mockResolvedValue([
            { id: 20181, placeTypeId: 100 },
            { id: 20183, placeTypeId: 100 },
        ]);
        mocks.getRoomAvailability.mockImplementation(async (placeId: number) =>
            placeId === 20181
                ? [{ date: '2026-12-10', availability: 1 }, { date: '2026-12-11', availability: 1 }]
                : [{ date: '2026-12-10', availability: 1 }, { date: '2026-12-11', availability: 0 }],
        );
        // reserva de 4 do site já lançada no Hospedin na noite de 11/12
        mocks.bookingFindMany.mockResolvedValue([
            { checkIn: new Date('2026-12-11T00:00:00Z'), checkOut: new Date('2026-12-12T00:00:00Z'), adults: 4, childrenAges: null },
            { checkIn: new Date('2026-12-10T00:00:00Z'), checkOut: new Date('2026-12-11T00:00:00Z'), adults: 2, childrenAges: null }, // 2 hóspedes: não conta
        ]);
        mocks.adjFindMany.mockResolvedValue([]);
    });

    it('simulação calcula e NÃO grava nada', async () => {
        const result = await syncFourGuestInventory({ beginDate: '2026-12-10', endDate: '2026-12-11', dryRun: true });
        if ('skipped' in result) throw new Error('não era para pular');
        expect(result.dryRun).toBe(true);
        expect(result.results[0]).toMatchObject({ roomName: 'Apartamento Térreo', fourGuestRooms: 2, capacityBefore: 0, daysComputed: 2, daysChanged: 2 });
        expect(result.results[0].sample).toEqual([
            { date: '2026-12-10', units: 2 },
            { date: '2026-12-11', units: 2 }, // 1 livre + 1 reserva de 4 já lançada
        ]);
        expect(result.warnings.some((warning) => warning.includes('99999'))).toBe(true);
        expect(mocks.adjUpsert).not.toHaveBeenCalled();
        expect(mocks.roomTypeUpdate).not.toHaveBeenCalled();
    });

    it('ligado, grava os dias que mudaram e ajusta a capacidade de 4 do tipo', async () => {
        mocks.adjFindMany.mockResolvedValue([{ dateKey: '2026-12-10', totalUnits: 2 }]); // este não mudou
        await syncFourGuestInventory({ beginDate: '2026-12-10', endDate: '2026-12-11', dryRun: false });
        expect(mocks.roomTypeUpdate).toHaveBeenCalledWith({ where: { id: 'terreo' }, data: { inventoryFor4Guests: 2 } });
        expect(mocks.adjUpsert).toHaveBeenCalledTimes(1);
        expect(mocks.adjUpsert.mock.calls[0][0].create).toMatchObject({ roomTypeId: 'terreo', dateKey: '2026-12-11', totalUnits: 2 });
    });

    it('sem ids de quartos de 4 configurados, não faz nada', async () => {
        process.env.HOSPEDIN_FOUR_GUEST_PLACE_IDS = '';
        expect(await syncFourGuestInventory({ beginDate: '2026-12-10', endDate: '2026-12-11' })).toEqual({ skipped: 'HOSPEDIN_FOUR_GUEST_PLACE_IDS vazio' });
        expect(mocks.listRooms).not.toHaveBeenCalled();
    });

    it('noite que uma das UHs de 4 não informou fica sem gravar', async () => {
        mocks.getRoomAvailability.mockImplementation(async (placeId: number) =>
            placeId === 20181 ? [{ date: '2026-12-10', availability: 1 }, { date: '2026-12-11', availability: 1 }] : [{ date: '2026-12-10', availability: 1 }],
        );
        const result = await syncFourGuestInventory({ beginDate: '2026-12-10', endDate: '2026-12-11', dryRun: true });
        if ('skipped' in result) throw new Error('não era para pular');
        expect(result.results[0].daysComputed).toBe(1);
    });
});
