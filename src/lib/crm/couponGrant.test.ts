import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: { findUnique: vi.fn() },
    couponGrant: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { createCouponGrantForStay } from "./couponGrant";

describe("createCouponGrantForStay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordCrmEvent).mockResolvedValue({ id: "event-1" } as never);
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
