import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { asNullableString } from "@/lib/requestValue";

export async function POST(
  _request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const { bookingId } = await context.params;
  const normalizedBookingId = asNullableString(bookingId);
  if (!normalizedBookingId) {
    return NextResponse.json({ ok: false, reason: "booking_id_required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: normalizedBookingId } });
  if (!booking) return NextResponse.json({ ok: false, reason: "booking_not_found" }, { status: 404 });
  const updated = await prisma.booking.update({
    where: { id: normalizedBookingId },
    data: { checkoutConfirmedAt: new Date() },
  });
  return NextResponse.json({ ok: true, bookingId: updated.id, checkoutConfirmedAt: updated.checkoutConfirmedAt });
}
