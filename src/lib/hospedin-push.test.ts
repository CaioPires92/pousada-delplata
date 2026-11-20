import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import prisma from '@/lib/prisma';
import { hospedinV3 } from '@/lib/hospedin';
import { syncHospedinAvailability } from '@/lib/hospedin-sync';
import {
  buildHospedinBookingInput,
  cancelBookingInHospedin,
  getHospedinPushConfig,
  mapPaymentMethod,
  pushBookingToHospedin,
  reconcileBookingsWithHospedin,
} from './hospedin-push';

vi.mock('next/server', () => ({ after: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  default: {
    booking: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/hospedin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hospedin')>('@/lib/hospedin');
  return {
    HospedinApiError: actual.HospedinApiError,
    isHospedinV3Configured: () => true,
    hospedinV3: {
      getAccountSettings: vi.fn(),
      listRoomIds: vi.fn(),
      isRoomFree: vi.fn(),
      createGuest: vi.fn(),
      createBooking: vi.fn(),
      cancelBooking: vi.fn(),
      addPayment: vi.fn(),
    },
  };
});

vi.mock('@/lib/hospedin-sync', () => ({ syncHospedinAvailability: vi.fn() }));

const config = { since: new Date('2026-11-20T00:00:00Z'), saleChannelId: 222289, fourGuestPlaceIds: [] as number[] };

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abcdef12-0000-0000-0000-000000000000',
    status: 'CONFIRMED',
    createdAt: new Date('2026-11-21T10:00:00Z'),
    checkIn: new Date('2099-12-24T00:00:00Z'),
    checkOut: new Date('2099-12-27T00:00:00Z'),
    adults: 2,
    childrenAges: '[4,8]',
    pets: 1,
    totalPrice: 1500,
    appliedCouponCode: null,
    hospedinReservationId: null,
    hospedinRegisteredAt: null,
    guest: { name: 'Maria Teste', email: 'Maria@Example.com', phone: '11999990000' },
    roomType: { id: 'room-1', name: 'Chalé', externalId: '49047' },
    payment: { amount: 750, remainingAmount: 750, method: 'pix', provider: 'mercadopago', status: 'APPROVED' },
    ...overrides,
  };
}

describe('hospedin push (API v3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('HOSPEDIN_SYNC_ENABLED', 'true');
    (prisma.booking.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.booking.update as any).mockResolvedValue({});
    (hospedinV3.getAccountSettings as any).mockResolvedValue({
      pricing_field: 'total_daily_cents',
      default_account_transaction_id: 2079,
      default_reservation_transaction_category: 22412,
    });
    (hospedinV3.listRoomIds as any).mockResolvedValue([20205, 20204]);
    (hospedinV3.isRoomFree as any).mockImplementation(async (placeId: number) => placeId === 20204);
    (hospedinV3.createGuest as any).mockResolvedValue(55);
    (hospedinV3.createBooking as any).mockResolvedValue({ id: 'r_9001', units: [{ unit_id: 9001, place_id: 20204, place_type_id: 49047 }] });
    (hospedinV3.addPayment as any).mockResolvedValue('p_1');
    (hospedinV3.cancelBooking as any).mockResolvedValue(undefined);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('stays off unless enabled with a cutoff date and a sales channel', () => {
    vi.stubEnv('HOSPEDIN_PUSH_ENABLED', 'true');
    vi.stubEnv('HOSPEDIN_PUSH_SINCE', '');
    vi.stubEnv('HOSPEDIN_SITE_SALE_CHANNEL_ID', '222289');
    expect(getHospedinPushConfig()).toBeNull();

    vi.stubEnv('HOSPEDIN_PUSH_SINCE', '2026-11-20');
    vi.stubEnv('HOSPEDIN_FOUR_GUEST_PLACE_IDS', '20205, 20176');
    expect(getHospedinPushConfig()).toEqual({ since: new Date('2026-11-20'), saleChannelId: 222289, fourGuestPlaceIds: [20205, 20176] });

    vi.stubEnv('HOSPEDIN_PUSH_ENABLED', 'false');
    expect(getHospedinPushConfig()).toBeNull();
  });

  it('maps guests and sends only the price field the account uses', () => {
    const input = buildHospedinBookingInput(makeBooking() as any, {
      saleChannelId: 222289, guestId: 55, placeId: 20204, pricingField: 'total_daily_cents',
    });
    expect(input).toMatchObject({
      check_in: '2099-12-24',
      check_out: '2099-12-27',
      sale_channel_id: 222289,
      guest_id: 55,
      units: [{ place_id: 20204, status: 'reservation', adults: 2, children: 1, children_ages: [8], exempt: 1, total_daily_cents: 150000 }],
    });
    expect(input.units[0]).not.toHaveProperty('daily_cents');
    expect(input.note).toContain('RESERVA FEITA PELO SITE');
    expect(input.note).toContain('Código no site: ABCDEF12');
    expect(input.note).toContain('Quarto reservado: Chalé');
    expect(input.note).toContain('24/12/2099 a 27/12/2099 (3 noites)');
    expect(input.note).toContain('Telefone: 11999990000');
    expect(input.note).toContain('idades: 4, 8');
    expect(input.note).toContain('Pets: 1');
    expect(input.note).toContain('SALDO A RECEBER');

    const daily = buildHospedinBookingInput(makeBooking() as any, { saleChannelId: 1, guestId: 1, placeId: 1, pricingField: 'daily_cents' });
    expect(daily.units[0]).toMatchObject({ daily_cents: 50000 });
    expect(daily.units[0]).not.toHaveProperty('total_daily_cents');
  });

  it('maps site payment methods to Hospedin ones', () => {
    expect(mapPaymentMethod('pix')).toBe('pix');
    expect(mapPaymentMethod('debit_card')).toBe('debit_card');
    expect(mapPaymentMethod('master')).toBe('credit_card');
    expect(mapPaymentMethod(null)).toBe('credit_card');
  });

  it('picks a free room, creates guest + booking + payment, stores the id and resyncs', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking());

    const result = await pushBookingToHospedin('b1', config);

    expect(result).toEqual({ status: 'pushed', hospedinReservationId: 'r_9001' });
    expect(hospedinV3.listRoomIds).toHaveBeenCalledWith(49047);
    expect(hospedinV3.createGuest).toHaveBeenCalledWith({
      name: 'SITE - Maria Teste', email: 'maria@example.com', contact_attributes: { ddi: 'BR', phone: '11999990000' },
    });
    expect((hospedinV3.createBooking as any).mock.calls[0][0].units[0].place_id).toBe(20204);
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: { hospedinReservationId: 'r_9001', hospedinRegisteredAt: expect.any(Date) },
    });
    expect(hospedinV3.addPayment).toHaveBeenCalledWith('r_9001', expect.objectContaining({
      payment_method: 'pix', account_transaction_id: 2079, transaction_category_id: 22412, price_cents: 75000, status: true,
    }));
    expect(syncHospedinAvailability).toHaveBeenCalledWith({ roomTypeId: 'room-1', beginDate: '2099-12-24', endDate: '2099-12-27' });
  });

  it('only looks for rooms of the booked type, even for 4-guest rooms of another type', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking({ adults: 4, childrenAges: '[]' }));
    (hospedinV3.isRoomFree as any).mockResolvedValue(true);
    // 20181 (Térreo 6) recebe 4, mas a reserva é de Chalé: nunca pode ir para lá.
    await pushBookingToHospedin('b1', { ...config, fourGuestPlaceIds: [20181] });
    expect(hospedinV3.listRoomIds).toHaveBeenCalledWith(49047);
    expect((hospedinV3.isRoomFree as any).mock.calls.map((call: any[]) => call[0])).not.toContain(20181);
    expect((hospedinV3.createBooking as any).mock.calls[0][0].units[0].place_id).toBe(20205);
  });

  it('cancels at once and fails if Hospedin puts the booking in another room type', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking());
    (hospedinV3.createBooking as any).mockResolvedValue({ id: 'r_bad', units: [{ unit_id: 1, place_id: 20181, place_type_id: 3020 }] });

    const result = await pushBookingToHospedin('b1', config);

    expect(result).toEqual({ status: 'failed', error: 'hospedin_room_type_mismatch:r_bad' });
    expect(hospedinV3.cancelBooking).toHaveBeenCalledWith('r_bad');
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('tries the 4-guest rooms first for 4-guest bookings', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking({ adults: 4, childrenAges: '[]' }));
    (hospedinV3.isRoomFree as any).mockResolvedValue(true);
    await pushBookingToHospedin('b1', { ...config, fourGuestPlaceIds: [20204] });
    expect((hospedinV3.isRoomFree as any).mock.calls[0][0]).toBe(20204);
    expect((hospedinV3.createBooking as any).mock.calls[0][0].units[0].place_id).toBe(20204);
  });

  it('fails and releases the lock when no room is free (overbooking to check by hand)', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking());
    (hospedinV3.isRoomFree as any).mockResolvedValue(false);

    expect(await pushBookingToHospedin('b1', config)).toEqual({ status: 'failed', error: 'no_free_room_in_hospedin' });
    expect(hospedinV3.createBooking).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).toHaveBeenLastCalledWith({
      where: { id: expect.any(String), hospedinReservationId: { startsWith: 'pending:' } },
      data: { hospedinReservationId: null },
    });
  });

  it('keeps the booking registered when only the payment entry fails', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking());
    (hospedinV3.addPayment as any).mockRejectedValue(new Error('422'));
    expect(await pushBookingToHospedin('b1', config)).toEqual({ status: 'pushed', hospedinReservationId: 'r_9001' });
  });

  it('does not post a payment that is not approved', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking({ payment: null }));
    await pushBookingToHospedin('b1', config);
    expect(hospedinV3.addPayment).not.toHaveBeenCalled();
  });

  it('does not push bookings created before the cutoff (already typed in by hand)', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking({ createdAt: new Date('2026-11-01T00:00:00Z') }));
    expect(await pushBookingToHospedin('b1', config)).toEqual({ status: 'skipped', reason: 'before_cutoff' });
    expect(hospedinV3.createBooking).not.toHaveBeenCalled();
  });

  it('does not push twice when another run holds the lock', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking());
    (prisma.booking.updateMany as any).mockResolvedValue({ count: 0 });
    expect(await pushBookingToHospedin('b1', config)).toEqual({ status: 'skipped', reason: 'already_sent' });
    expect(hospedinV3.listRoomIds).not.toHaveBeenCalled();
  });

  it('skips pending, already-sent and in-flight bookings', async () => {
    (prisma.booking.findUnique as any).mockResolvedValueOnce(makeBooking({ status: 'PENDING' }));
    expect(await pushBookingToHospedin('b1', config)).toEqual({ status: 'skipped', reason: 'not_confirmed' });
    (prisma.booking.findUnique as any).mockResolvedValueOnce(makeBooking({ hospedinRegisteredAt: new Date() }));
    expect(await pushBookingToHospedin('b1', config)).toEqual({ status: 'skipped', reason: 'already_sent' });
    (prisma.booking.findUnique as any).mockResolvedValueOnce(makeBooking({ hospedinReservationId: 'pending:x' }));
    expect(await pushBookingToHospedin('b1', config)).toEqual({ status: 'skipped', reason: 'already_sent' });
    expect(hospedinV3.createBooking).not.toHaveBeenCalled();
  });

  it('creates a new reservation when one cancelled in Hospedin is confirmed again on the site', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(makeBooking({ hospedinReservationId: 'r_old' }));
    expect(await pushBookingToHospedin('b1', config)).toEqual({ status: 'pushed', hospedinReservationId: 'r_9001' });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: expect.any(String), hospedinReservationId: 'r_old', hospedinRegisteredAt: null },
      data: { hospedinReservationId: expect.stringMatching(/^pending:/) },
    });
  });

  it('cancels in Hospedin and clears hospedinRegisteredAt (keeps the id)', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(
      makeBooking({ status: 'CANCELLED', hospedinReservationId: 'r_9001', hospedinRegisteredAt: new Date() }),
    );
    expect(await cancelBookingInHospedin('b1', config)).toEqual({ status: 'pushed', hospedinReservationId: 'r_9001' });
    expect(hospedinV3.cancelBooking).toHaveBeenCalledWith('r_9001');
    expect(prisma.booking.update).toHaveBeenCalledWith({ where: { id: expect.any(String) }, data: { hospedinRegisteredAt: null } });
  });

  it('keeps the booking marked when the cancellation fails', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(
      makeBooking({ status: 'EXPIRED', hospedinReservationId: 'r_9001', hospedinRegisteredAt: new Date() }),
    );
    (hospedinV3.cancelBooking as any).mockRejectedValue(new Error('422'));
    expect(await cancelBookingInHospedin('b1', config)).toMatchObject({ status: 'failed' });
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('reconcile does nothing when disabled', async () => {
    vi.stubEnv('HOSPEDIN_PUSH_ENABLED', 'false');
    expect(await reconcileBookingsWithHospedin()).toEqual({ enabled: false });
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('reconcile pushes, cancels and reports stuck locks without resyncing per booking', async () => {
    vi.stubEnv('HOSPEDIN_PUSH_ENABLED', 'true');
    vi.stubEnv('HOSPEDIN_PUSH_SINCE', '2026-11-20');
    vi.stubEnv('HOSPEDIN_SITE_SALE_CHANNEL_ID', '222289');
    (prisma.booking.findMany as any)
      .mockResolvedValueOnce([{ id: 'push-1' }])
      .mockResolvedValueOnce([{ id: 'cancel-1' }])
      .mockResolvedValueOnce([{ id: 'stuck-1' }]);
    (prisma.booking.findUnique as any)
      .mockResolvedValueOnce(makeBooking({ id: 'push-1' }))
      .mockResolvedValueOnce(makeBooking({ id: 'cancel-1', status: 'CANCELLED', hospedinReservationId: 'r_77', hospedinRegisteredAt: new Date() }));

    const result = await reconcileBookingsWithHospedin();

    expect(result).toMatchObject({
      enabled: true,
      pushed: [{ bookingId: 'push-1', status: 'pushed' }],
      cancelled: [{ bookingId: 'cancel-1', status: 'pushed' }],
      stuck: ['stuck-1'],
    });
    expect(syncHospedinAvailability).not.toHaveBeenCalled();
  });
});
