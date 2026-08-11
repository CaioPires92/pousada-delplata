import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";

export async function createCouponGrantForStay(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, crmContactId: true, crmConversationId: true, checkoutConfirmedAt: true },
  });
  if (!booking) return { created: false as const, reason: "booking_not_found" as const };
  if (!booking.checkoutConfirmedAt) return { created: false as const, reason: "checkout_not_confirmed" as const };
  if (!booking.crmContactId) return { created: false as const, reason: "missing_contact_link" as const };

  const existing = await prisma.couponGrant.findUnique({ where: { bookingId: booking.id } });
  if (existing) return { created: false as const, reason: "already_granted" as const, grant: existing };

  const grant = await prisma.couponGrant.create({
    data: { bookingId: booking.id, contactId: booking.crmContactId, status: "PENDING" },
  });
  await recordCrmEvent({
    action: "CouponGrantCreated",
    bookingId: booking.id,
    contactId: booking.crmContactId,
    conversationId: booking.crmConversationId ?? undefined,
    metadata: { grantId: grant.id, status: grant.status },
  });
  return { created: true as const, reason: null, grant };
}
