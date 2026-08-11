import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import { confirmBookingCheckout } from "@/lib/crm/bookingCheckout";

export async function POST(
  _request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const { bookingId } = await context.params;
  const result = await confirmBookingCheckout({ bookingId });
  if (result.ok) return NextResponse.json(result);

  const status = result.reason === "booking_not_found"
    ? 404
    : result.reason === "checkout_event_failed"
      ? 503
      : 409;
  return NextResponse.json(result, { status });
}
