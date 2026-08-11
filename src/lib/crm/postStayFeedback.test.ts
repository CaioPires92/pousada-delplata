import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: { conversation: { update: vi.fn() } } }));
vi.mock("@/lib/crm/automationHandoff", () => ({ executeAutomationHandoff: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));

import prisma from "@/lib/prisma";
import { executeAutomationHandoff } from "@/lib/crm/automationHandoff";
import { recordCrmEvent } from "@/lib/crm/events";
import { classifyPostStayFeedback, processPostStayFeedback } from "./postStayFeedback";

const conversation = {
  id: "conversation-1",
  contactId: "contact-1",
  currentFlow: "post_stay",
  flowStep: "waiting_satisfaction",
  flowDataJson: '{"bookingId":"booking-1"}',
};

describe("post-stay feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordCrmEvent).mockResolvedValue({ id: "event-1" } as never);
  });

  it.each([
    ["Foi excelente, adorei!", "positive"],
    ["Foi ok", "neutral"],
    ["O quarto estava sujo e foi ruim", "problem"],
    ["Tenho algumas observações", "unknown"],
  ] as const)("classifies %s as %s", (message, expected) => {
    expect(classifyPostStayFeedback(message)).toBe(expected);
  });

  it("marks positive feedback as eligible for the review journey", async () => {
    const now = new Date("2026-08-11T18:10:00.000Z");
    await expect(processPostStayFeedback({ conversation, phone: "5519999999999", message: "Adorei", now }))
      .resolves.toMatchObject({ handled: true, classification: "positive" });
    expect(prisma.conversation.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        flowStep: "feedback_classified",
        flowDataJson: expect.stringContaining('"reviewEligible":true'),
      }),
    }));
  });

  it("opens human service for a problem and prevents automatic progression", async () => {
    vi.mocked(executeAutomationHandoff).mockResolvedValue("handoff");
    await expect(processPostStayFeedback({
      conversation,
      phone: "5519999999999",
      message: "Tive um problema com barulho",
    })).resolves.toMatchObject({ handled: true, classification: "problem", response: "handoff" });
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "PostStayIssueDetected",
      bookingId: "booking-1",
    }));
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it("uses human fallback for an ambiguous answer", async () => {
    await processPostStayFeedback({
      conversation,
      phone: "5519999999999",
      message: "Tenho algumas observações",
    });
    expect(executeAutomationHandoff).toHaveBeenCalledWith(expect.objectContaining({
      decision: expect.objectContaining({ reason: "low_confidence" }),
    }));
  });
});
