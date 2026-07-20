import { calculateBookingPrice, type BookingPriceBreakdown } from "@/lib/booking-price";
import { compareDayKey, eachDayKeyInclusive, isDayKey, prevDayKey } from "@/lib/day-key";
import { getEffectiveGuestCounts, requiresFourGuestInventory } from "@/lib/guest-capacity";
import prisma from "@/lib/prisma";

type PrismaClientLike = typeof prisma;

type NormalizedRate = {
  dayStart: string;
  dayEnd: string;
  price: number;
  minLos: number;
  stopSell: boolean;
  cta: boolean;
  ctd: boolean;
};

export type AvailabilityQuoteInput = {
  checkin: string;
  checkout: string;
  adults: number;
  childrenAges?: number[];
};

export type AvailabilityQuoteOption = {
  roomTypeId: string;
  roomTypeName: string;
  maxGuests: number;
  remainingUnits: number;
  minLos: number;
  totalPrice: number;
  priceBreakdown: BookingPriceBreakdown;
};

export type AvailabilityQuoteResult =
  | {
      ok: true;
      checkin: string;
      checkout: string;
      nights: number;
      options: AvailabilityQuoteOption[];
    }
  | {
      ok: false;
      error: "invalid_date_range" | "invalid_guest_count" | "min_stay_required";
      minLos?: number;
    };

function dateFromDayKey(dayKey: string) {
  return new Date(`${dayKey}T00:00:00Z`);
}

function normalizeRate(rate: {
  startDate: Date;
  endDate: Date;
  price: unknown;
  minLos: unknown;
  stopSell: boolean;
  cta: boolean;
  ctd: boolean;
}): NormalizedRate {
  return {
    dayStart: rate.startDate.toISOString().split("T")[0],
    dayEnd: rate.endDate.toISOString().split("T")[0],
    price: Number(rate.price),
    minLos: Number(rate.minLos ?? 1),
    stopSell: Boolean(rate.stopSell),
    cta: Boolean(rate.cta),
    ctd: Boolean(rate.ctd),
  };
}

export async function queryAvailabilityQuote(
  input: AvailabilityQuoteInput,
  client: PrismaClientLike = prisma
): Promise<AvailabilityQuoteResult> {
  if (!isDayKey(input.checkin) || !isDayKey(input.checkout) || compareDayKey(input.checkin, input.checkout) >= 0) {
    return { ok: false, error: "invalid_date_range" };
  }

  const requestedGuestCounts = getEffectiveGuestCounts({
    adults: input.adults,
    childrenAges: input.childrenAges ?? [],
  });

  if (requestedGuestCounts.effectiveAdults < 1) {
    return { ok: false, error: "invalid_guest_count" };
  }

  const nightKeys = eachDayKeyInclusive(input.checkin, prevDayKey(input.checkout));
  const nights = nightKeys.length;
  const roomTypes = await client.roomType.findMany({
    include: {
      rates: { orderBy: { createdAt: "desc" } },
    },
  });
  const ttlMinutes = Math.max(1, Number.parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || "15", 10) || 30);
  const pendingThreshold = new Date(Date.now() - ttlMinutes * 60 * 1000);
  const options: AvailabilityQuoteOption[] = [];
  let minRequiredAcrossRooms = Infinity;
  let eligibleMinLosCount = 0;

  for (const room of roomTypes) {
    const activeBookings = await client.booking.findMany({
      where: {
        roomTypeId: room.id,
        checkIn: { lt: dateFromDayKey(input.checkout) },
        checkOut: { gt: dateFromDayKey(input.checkin) },
        OR: [
          { status: { in: ["CONFIRMED", "PAID"] } },
          { status: "PENDING", createdAt: { gte: pendingThreshold } },
        ],
      },
      select: {
        checkIn: true,
        checkOut: true,
        adults: true,
        childrenAges: true,
      },
    });

    const bookingsCountByDay = new Map<string, number>();
    const bookingsFor4GuestsByDay = new Map<string, number>();
    const firstNight = nightKeys[0];
    const lastNight = nightKeys[nightKeys.length - 1];

    for (const booking of activeBookings) {
      const bookingStart = booking.checkIn.toISOString().split("T")[0];
      const bookingEndInclusive = prevDayKey(booking.checkOut.toISOString().split("T")[0]);
      const bookingGuestCounts = getEffectiveGuestCounts({
        adults: booking.adults,
        childrenAges: booking.childrenAges,
      });
      const rangeStart = compareDayKey(bookingStart, firstNight) < 0 ? firstNight : bookingStart;
      const rangeEnd = compareDayKey(bookingEndInclusive, lastNight) > 0 ? lastNight : bookingEndInclusive;

      if (compareDayKey(rangeStart, rangeEnd) > 0) continue;

      for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
        bookingsCountByDay.set(dayKey, (bookingsCountByDay.get(dayKey) || 0) + 1);
        if (requiresFourGuestInventory(bookingGuestCounts.effectiveGuests)) {
          bookingsFor4GuestsByDay.set(dayKey, (bookingsFor4GuestsByDay.get(dayKey) || 0) + 1);
        }
      }
    }

    const rates = room.rates.map(normalizeRate);
    const findRateForDay = (dayKey: string) => rates.find(rate => dayKey >= rate.dayStart && dayKey <= rate.dayEnd);

    if (nightKeys.some(dayKey => Boolean(findRateForDay(dayKey)?.stopSell))) continue;
    if (findRateForDay(input.checkin)?.cta) continue;
    if (findRateForDay(input.checkout)?.ctd) continue;

    const [adjustments, fourGuestAdjustments] = await Promise.all([
      client.inventoryAdjustment.findMany({ where: { roomTypeId: room.id, dateKey: { in: nightKeys } } }),
      client.fourGuestInventoryAdjustment.findMany({ where: { roomTypeId: room.id, dateKey: { in: nightKeys } } }),
    ]);
    const adjustmentByDay = new Map(adjustments.map(adjustment => [adjustment.dateKey, adjustment.totalUnits]));
    const fourGuestAdjustmentByDay = new Map(fourGuestAdjustments.map(adjustment => [adjustment.dateKey, adjustment.totalUnits]));
    const capacityTotal = Number(room.totalUnits || 1);
    const inventoryFor4Guests = Math.max(0, Math.min(capacityTotal, Number(room.inventoryFor4Guests || 0)));
    const remainingUnits = nightKeys.reduce((min, dayKey) => {
      const adjustedValue = adjustmentByDay.has(dayKey) ? Number(adjustmentByDay.get(dayKey)) : null;
      const dayTotalUnits = adjustedValue !== null ? Math.max(0, Math.min(capacityTotal, adjustedValue)) : capacityTotal;
      const bookedUnits = bookingsCountByDay.get(dayKey) || 0;

      return Math.min(min, Math.max(0, dayTotalUnits - bookedUnits));
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(remainingUnits) || remainingUnits <= 0) continue;

    if (requiresFourGuestInventory(requestedGuestCounts.effectiveGuests)) {
      const remainingFourGuestUnits = nightKeys.reduce((min, dayKey) => {
        const adjustedValue = fourGuestAdjustmentByDay.has(dayKey) ? Number(fourGuestAdjustmentByDay.get(dayKey)) : null;
        const dayTotalUnits = adjustedValue !== null
          ? Math.max(0, Math.min(inventoryFor4Guests, adjustedValue))
          : inventoryFor4Guests;
        const bookedUnits = bookingsFor4GuestsByDay.get(dayKey) || 0;

        return Math.min(min, Math.max(0, dayTotalUnits - bookedUnits));
      }, Number.POSITIVE_INFINITY);

      if (!Number.isFinite(remainingFourGuestUnits) || remainingFourGuestUnits <= 0) continue;
    }

    let baseTotalForStay = 0;
    let requiredMinLos = 1;
    for (const dayKey of nightKeys) {
      const rate = findRateForDay(dayKey);
      baseTotalForStay += rate ? rate.price : Number(room.basePrice);
      requiredMinLos = Math.max(requiredMinLos, rate ? rate.minLos : 1);
    }

    minRequiredAcrossRooms = Math.min(minRequiredAcrossRooms, requiredMinLos);
    if (nights < requiredMinLos) continue;
    eligibleMinLosCount += 1;

    try {
      const priceBreakdown = calculateBookingPrice({
        nights,
        baseTotalForStay,
        adults: input.adults,
        childrenAges: input.childrenAges ?? [],
        includedAdults: Number(room.includedAdults ?? 2),
        maxGuests: Number(room.maxGuests),
        extraAdultFee: Number(room.extraAdultFee || 0),
        child6To11Fee: Number(room.child6To11Fee || 0),
      });

      options.push({
        roomTypeId: room.id,
        roomTypeName: room.name,
        maxGuests: Number(room.maxGuests),
        remainingUnits,
        minLos: requiredMinLos,
        totalPrice: priceBreakdown.total,
        priceBreakdown,
      });
    } catch {
      // Ignore rooms whose pricing/capacity configuration rejects this guest mix.
    }
  }

  if (options.length === 0 && eligibleMinLosCount === 0 && Number.isFinite(minRequiredAcrossRooms)) {
    return { ok: false, error: "min_stay_required", minLos: minRequiredAcrossRooms };
  }

  return {
    ok: true,
    checkin: input.checkin,
    checkout: input.checkout,
    nights,
    options: options.sort((a, b) => a.totalPrice - b.totalPrice),
  };
}
