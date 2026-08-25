import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    automationQueueJob: { findMany: vi.fn(), count: vi.fn() },
    conversation: { findUnique: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() },
  },
}));
vi.mock("@/lib/crm/automationQueue", () => ({ processNextAutomationJobForConversation: vi.fn() }));
vi.mock("@/lib/crm/logger", () => ({ crmLog: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));
vi.mock("@/lib/crm/followUpCadence", () => ({
  getFollowUpCadenceSettings: vi.fn().mockResolvedValue({
    enabled: true,
    cadenceHours: [2, 24, 72],
    quietHoursStart: 20,
    quietHoursEnd: 8,
  }),
}));
vi.mock("@/lib/crm/n8nDelivery", () => ({ deliverN8nEvent: vi.fn() }));
vi.mock("@/lib/messaging/provider-factory", () => ({ createMessagingProvider: vi.fn() }));
vi.mock("@/lib/crm/couponGrant", () => ({ markCouponGrantSent: vi.fn() }));

import prisma from "@/lib/prisma";
import { processNextAutomationJobForConversation } from "@/lib/crm/automationQueue";
import { deliverN8nEvent } from "@/lib/crm/n8nDelivery";
import { createMessagingProvider } from "@/lib/messaging/provider-factory";
import { runAutomationQueueWorker } from "./automationQueueWorker";
import { markCouponGrantSent } from "./couponGrant";

describe("automation queue worker n8n delivery", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.mocked(prisma.automationQueueJob.findMany).mockResolvedValue([{ conversationId: "conversation-1" }] as never);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({ id: "conversation-1", contactId: "contact-1" } as never);
    vi.mocked(deliverN8nEvent).mockResolvedValue({ delivered: true, attempts: 1, status: 200 });
    vi.mocked(prisma.automationQueueJob.count).mockResolvedValue(0);
  });

  it("delivers n8n jobs without invoking the WhatsApp provider", async () => {
    vi.mocked(processNextAutomationJobForConversation).mockImplementation(async (_conversationId, runner) => {
      await runner({
        id: "job-1",
        action: "EMIT_N8N_EVENT",
        createdAt: new Date("2026-08-05T18:29:00.000Z"),
        payload: {
          event: {
            schemaVersion: 1,
            eventId: "event-1",
            eventType: "LeadCreated",
            occurredAt: "2026-08-05T18:30:00.000Z",
            entityId: "conversation-1",
            correlationId: "conversation-1",
            causationId: "event-1",
            resources: { conversationId: "conversation-1" },
            data: { source: "whatsapp" },
          },
        },
      });
      return { ok: true, queued: false, processed: true, jobId: "job-1" };
    });

    await expect(runAutomationQueueWorker()).resolves.toMatchObject({ processed: 1, failed: 0 });
    expect(deliverN8nEvent).toHaveBeenCalledOnce();
    expect(createMessagingProvider).not.toHaveBeenCalled();
  });

  it("cancels a claimed WhatsApp send when a human has paused automation", async () => {
    vi.mocked(prisma.conversation.findUnique)
      .mockResolvedValueOnce({ id: "conversation-1", contactId: "contact-1" } as never)
      .mockResolvedValueOnce({
        chatbotEnabled: true,
        automationMode: "auto",
        automationPausedUntil: new Date("2099-08-06T12:00:00.000Z"),
      } as never);
    vi.mocked(processNextAutomationJobForConversation).mockImplementation(async (_conversationId, runner) => {
      const result = await runner({
        id: "job-send-1",
        action: "SEND_WHATSAPP_MESSAGE",
        createdAt: new Date("2026-08-11T12:00:00.000Z"),
        payload: { target: "5511999999999", text: "Resposta automática" },
      });
      expect(result).toEqual({
        cancelled: true,
        reason: "human_takeover_or_automation_paused",
      });
      return { ok: true, queued: false, processed: false, cancelled: true, jobId: "job-send-1" };
    });

    await expect(runAutomationQueueWorker()).resolves.toMatchObject({ processed: 0, failed: 0 });
    expect(createMessagingProvider).not.toHaveBeenCalled();
  });

  it("cancels a previously claimed send when the contact opts out", async () => {
    vi.mocked(prisma.conversation.findUnique)
      .mockResolvedValueOnce({ id: "conversation-1", contactId: "contact-1" } as never)
      .mockResolvedValueOnce({
        chatbotEnabled: true,
        automationMode: "auto",
        automationPausedUntil: null,
        contact: { optOutAt: new Date("2026-08-10T18:00:00.000Z") },
      } as never);
    vi.mocked(processNextAutomationJobForConversation).mockImplementation(async (_conversationId, runner) => {
      const result = await runner({
        id: "job-send-optout",
        action: "SEND_WHATSAPP_MESSAGE",
        createdAt: new Date("2026-08-10T18:00:00.000Z"),
        payload: { target: "5511999999999", text: "Follow-up" },
      });
      expect(result).toEqual({ cancelled: true, reason: "contact_opted_out" });
      return { ok: true, queued: false, processed: false, cancelled: true, jobId: "job-send-optout" };
    });

    await expect(runAutomationQueueWorker()).resolves.toMatchObject({ processed: 0, failed: 0 });
    expect(createMessagingProvider).not.toHaveBeenCalled();
  });

  it("reschedules a proactive job claimed during quiet hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T01:30:00.000Z"));
    vi.mocked(processNextAutomationJobForConversation).mockImplementation(async (_conversationId, runner) => {
      const result = await runner({
        id: "job-quiet",
        action: "SEND_WHATSAPP_MESSAGE",
        journeyType: "commercial_followup",
        createdAt: new Date("2026-08-11T01:00:00.000Z"),
        payload: { target: "5511999999999", text: "Follow-up" },
      });
      expect(result).toMatchObject({
        rescheduled: true,
        reason: "quiet_hours",
        scheduledAt: new Date("2026-08-11T11:00:00.000Z"),
      });
      return { ok: true, queued: true, processed: false, rescheduled: true, jobId: "job-quiet" };
    });

    await expect(runAutomationQueueWorker()).resolves.toMatchObject({ processed: 0, failed: 0 });
    expect(createMessagingProvider).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("records delivery after the provider accepts a coupon message", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T15:00:00.000Z"));
    vi.mocked(prisma.conversation.findUnique)
      .mockResolvedValueOnce({ id: "conversation-1", contactId: "contact-1" } as never)
      .mockResolvedValueOnce({
        chatbotEnabled: true,
        automationMode: "auto",
        automationPausedUntil: null,
        contact: { optOutAt: null },
      } as never);
    vi.mocked(createMessagingProvider).mockReturnValue({
      name: "evolution",
      send: vi.fn().mockResolvedValue({ externalMessageId: "wa-1", acceptedAt: new Date(), status: "accepted" }),
    } as never);
    vi.mocked(prisma.message.create).mockResolvedValue({ id: "message-1", externalMessageId: "wa-1" } as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);
    vi.mocked(markCouponGrantSent).mockResolvedValue({ updated: true, reason: null });
    vi.mocked(processNextAutomationJobForConversation).mockImplementation(async (_conversationId, runner) => {
      await runner({
        id: "job-coupon",
        action: "SEND_WHATSAPP_MESSAGE",
        journeyType: "post_stay",
        createdAt: new Date("2026-08-11T14:30:00.000Z"),
        payload: {
          target: "5511999999999",
          text: "Seu cupom",
          postStayStep: "coupon",
          couponGrantId: "grant-1",
        },
      });
      return { ok: true, queued: false, processed: true, jobId: "job-coupon" };
    });

    await runAutomationQueueWorker();
    expect(markCouponGrantSent).toHaveBeenCalledWith("grant-1", expect.any(Date));
  });
});
