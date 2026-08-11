import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { randomInt } from "crypto";
import { encryptCouponCode } from "@/lib/coupons/code-vault";
import { getCouponCodePrefix, hashCouponCode, normalizeGuestEmail, normalizeGuestPhone } from "@/lib/coupons/hash";
import { getDiscountPolicy } from "@/lib/discount-policy-store";
import { buildTrackedCouponUrl } from "@/lib/coupons/booking-link";

const COUPON_PERCENTAGE = 10;
const COUPON_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateReturnCouponCode() {
  let suffix = "";
  for (let index = 0; index < 10; index += 1) suffix += COUPON_ALPHABET[randomInt(COUPON_ALPHABET.length)];
  return `VOLTE10-${suffix}`;
}

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

export async function issueCouponForGrant(grantId: string, now = new Date()) {
  const policy = await getDiscountPolicy();
  const endsAt = new Date(now.getTime() + policy.validityDays * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReturnCouponCode();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const grant = await tx.couponGrant.findUnique({
          where: { id: grantId },
          include: { contact: { select: { email: true, phone: true } }, coupon: true },
        });
        if (!grant) return { issued: false as const, reason: "grant_not_found" as const };
        if (grant.coupon) return { issued: false as const, reason: "already_issued" as const, grant, coupon: grant.coupon };

        const bindEmail = normalizeGuestEmail(grant.contact.email) || null;
        const bindPhone = normalizeGuestPhone(grant.contact.phone) || null;
        if (!bindEmail && !bindPhone) {
          return { issued: false as const, reason: "missing_guest_identity" as const, grant };
        }

        const coupon = await tx.coupon.create({
          data: {
            name: "Retorno Delplata 10%",
            codeHash: hashCouponCode(code),
            codePrefix: getCouponCodePrefix(code),
            codeCiphertext: encryptCouponCode(code),
            type: "PERCENT",
            value: COUPON_PERCENTAGE,
            maxDiscountAmount: policy.maximumDiscountAmount,
            minBookingValue: policy.minimumBookingValue,
            active: true,
            startsAt: now,
            endsAt,
            maxGlobalUses: 1,
            maxUsesPerGuest: 1,
            bindEmail,
            bindPhone,
            originBookingId: grant.bookingId,
            allowedRoomTypeIds: "[]",
            allowedSources: JSON.stringify(["direct"]),
            singleUse: true,
            stackable: false,
          },
        });
        const updatedGrant = await tx.couponGrant.update({
          where: { id: grant.id },
          data: { couponId: coupon.id, status: "ISSUED", issuedAt: now },
        });
        return {
          issued: true as const,
          reason: null,
          grant: updatedGrant,
          coupon,
          code,
          bookingUrl: buildTrackedCouponUrl(grant.id),
        };
      });

      if (result.issued) {
        await recordCrmEvent({
          action: "CouponIssued",
          bookingId: result.grant.bookingId,
          contactId: result.grant.contactId,
          metadata: { grantId: result.grant.id, couponId: result.coupon.id, percentage: COUPON_PERCENTAGE },
        });
      }
      return result;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002" || attempt === 4) throw error;
    }
  }
  throw new Error("coupon_code_generation_failed");
}

export async function markCouponGrantSent(grantId: string, sentAt = new Date()) {
  const grant = await prisma.couponGrant.findUnique({ where: { id: grantId } });
  if (!grant) return { updated: false as const, reason: "grant_not_found" as const };
  const updated = await prisma.couponGrant.updateMany({
    where: { id: grantId, sentAt: null },
    data: {
      sentAt,
      status: grant.redeemedAt ? "REDEEMED" : grant.clickedAt ? "CLICKED" : "SENT",
    },
  });
  if (updated.count === 1) {
    await recordCrmEvent({
      action: "CouponSent",
      bookingId: grant.bookingId,
      contactId: grant.contactId,
      metadata: { grantId, couponId: grant.couponId },
    });
  }
  return { updated: updated.count === 1, reason: updated.count === 1 ? null : "already_sent" as const };
}

export async function markCouponGrantRedeemed(couponId: string, redeemedAt = new Date()) {
  const grant = await prisma.couponGrant.findUnique({ where: { couponId } });
  if (!grant) return { updated: false as const, reason: "grant_not_found" as const };
  const updated = await prisma.couponGrant.updateMany({
    where: { id: grant.id, redeemedAt: null },
    data: { redeemedAt, status: "REDEEMED" },
  });
  if (updated.count === 1) {
    await recordCrmEvent({
      action: "CouponRedeemed",
      bookingId: grant.bookingId,
      contactId: grant.contactId,
      metadata: { grantId: grant.id, couponId },
    });
  }
  return { updated: updated.count === 1, reason: updated.count === 1 ? null : "already_redeemed" as const };
}
