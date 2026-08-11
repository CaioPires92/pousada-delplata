import prisma from "@/lib/prisma";
import { publishBookingCheckoutConfirmed } from "@/lib/crm/bookingLifecycle";
import { schedulePostStaySatisfaction } from "@/lib/crm/postStayJourney";
import { createCouponGrantForStay } from "@/lib/crm/couponGrant";

const CHECKOUT_ELIGIBLE_STATUSES = ["CONFIRMED", "PAID"];

export async function confirmBookingCheckout(input: {
  bookingId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, status: true, checkOut: true, checkoutConfirmedAt: true },
  });

  if (!booking) return { ok: false as const, reason: "booking_not_found" as const };
  if (!CHECKOUT_ELIGIBLE_STATUSES.includes(booking.status)) {
    return { ok: false as const, reason: "booking_not_confirmed" as const };
  }
  if (booking.checkOut.getTime() > now.getTime()) {
    return { ok: false as const, reason: "checkout_not_due" as const };
  }

  const confirmationAt = booking.checkoutConfirmedAt ?? now;
  const update = booking.checkoutConfirmedAt
    ? { count: 0 }
    : await prisma.booking.updateMany({
        where: { id: booking.id, checkoutConfirmedAt: null },
        data: { checkoutConfirmedAt: confirmationAt },
      });
  const lifecycle = await publishBookingCheckoutConfirmed({
    bookingId: booking.id,
    checkoutAt: confirmationAt,
  });

  if (!lifecycle.ok) {
    return { ok: false as const, reason: "checkout_event_failed" as const };
  }
  const postStay = await schedulePostStaySatisfaction({
    bookingId: booking.id,
    checkoutConfirmedAt: confirmationAt,
  });
  const couponGrant = await createCouponGrantForStay(booking.id);
  return {
    ok: true as const,
    newlyConfirmed: update.count === 1,
    duplicate: lifecycle.duplicate,
    checkoutConfirmedAt: confirmationAt,
    postStay,
    couponGrant,
  };
}
