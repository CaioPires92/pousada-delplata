import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: { booking: { findUnique: vi.fn() } } }));
vi.mock("@/lib/crm/automationQueue", () => ({ enqueueAutomationJob: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));
vi.mock("@/lib/whatsapp/evolution", () => ({ resolveEvolutionSendTarget: vi.fn() }));
vi.mock("@/lib/crm/postStaySettings", () => ({ getPostStaySettings: vi.fn() }));
vi.mock("@/lib/discount-policy-store", () => ({ getDiscountPolicy: vi.fn() }));

import prisma from "@/lib/prisma";
import { enqueueAutomationJob } from "@/lib/crm/automationQueue";
import { recordCrmEvent } from "@/lib/crm/events";
import { resolveEvolutionSendTarget } from "@/lib/whatsapp/evolution";
import { getPostStaySettings } from "./postStaySettings";
import { getDiscountPolicy } from "@/lib/discount-policy-store";
import { schedulePostStayCouponDelivery, schedulePostStayReviewRequest, schedulePostStaySatisfaction } from "./postStayJourney";

describe("schedulePostStaySatisfaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveEvolutionSendTarget).mockReturnValue("5519999999999");
    vi.mocked(enqueueAutomationJob).mockResolvedValue({ id: "job-1" } as never);
    vi.mocked(recordCrmEvent).mockResolvedValue({ id: "event-1" } as never);
    vi.mocked(getPostStaySettings).mockResolvedValue({
      officialReviewUrl: "https://example.com/review",
      reviewConfigured: true,
    });
    vi.mocked(getDiscountPolicy).mockResolvedValue({
      sendEnabled: true,
      percentage: 10,
      validityDays: 90,
      minimumBookingValue: null,
      maximumDiscountAmount: null,
      blockedDateRanges: [],
    });
  });

  it("schedules one satisfaction question three hours after confirmed checkout", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      crmContactId: "contact-1",
      crmConversationId: "conversation-1",
      crmContact: {
        phone: "5519999999999",
        phoneRaw: null,
        whatsappJid: null,
        optInWhatsapp: true,
        optOutAt: null,
      },
    } as never);
    const checkoutConfirmedAt = new Date("2026-08-11T15:00:00.000Z");

    await expect(schedulePostStaySatisfaction({ bookingId: "booking-1", checkoutConfirmedAt }))
      .resolves.toMatchObject({ scheduled: true, scheduledAt: new Date("2026-08-11T18:00:00.000Z") });
    expect(enqueueAutomationJob).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conversation-1",
      journeyType: "post_stay",
      dedupeKey: "post-stay:booking-1:satisfaction",
      scheduledAt: new Date("2026-08-11T18:00:00.000Z"),
      payload: expect.objectContaining({ bookingId: "booking-1", postStayStep: "satisfaction" }),
    }));
  });

  it("does not schedule without WhatsApp consent", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      crmContactId: "contact-1",
      crmConversationId: "conversation-1",
      crmContact: { optInWhatsapp: false, optOutAt: null },
    } as never);

    await expect(schedulePostStaySatisfaction({
      bookingId: "booking-1",
      checkoutConfirmedAt: new Date(),
    })).resolves.toEqual({ scheduled: false, reason: "whatsapp_consent_missing" });
    expect(enqueueAutomationJob).not.toHaveBeenCalled();
  });

  it("schedules the review request 24 hours after checkout with a stable key", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      crmContactId: "contact-1",
      crmConversationId: "conversation-1",
      crmContact: { phone: "5519999999999", optInWhatsapp: true, optOutAt: null },
    } as never);
    const checkoutConfirmedAt = new Date("2026-08-11T15:00:00.000Z");
    await schedulePostStayReviewRequest({ bookingId: "booking-1", checkoutConfirmedAt });
    expect(enqueueAutomationJob).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: "post-stay:booking-1:review",
      scheduledAt: new Date("2026-08-12T15:00:00.000Z"),
      payload: expect.objectContaining({ postStayStep: "review" }),
    }));
  });

  it("does not schedule a review without the approved URL", async () => {
    vi.mocked(getPostStaySettings).mockResolvedValue({ officialReviewUrl: null, reviewConfigured: false });
    await expect(schedulePostStayReviewRequest({
      bookingId: "booking-1",
      checkoutConfirmedAt: new Date(),
    })).resolves.toEqual({ scheduled: false, reason: "review_url_not_configured" });
    expect(enqueueAutomationJob).not.toHaveBeenCalled();
  });

  it("schedules the individual coupon independently from review feedback", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      crmContactId: "contact-1",
      crmConversationId: "conversation-1",
      crmContact: { phone: "5519999999999", optInWhatsapp: true, optOutAt: null },
    } as never);
    const checkoutConfirmedAt = new Date("2026-08-11T15:00:00.000Z");
    await schedulePostStayCouponDelivery({
      bookingId: "booking-1",
      checkoutConfirmedAt,
      couponCode: "VOLTE10-ABC1234567",
      bookingUrl: "https://pousadadelplata.com.br/reservar?promo=VOLTE10-ABC1234567",
      expiresAt: new Date("2026-11-09T15:00:00.000Z"),
    });
    expect(enqueueAutomationJob).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: "post-stay:booking-1:coupon",
      scheduledAt: new Date("2026-08-12T15:00:00.000Z"),
      payload: expect.objectContaining({
        postStayStep: "coupon",
        text: expect.stringContaining("VOLTE10-ABC1234567"),
      }),
    }));
  });

  it("respects the configured coupon sending switch", async () => {
    vi.mocked(getDiscountPolicy).mockResolvedValue({
      sendEnabled: false,
      percentage: 10,
      validityDays: 90,
      minimumBookingValue: null,
      maximumDiscountAmount: null,
      blockedDateRanges: [],
    });
    await expect(schedulePostStayCouponDelivery({
      bookingId: "booking-1",
      checkoutConfirmedAt: new Date(),
      couponCode: "VOLTE10-ABC1234567",
      bookingUrl: "https://pousadadelplata.com.br/reservar?promo=VOLTE10-ABC1234567",
      expiresAt: null,
    })).resolves.toEqual({ scheduled: false, reason: "coupon_send_disabled" });
    expect(enqueueAutomationJob).not.toHaveBeenCalled();
  });
});
