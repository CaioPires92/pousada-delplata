import { addDays, format } from 'date-fns';

import prisma from '@/lib/prisma';
import { hospedinV3, isHospedinV3Configured } from '@/lib/hospedin';
import { getEffectiveGuestCounts, requiresFourGuestInventory } from '@/lib/guest-capacity';
import { occupyingBookingWhere } from '@/lib/booking-payment-window';
import { eachDayKeyInclusive, nextDayKey, prevDayKey } from '@/lib/day-key';

/**
 * Estoque de 4 hóspedes calculado pelo Hospedin (API v3), quarto a quarto.
 *
 * Os quartos que cabem 4 ficam em `HOSPEDIN_FOUR_GUEST_PLACE_IDS` (ids de UH). Para cada noite:
 *
 *   estoque de 4 = quartos de 4 livres no Hospedin + reservas de 4 do site já lançadas no Hospedin
 *
 * A soma das reservas já lançadas existe porque a cotação e a reserva (`quote-service`,
 * `api/bookings`) continuam subtraindo TODAS as reservas de 4 ativas do site. Como o Hospedin
 * já desconta as lançadas, sem essa soma elas seriam descontadas duas vezes. Resultado final na
 * cotação: quartos de 4 livres no Hospedin − reservas de 4 do site ainda não lançadas.
 *
 * Desligado por padrão: só grava com `HOSPEDIN_FOUR_GUEST_SYNC_ENABLED=true`. Sem isso, o cron só
 * calcula (simulação) quando recebe `?fourGuest=dry`. Quando ligado, substitui o ajuste manual de
 * 4 hóspedes do mapa para os tipos de quarto que têm quartos de 4 configurados.
 */

export function isFourGuestSyncEnabled() {
  return process.env.HOSPEDIN_FOUR_GUEST_SYNC_ENABLED === 'true';
}

export function parseFourGuestPlaceIds(raw: string | undefined = process.env.HOSPEDIN_FOUR_GUEST_PLACE_IDS) {
  return String(raw || '')
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function computeFourGuestUnits(input: {
  dayKeys: string[];
  /** Quartos de 4 livres no Hospedin por noite; noite ausente = desconhecida (não grava). */
  freeRoomsByDay: Map<string, number>;
  /** Reservas de 4 do site já lançadas no Hospedin por noite. */
  registeredBookingsByDay: Map<string, number>;
  capacity: number;
}) {
  const units = new Map<string, number>();
  for (const dayKey of input.dayKeys) {
    const free = input.freeRoomsByDay.get(dayKey);
    if (free === undefined) continue;
    const registered = input.registeredBookingsByDay.get(dayKey) ?? 0;
    units.set(dayKey, Math.max(0, Math.min(input.capacity, free + registered)));
  }
  return units;
}

export type FourGuestSyncOptions = { beginDate: string; endDate: string; dryRun?: boolean };

export type FourGuestSyncResult =
  | { skipped: string }
  | {
      dryRun: boolean;
      results: Array<{
        roomName: string;
        fourGuestRooms: number;
        capacityBefore: number;
        daysComputed: number;
        daysChanged: number;
        /** Primeiras noites calculadas, para conferir com o painel do Hospedin. */
        sample: Array<{ date: string; units: number }>;
      }>;
      warnings: string[];
    };

export async function syncFourGuestInventory(options: FourGuestSyncOptions): Promise<FourGuestSyncResult> {
  const placeIds = parseFourGuestPlaceIds();
  if (placeIds.length === 0) return { skipped: 'HOSPEDIN_FOUR_GUEST_PLACE_IDS vazio' };
  if (!isHospedinV3Configured()) throw new Error('Credenciais da API v3 do Hospedin ausentes.');

  const dryRun = Boolean(options.dryRun);
  const warnings: string[] = [];
  const checkOutExclusive = nextDayKey(options.endDate);
  const dayKeys = eachDayKeyInclusive(options.beginDate, options.endDate);

  const [rooms, roomTypes] = await Promise.all([
    hospedinV3.listRooms(),
    prisma.roomType.findMany({ where: { externalId: { not: null }, NOT: { externalId: '' } } }),
  ]);
  const placeTypeByRoom = new Map(rooms.map((room) => [room.id, room.placeTypeId]));

  // Agrupa os quartos de 4 pelo tipo de quarto do site (externalId = categoria do Hospedin).
  const placesByRoomType = new Map<string, number[]>();
  for (const placeId of placeIds) {
    const placeTypeId = placeTypeByRoom.get(placeId);
    const roomType = placeTypeId === undefined ? undefined : roomTypes.find((type) => String(type.externalId) === String(placeTypeId));
    if (!roomType) {
      warnings.push(`UH ${placeId} não está ativa no Hospedin ou sua categoria não existe no site; ignorada.`);
      continue;
    }
    placesByRoomType.set(roomType.id, [...(placesByRoomType.get(roomType.id) ?? []), placeId]);
  }

  const results: Array<Extract<FourGuestSyncResult, { results: unknown }>['results'][number]> = [];

  for (const [roomTypeId, typePlaceIds] of placesByRoomType) {
    const roomType = roomTypes.find((type) => type.id === roomTypeId)!;

    // Livres por noite: só conta a noite se TODAS as UHs de 4 do tipo informaram; senão é desconhecida.
    const freeByDay = new Map<string, number>();
    const reportedByDay = new Map<string, number>();
    for (const placeId of typePlaceIds) {
      const nights = await hospedinV3.getRoomAvailability(placeId, options.beginDate, checkOutExclusive);
      for (const night of nights) {
        reportedByDay.set(night.date, (reportedByDay.get(night.date) ?? 0) + 1);
        if (night.availability >= 1) freeByDay.set(night.date, (freeByDay.get(night.date) ?? 0) + 1);
      }
    }
    const freeRoomsByDay = new Map<string, number>();
    for (const [dayKey, reported] of reportedByDay) {
      if (reported === typePlaceIds.length) freeRoomsByDay.set(dayKey, freeByDay.get(dayKey) ?? 0);
    }

    // Reservas de 4 do site que já estão no Hospedin (já descontadas lá).
    const registeredBookings = await prisma.booking.findMany({
      where: {
        roomTypeId,
        hospedinRegisteredAt: { not: null },
        checkIn: { lt: new Date(`${checkOutExclusive}T00:00:00Z`) },
        checkOut: { gt: new Date(`${options.beginDate}T00:00:00Z`) },
        AND: [occupyingBookingWhere()],
      },
      select: { checkIn: true, checkOut: true, adults: true, childrenAges: true },
    });
    const registeredByDay = new Map<string, number>();
    for (const booking of registeredBookings) {
      const guests = getEffectiveGuestCounts({ adults: booking.adults, childrenAges: booking.childrenAges });
      if (!requiresFourGuestInventory(guests.effectiveGuests)) continue;
      const first = booking.checkIn.toISOString().slice(0, 10);
      const last = prevDayKey(booking.checkOut.toISOString().slice(0, 10));
      if (first > last) continue;
      for (const dayKey of eachDayKeyInclusive(first, last)) {
        registeredByDay.set(dayKey, (registeredByDay.get(dayKey) ?? 0) + 1);
      }
    }

    // A capacidade de 4 do tipo passa a ser a quantidade de quartos de 4 configurados.
    const capacity = Math.max(0, Math.min(Number(roomType.totalUnits || 1), typePlaceIds.length));
    const units = computeFourGuestUnits({ dayKeys, freeRoomsByDay, registeredBookingsByDay: registeredByDay, capacity });

    const existing = await prisma.fourGuestInventoryAdjustment.findMany({
      where: { roomTypeId, dateKey: { in: [...units.keys()] } },
    });
    const existingByDay = new Map(existing.map((row) => [row.dateKey, row.totalUnits]));
    const changed = [...units].filter(([dayKey, value]) => existingByDay.get(dayKey) !== value);

    if (!dryRun) {
      if (Number(roomType.inventoryFor4Guests) !== capacity) {
        await prisma.roomType.update({ where: { id: roomTypeId }, data: { inventoryFor4Guests: capacity } });
      }
      for (const [dayKey, value] of changed) {
        await prisma.fourGuestInventoryAdjustment.upsert({
          where: { roomTypeId_dateKey: { roomTypeId, dateKey: dayKey } },
          update: { totalUnits: value, date: new Date(`${dayKey}T00:00:00Z`) },
          create: { roomTypeId, dateKey: dayKey, date: new Date(`${dayKey}T00:00:00Z`), totalUnits: value },
        });
      }
    }

    results.push({
      roomName: roomType.name,
      fourGuestRooms: typePlaceIds.length,
      capacityBefore: Number(roomType.inventoryFor4Guests),
      daysComputed: units.size,
      daysChanged: changed.length,
      sample: [...units].slice(0, 7).map(([date, value]) => ({ date, units: value })),
    });
  }

  return { dryRun, results, warnings };
}

export function getDefaultFourGuestPeriod(days = 120) {
  const today = new Date();
  return { beginDate: format(today, 'yyyy-MM-dd'), endDate: format(addDays(today, days), 'yyyy-MM-dd') };
}
