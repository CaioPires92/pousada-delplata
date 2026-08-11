import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionClient = vi.hoisted(() => ({
  couponGrant: { findUnique: vi.fn(), update: vi.fn() },
  coupon: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: { findUnique: vi.fn() },
    couponGrant: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn((callback) => callback(transactionClient)),
  },
}));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));
vi.mock("@/lib/coupons/code-vault", () => ({ encryptCouponCode: vi.fn(() => "encrypted-code") }));
vi.mock("@/lib/discount-policy-store", () => ({
  getDiscountPolicy: vi.fn().mockResolvedValue({
    validityDays: 90,
    minimumBookingValue: null,
    maximumDiscountAmount: null,
  }),
}));

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { createCouponGrantForStay, issueCouponForGrant } from "./couponGrant";

describe("createCouponGrantForStay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordCrmEvent).mockResolvedValue({ id: "event-1" } as never);
  });

  it("issues an individual 10% coupon with single-use antifraud rules", async () => {
    transactionClient.couponGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      bookingId: "booking-1",
      contactId: "contact-1",
      coupon: null,
      contact: { email: "Guest@Example.com", phone: "5519999999999" },
    });
    transactionClient.coupon.create.mockResolvedValue({ id: "coupon-1" });
    transactionClient.couponGrant.update.mockResolvedValue({
      id: "grant-1",
      bookingId: "booking-1",
      contactId: "contact-1",
      status: "ISSUED",
    });
    const now = new Date("2026-08-11T15:00:00.000Z");

    const result = await issueCouponForGrant("grant-1", now);

    expect(result).toMatchObject({ issued: true, code: expect.stringMatching(/^VOLTE10-[A-Z2-9]{10}$/) });
    expect(transactionClient.coupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "PERCENT",
        value: 10,
        maxGlobalUses: 1,
        maxUsesPerGuest: 1,
        bindEmail: "guest@example.com",
        bindPhone: "19999999999",
        originBookingId: "booking-1",
        allowedSources: JSON.stringify(["direct"]),
        singleUse: true,
        stackable: false,
        startsAt: now,
        endsAt: new Date("2026-11-09T15:00:00.000Z"),
      }),
    });
  });

  it("does not issue an unbound coupon when the guest has no identity", async () => {
    transactionClient.couponGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      bookingId: "booking-1",
      contactId: "contact-1",
      coupon: null,
      contact: { email: null, phone: null },
    });
    await expect(issueCouponForGrant("grant-1"))
      .resolves.toMatchObject({ issued: false, reason: "missing_guest_identity" });
    expect(transactionClient.coupon.create).not.toHaveBeenCalled();
  });

  it("links one grant to the checkout booking and contact", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-1",
      crmContactId: "contact-1",
      crmConversationId: "conversation-1",
      checkoutConfirmedAt: new Date(),
    } as never);
    vi.mocked(prisma.couponGrant.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.couponGrant.create).mockResolvedValue({
      id: "grant-1",
      bookingId: "booking-1",
      contactId: "contact-1",
      status: "PENDING",
    } as never);

    await expect(createCouponGrantForStay("booking-1")).resolves.toMatchObject({ created: true });
    expect(prisma.couponGrant.create).toHaveBeenCalledWith({
      data: { bookingId: "booking-1", contactId: "contact-1", status: "PENDING" },
    });
  });

  it("returns the existing grant without issuing a second one", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-1",
      crmContactId: "contact-1",
      checkoutConfirmedAt: new Date(),
    } as never);
    vi.mocked(prisma.couponGrant.findUnique).mockResolvedValue({ id: "grant-1" } as never);
    await expect(createCouponGrantForStay("booking-1"))
      .resolves.toMatchObject({ created: false, reason: "already_granted" });
    expect(prisma.couponGrant.create).not.toHaveBeenCalled();
  });
});
