import { after, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { calculateBookingPrice } from '@/lib/booking-price';
import { roomAcceptsPets } from '@/lib/pet-policy';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/email-validation';
import { parseLocalDate } from '@/lib/date-utils';
import { hashCouponCode, normalizeCouponCode, normalizeGuestEmail } from '@/lib/coupons/hash';
import { compareDayKey } from '@/lib/day-key';
import { getEffectiveGuestCounts, requiresFourGuestInventory } from '@/lib/guest-capacity';
import { runPendingBookingMaintenanceThrottled } from '@/lib/expire-stale-bookings';
import {
    getBookingAccessCookieName,
    getBookingAccessCookieOptions,
    signBookingAccessToken,
} from '@/lib/booking-access';
import { consumeRequestLimit, isHoneypotFilled, readJsonBody, RequestGuardError } from '@/lib/request-guard';
import { isMobileRequest } from '@/lib/device';
import { resolveBestPromotion, todayDayKey } from '@/lib/promotions/engine';
import { loadActivePromotionRules } from '@/lib/promotions/store';
import { probeCouponFromRecord, resolveStayPricing, type CouponProbe } from '@/lib/promotions/stacking';
import { getPaymentWindowMinutes, MIN_CHECKOUT_MINUTES, occupyingBookingWhere } from '@/lib/booking-payment-window';

export async function POST(request: Request) {
    try {
        const body = await readJsonBody<any>(request, 32 * 1024);
        if (isHoneypotFilled(body)) {
            return NextResponse.json({ error: 'request_rejected' }, { status: 400 });
        }
        const { roomTypeId, checkIn, checkOut, guest, adults, childrenAges } = body;
        const adultsCount = Math.max(1, Number.parseInt(String(adults ?? 1), 10) || 1);
        const childrenCount = Math.max(0, Number.parseInt(String(body?.children ?? 0), 10) || 0);
        const petsCount = Number.parseInt(String(body?.pets ?? 0), 10);

        if (!Number.isInteger(petsCount) || petsCount < 0 || petsCount > 10) {
            return NextResponse.json({ error: 'invalid_pet_count' }, { status: 400 });
        }

        if (!roomTypeId || !checkIn || !checkOut || !guest || !guest.email) {
            return NextResponse.json({
                error: 'required_fields_missing',
                message: 'Preencha os dados obrigatorios do hospede e da estadia antes de continuar.',
            }, { status: 400 });
        }

        const normalizedGuestEmail = normalizeGuestEmail(guest.email);
        if (!normalizedGuestEmail || !isValidEmail(normalizedGuestEmail)) {
            return NextResponse.json({ error: 'guest_email_invalid', message: INVALID_EMAIL_MESSAGE }, { status: 400 });
        }

        const rateLimit = consumeRequestLimit({
            request, scope: 'booking', discriminator: normalizedGuestEmail, limit: 8, windowMs: 15 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json({
                error: 'too_many_attempts',
                message: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
            }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } });
        }

        const agesArrayInput = Array.isArray(childrenAges)
            ? childrenAges
                .map((age) => Number.parseInt(String(age), 10))
                .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17)
            : [];
        const requestedGuestCounts = getEffectiveGuestCounts({
            adults: adultsCount,
            childrenAges: agesArrayInput,
        });
        const serializedChildrenAges = agesArrayInput.length > 0 ? JSON.stringify(agesArrayInput) : null;

        const couponReservationId =
            typeof body?.coupon?.reservationId === 'string' ? body.coupon.reservationId.trim() : '';
        const couponCode = typeof body?.coupon?.code === 'string' ? body.coupon.code : '';

        let reusedPendingBooking = false;
        const booking = await prisma.$transaction(async (tx) => {
            const roomType = await tx.roomType.findUnique({
                where: { id: roomTypeId },
                include: {
                    rates: {
                        where: {
                            startDate: { lte: new Date(`${checkOut}T00:00:00Z`) },
                            endDate: { gte: new Date(`${checkIn}T00:00:00Z`) },
                        },
                    },
                },
            });

            if (!roomType) return null;
            if (petsCount > 0 && !roomAcceptsPets(roomType.name)) {
                throw new Error('pets_not_allowed');
            }

            const nightKeys = eachDayKeyInclusive(checkIn, prevDayKey(checkOut));
            const activeBookings = await tx.booking.findMany({
                where: {
                    roomTypeId,
                    checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
                    checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
                    hospedinRegisteredAt: null,
                    // O próprio hóspede refazendo a reserva não pode ser barrado pela pendente dele.
                    AND: [
                        occupyingBookingWhere(),
                        { NOT: { status: 'PENDING', guest: { email: normalizedGuestEmail } } },
                    ],
                },
                select: {
                    checkIn: true,
                    checkOut: true,
                    adults: true,
                    childrenAges: true,
                },
            });
            const adjustments = await tx.inventoryAdjustment.findMany({
                where: { roomTypeId, dateKey: { in: nightKeys } },
            });
            const fourGuestAdjustments = await tx.fourGuestInventoryAdjustment.findMany({
                where: { roomTypeId, dateKey: { in: nightKeys } },
            });

            let baseTotalForStay = 0;
            const nightBaseAmounts: number[] = [];
            let requiredMinLos = 1;
            for (const night of nightKeys) {
                const rate = roomType.rates.find(r => {
                    const rStart = r.startDate.toISOString().split('T')[0];
                    const rEnd = r.endDate.toISOString().split('T')[0];
                    return night >= rStart && night <= rEnd;
                });
                const nightBaseAmount = rate ? Number(rate.price) : Number(roomType.basePrice);
                nightBaseAmounts.push(nightBaseAmount);
                baseTotalForStay += nightBaseAmount;
                const dayMinLos = rate ? Number(rate.minLos) : 1;
                if (dayMinLos > requiredMinLos) requiredMinLos = dayMinLos;
            }

            if (nightKeys.length < requiredMinLos) {
                throw new Error(`min_stay_required:${requiredMinLos}`);
            }

            const bookingsCountByDay = new Map<string, number>();
            const bookingsFor4GuestsByDay = new Map<string, number>();
            const firstNight = nightKeys[0];
            const lastNight = nightKeys[nightKeys.length - 1];

            for (const booking of activeBookings) {
                const bookingStart = booking.checkIn.toISOString().split('T')[0];
                const bookingEndExclusive = booking.checkOut.toISOString().split('T')[0];
                const bookingEndInclusive = prevDayKey(bookingEndExclusive);
                const bookingGuestCounts = getEffectiveGuestCounts({
                    adults: booking.adults,
                    childrenAges: booking.childrenAges,
                });
                const usesFourGuestInventory = requiresFourGuestInventory(bookingGuestCounts.effectiveGuests);

                const rangeStart = compareDayKey(bookingStart, firstNight) < 0 ? firstNight : bookingStart;
                const rangeEnd = compareDayKey(bookingEndInclusive, lastNight) > 0 ? lastNight : bookingEndInclusive;
                if (compareDayKey(rangeStart, rangeEnd) > 0) continue;

                for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                    bookingsCountByDay.set(dayKey, (bookingsCountByDay.get(dayKey) || 0) + 1);
                    if (usesFourGuestInventory) {
                        bookingsFor4GuestsByDay.set(dayKey, (bookingsFor4GuestsByDay.get(dayKey) || 0) + 1);
                    }
                }
            }

            const adjustmentByDay = new Map(adjustments.map((adj) => [adj.dateKey, adj.totalUnits]));
            const fourGuestAdjustmentByDay = new Map(fourGuestAdjustments.map((adj) => [adj.dateKey, adj.totalUnits]));
            const capacityTotal = Number(roomType.totalUnits || 1);
            const inventoryFor4Guests = Math.max(
                0,
                Math.min(capacityTotal, Number((roomType as { inventoryFor4Guests?: number | null }).inventoryFor4Guests || 0))
            );
            const effectiveSellableUnits = nightKeys.reduce((min, dayKey) => {
                const adjustedValue = adjustmentByDay.has(dayKey)
                    ? Number(adjustmentByDay.get(dayKey))
                    : null;
                const bookingsCount = bookingsCountByDay.get(dayKey) || 0;
                const dayTotalUnits = adjustedValue !== null
                    ? Math.max(0, Math.min(capacityTotal, adjustedValue))
                    : capacityTotal;
                const daySellableUnits = Math.max(0, dayTotalUnits - bookingsCount);

                return Math.min(min, daySellableUnits);
            }, Number.POSITIVE_INFINITY);

            if (!Number.isFinite(effectiveSellableUnits) || effectiveSellableUnits <= 0) {
                throw new Error('room_unavailable');
            }

            if (requiresFourGuestInventory(requestedGuestCounts.effectiveGuests)) {
                const effectiveSellableUnitsFor4Guests = nightKeys.reduce((min, dayKey) => {
                const bookedFor4Guests = bookingsFor4GuestsByDay.get(dayKey) || 0;
                const adjustedFor4Guests = fourGuestAdjustmentByDay.has(dayKey)
                    ? Number(fourGuestAdjustmentByDay.get(dayKey))
                    : null;
                const remainingUnitsFor4Guests = adjustedFor4Guests !== null
                        ? Math.max(0, Math.min(inventoryFor4Guests, adjustedFor4Guests) - bookedFor4Guests)
                        : Math.max(0, inventoryFor4Guests - bookedFor4Guests);
                return Math.min(min, remainingUnitsFor4Guests);
            }, Number.POSITIVE_INFINITY);

                if (!Number.isFinite(effectiveSellableUnitsFor4Guests) || effectiveSellableUnitsFor4Guests <= 0) {
                    throw new Error('room_unavailable');
                }
            }

            const breakdown = calculateBookingPrice({
                nights: nightKeys.length,
                baseTotalForStay: baseTotalForStay,
                adults: adultsCount,
                childrenAges: agesArrayInput,
                includedAdults: Number(roomType.includedAdults),
                maxGuests: Number(roomType.maxGuests),
                extraAdultFee: Number(roomType.extraAdultFee),
                child6To11Fee: Number(roomType.child6To11Fee),
                pets: petsCount,
            });

            let guestRecord = await tx.guest.findFirst({
                where: { email: normalizedGuestEmail }
            });

            if (guestRecord) {
                guestRecord = await tx.guest.update({
                    where: { id: guestRecord.id },
                    data: { name: guest.name, phone: guest.phone }
                });
            } else {
                guestRecord = await tx.guest.create({
                    data: { name: guest.name, email: normalizedGuestEmail, phone: guest.phone }
                });
            }

            // subtotalPrice = preço cheio (sem nenhum desconto); descontos são gravados separadamente.
            const subtotalPrice = Number(breakdown.total);
            let discountAmount = 0;
            let appliedCouponCode: string | null = null;
            let couponApplied = false;
            let couponProbe: ((subtotal: number) => CouponProbe) | null = null;
            let reservedCouponDiscount = 0;
            let normalizedCouponCode = '';
            const now = new Date();

            // Promoção automática: recalculada aqui no servidor, nunca confiando no valor do front.
            // Pet é taxa avulsa e fica fora da base do desconto.
            const promotionRules = await loadActivePromotionRules(tx as unknown as typeof prisma);
            const promotion = resolveBestPromotion({
                promotions: promotionRules,
                bookingDayKey: todayDayKey(now),
                checkIn,
                checkOut,
                roomTypeId,
                isMobile: isMobileRequest(request),
                eligibleAmount: breakdown.total - breakdown.petTotal,
                nightAmounts: nightKeys.map((day: string, index: number) => ({
                    day,
                    amount: nightBaseAmounts[index] + breakdown.extrasPerNight,
                })),
            });

            if (couponReservationId) {
                const reservation = await tx.couponRedemption.findUnique({
                    where: { id: couponReservationId },
                    include: { coupon: true },
                });

                if (!reservation || !reservation.coupon) {
                    throw new Error('coupon_reservation_not_found');
                }

                if (reservation.status !== 'RESERVED' || reservation.bookingId) {
                    throw new Error('coupon_reservation_unavailable');
                }

                if (reservation.expiresAt && reservation.expiresAt <= now) {
                    throw new Error('coupon_reservation_expired');
                }

                if (reservation.guestEmail && reservation.guestEmail !== normalizedGuestEmail) {
                    throw new Error('coupon_guest_mismatch');
                }

                normalizedCouponCode = normalizeCouponCode(couponCode);
                if (normalizedCouponCode) {
                    const expectedHash = hashCouponCode(normalizedCouponCode);
                    if (reservation.coupon.codeHash !== expectedHash) {
                        throw new Error('coupon_code_mismatch');
                    }
                }

                couponProbe = probeCouponFromRecord(reservation.coupon);
                reservedCouponDiscount = Number(reservation.discountAmount || 0);
            }

            // Compatibilidade promoção × cupom (mesma regra usada na busca de disponibilidade).
            const pricing = await resolveStayPricing({
                fullTotal: subtotalPrice,
                promotion,
                evaluateCoupon: couponProbe,
            });

            if (couponReservationId) {
                if (pricing.couponApplied) {
                    couponApplied = true;
                    appliedCouponCode = normalizedCouponCode || null;
                    discountAmount = Math.max(0, Math.min(pricing.couponDiscount, reservedCouponDiscount));
                } else {
                    // Cupom não acumula com a promoção escolhida (ou perdeu para ela): libera a reserva do cupom.
                    await tx.couponRedemption.updateMany({
                        where: { id: couponReservationId, status: 'RESERVED', bookingId: null },
                        data: { status: 'RELEASED', releasedAt: now },
                    });
                }
            }

            const promotionDiscount = pricing.promotionDiscount;
            const appliedPromotion = promotionDiscount > 0 ? pricing.promotion : null;
            const totalPrice = Math.max(0, Math.round((subtotalPrice - promotionDiscount - discountAmount) * 100) / 100);
            const existingPendingBooking = await tx.booking.findFirst({
                where: {
                    roomTypeId,
                    checkIn: parseLocalDate(checkIn),
                    checkOut: parseLocalDate(checkOut),
                    adults: adultsCount,
                    children: childrenCount,
                    childrenAges: serializedChildrenAges,
                    pets: petsCount,
                    totalPrice,
                    appliedCouponCode,
                    promotionId: appliedPromotion?.id ?? null,
                    status: 'PENDING',
                    // Só reaproveita se ainda der tempo de pagar.
                    OR: [
                        { paymentDeadlineAt: { gte: new Date(Date.now() + (MIN_CHECKOUT_MINUTES + 5) * 60 * 1000) } },
                        {
                            paymentDeadlineAt: null,
                            createdAt: { gte: new Date(Date.now() - Math.min(30, getPaymentWindowMinutes() - MIN_CHECKOUT_MINUTES - 5) * 60 * 1000) },
                        },
                    ],
                    guest: { email: normalizedGuestEmail },
                },
                orderBy: { createdAt: 'desc' },
                include: { guest: true, roomType: true },
            });
            if (existingPendingBooking) {
                reusedPendingBooking = true;
                return existingPendingBooking;
            }

            const bookingRecord = await tx.booking.create({
                data: {
                    roomTypeId,
                    guestId: guestRecord.id,
                    checkIn: parseLocalDate(checkIn),
                    checkOut: parseLocalDate(checkOut),
                    adults: adultsCount,
                    children: childrenCount,
                    childrenAges: serializedChildrenAges,
                    pets: petsCount,
                    subtotalPrice,
                    discountAmount,
                    appliedCouponCode,
                    promotionId: appliedPromotion?.id ?? null,
                    promotionName: appliedPromotion?.name ?? null,
                    promotionDiscount: appliedPromotion ? promotionDiscount : null,
                    promotionBreakdown: appliedPromotion ? JSON.stringify(appliedPromotion.items) : null,
                    totalPrice,
                    status: 'PENDING',
                    funnelStage: 'BOOKING_CREATED',
                    funnelUpdatedAt: new Date(),
                    lastErrorMessage: null,
                },
                include: {
                    guest: true,
                    roomType: true,
                },
            });

            if (couponReservationId && couponApplied) {
                const lock = await tx.couponRedemption.updateMany({
                    where: {
                        id: couponReservationId,
                        status: 'RESERVED',
                        bookingId: null,
                    },
                    data: {
                        bookingId: bookingRecord.id,
                        status: 'CONFIRMED',
                        confirmedAt: now,
                    },
                });

                if (lock.count !== 1) {
                    throw new Error('coupon_reservation_conflict');
                }
            }

            return bookingRecord;
        });
        if (!booking) return NextResponse.json({ error: 'Quarto não encontrado' }, { status: 404 });

        // The booking is already durable. Optional integrations must never delay or
        // change the successful reservation response.
        if (!reusedPendingBooking) after(async () => {
                // Expira reservas cujo bloqueio acabou (o cron diário é pouco frequente).
            // Sem alerta de "reserva pendente" para a equipe: o aviso sai só quando a reserva é
            // confirmada (webhook do pagamento). Abandonos aparecem no alerta de reserva expirada.
            await runPendingBookingMaintenanceThrottled('booking_created');
        });

        const response = NextResponse.json(booking, { status: reusedPendingBooking ? 200 : 201 });
        const accessToken = await signBookingAccessToken(booking.id);
        if (accessToken) {
            response.cookies.set(
                getBookingAccessCookieName(booking.id),
                accessToken,
                getBookingAccessCookieOptions(booking.id)
            );
        }
        return response;

    } catch (error: any) {
        if (error instanceof RequestGuardError) {
            return NextResponse.json({ error: error.code }, { status: error.status });
        }
        console.error('[Booking API Error]:', error);
        if (typeof error?.message === 'string' && error.message.startsWith('min_stay_required:')) {
            const minLos = error.message.split(':')[1] || '1';
            const nights = Number(minLos);
            return NextResponse.json({
                error: 'min_stay_required',
                minLos: nights,
                message: `Para esta data, a estadia minima e de ${nights} noite${nights > 1 ? 's' : ''}.`,
            }, { status: 400 });
        }
        if (typeof error?.message === 'string' && error.message.startsWith('coupon_')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error?.message === 'pets_not_allowed') {
            return NextResponse.json({
                error: 'pets_not_allowed',
                message: 'Pets sao aceitos apenas nos apartamentos terreos, chales e anexos.',
            }, { status: 400 });
        }
        if (error?.message === 'room_unavailable') {
            return NextResponse.json({
                error: 'room_unavailable',
                message: 'Essa acomodacao nao esta mais disponivel para a ocupacao selecionada. Faca uma nova busca.',
            }, { status: 409 });
        }
        return NextResponse.json(
            {
                error: 'booking_create_failed',
                message: 'Nao foi possivel salvar sua reserva. Tente novamente em instantes. Se o erro continuar, fale com a pousada pelo WhatsApp.',
            },
            { status: 500 }
        );
    }
}
