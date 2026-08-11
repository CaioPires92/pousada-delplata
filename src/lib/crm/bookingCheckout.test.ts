import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { booking: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/crm/bookingLifecycle", () => ({ publishBookingCheckoutConfirmed: vi.fn() }));

import prisma from "@/lib/prisma";
import { publishBookingCheckoutConfirmed } from "@/lib/crm/bookingLifecycle";
import { confirmBookingCheckout } from "./bookingCheckout";

describe("confirmBookingCheckout", () => {
  const now = new Date("2026-08-11T15:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(publishBookingCheckoutConfirmed).mockResolvedValue({
      ok: true,
      duplicate: false,
      pipelineUpdated: false,
      pipelineError: null,
      pipelineCardId: null,
    });
  });

  it("persists checkout confirmation and emits the authoritative event", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-1",
      status: "CONFIRMED",
      checkOut: new Date("2026-08-11T12:00:00.000Z"),
      checkoutConfirmedAt: null,
    } as never);
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 1 });

    await expect(confirmBookingCheckout({ bookingId: "booking-1", now })).resolves.toMatchObject({
      ok: true,
      newlyConfirmed: true,
      checkoutConfirmedAt: now,
    });
    expect(publishBookingCheckoutConfirmed).toHaveBeenCalledWith({ bookingId: "booking-1", checkoutAt: now });
  });

  it("replays the stable event safely when checkout was already confirmed", async () => {
    const confirmedAt = new Date("2026-08-11T14:00:00.000Z");
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-1",
      status: "PAID",
      checkOut: new Date("2026-08-11T12:00:00.000Z"),
      checkoutConfirmedAt: confirmedAt,
    } as never);
    vi.mocked(publishBookingCheckoutConfirmed).mockResolvedValue({
      ok: true,
      duplicate: true,
      pipelineUpdated: false,
    });

    await expect(confirmBookingCheckout({ bookingId: "booking-1", now })).resolves.toMatchObject({
      ok: true,
      newlyConfirmed: false,
      duplicate: true,
      checkoutConfirmedAt: confirmedAt,
    });
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("does not infer checkout before the scheduled departure", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-1",
      status: "CONFIRMED",
      checkOut: new Date("2026-08-12T12:00:00.000Z"),
      checkoutConfirmedAt: null,
    } as never);

    await expect(confirmBookingCheckout({ bookingId: "booking-1", now }))
      .resolves.toEqual({ ok: false, reason: "checkout_not_due" });
    expect(publishBookingCheckoutConfirmed).not.toHaveBeenCalled();
  });
});
