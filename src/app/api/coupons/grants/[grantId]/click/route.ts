import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptCouponCode } from "@/lib/coupons/code-vault";
import { buildPreappliedCouponUrl, verifyCouponClickToken } from "@/lib/coupons/booking-link";
import { recordCrmEvent } from "@/lib/crm/events";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await context.params;
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token || !verifyCouponClickToken(grantId, token)) {
    return NextResponse.json({ error: "invalid_coupon_link" }, { status: 404 });
  }
  const grant = await prisma.couponGrant.findUnique({
    where: { id: grantId },
    include: { coupon: true },
  });
  const code = decryptCouponCode(grant?.coupon?.codeCiphertext);
  if (!grant || !code || !grant.coupon?.active || (grant.coupon.endsAt && grant.coupon.endsAt < new Date())) {
    return NextResponse.json({ error: "coupon_unavailable" }, { status: 410 });
  }

  const clickedAt = new Date();
  const updated = await prisma.couponGrant.updateMany({
    where: { id: grant.id, clickedAt: null },
    data: { clickedAt, status: grant.redeemedAt ? "REDEEMED" : "CLICKED" },
  });
  if (updated.count === 1) {
    await recordCrmEvent({
      action: "CouponClicked",
      bookingId: grant.bookingId,
      contactId: grant.contactId,
      metadata: { grantId: grant.id, couponId: grant.couponId },
    });
  }
  return NextResponse.redirect(buildPreappliedCouponUrl(code), { status: 302 });
}
