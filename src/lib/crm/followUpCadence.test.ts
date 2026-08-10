import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    followUpSettings: { findUnique: vi.fn() },
    conversation: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/crm/automationQueue", () => ({ enqueueAutomationJob: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));

import prisma from "@/lib/prisma";
import { enqueueAutomationJob } from "@/lib/crm/automationQueue";
import { recordCrmEvent } from "@/lib/crm/events";
import {
  normalizeFollowUpCadenceHours,
  parseFollowUpCadenceHours,
  scheduleCommercialFollowUpCadence,
} from "@/lib/crm/followUpCadence";

describe("commercial follow-up cadence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enqueueAutomationJob).mockResolvedValue({ id: "job-1" } as never);
    vi.mocked(recordCrmEvent).mockResolvedValue(null);
  });

  it("validates and normalizes configurable hours", () => {
    expect(normalizeFollowUpCadenceHours([72, 2, 24])).toEqual([2, 24, 72]);
    expect(normalizeFollowUpCadenceHours([2, 2])).toBeNull();
    expect(normalizeFollowUpCadenceHours([0, 24])).toBeNull();
    expect(parseFollowUpCadenceHours("invalid")).toEqual([2, 24, 72]);
  });

  it("stays disabled by default", async () => {
    vi.mocked(prisma.followUpSettings.findUnique).mockResolvedValue(null);

    await expect(scheduleCommercialFollowUpCadence({
      conversationId: "conversation-1",
      journeyId: "quote-1",
    })).resolves.toEqual({ scheduled: 0, reason: "disabled" });
    expect(enqueueAutomationJob).not.toHaveBeenCalled();
  });

  it("schedules 2h, 24h and 72h once per quote journey", async () => {
    const baseAt = new Date("2026-08-10T18:00:00.000Z");
    vi.mocked(prisma.followUpSettings.findUnique).mockResolvedValue({
      id: "global",
      enabled: true,
      cadenceHoursJson: "[2,24,72]",
    } as never);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      contactId: "contact-1",
      contact: { phone: "5519999999999", phoneRaw: null, whatsappJid: null },
    } as never);

    await expect(scheduleCommercialFollowUpCadence({
      conversationId: "conversation-1",
      journeyId: "quote-1",
      baseAt,
    })).resolves.toEqual({ scheduled: 3, reason: null });

    expect(enqueueAutomationJob).toHaveBeenCalledTimes(3);
    expect(enqueueAutomationJob).toHaveBeenNthCalledWith(1, expect.objectContaining({
      journeyType: "commercial_followup",
      dedupeKey: "commercial:conversation-1:quote-1:1",
      scheduledAt: new Date("2026-08-10T20:00:00.000Z"),
    }));
    expect(enqueueAutomationJob).toHaveBeenNthCalledWith(3, expect.objectContaining({
      dedupeKey: "commercial:conversation-1:quote-1:3",
      scheduledAt: new Date("2026-08-13T18:00:00.000Z"),
    }));
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "CommercialFollowUpCadenceScheduled",
    }));
  });
});
