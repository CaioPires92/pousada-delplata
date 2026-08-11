import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    internalActionLog: { findMany: vi.fn() },
    supervisedReplySuggestion: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { evaluateAutoReplyRolloutGate } from "./rolloutGate";

function shadow(agreement: boolean, actionAuthorized = false) {
  return { metadataJson: JSON.stringify({ mode: "shadow", agreementWithHeuristic: agreement, actionAuthorized }) };
}

describe("automatic reply rollout gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE;
    delete process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS;
  });

  it("blocks rollout without enough real evidence", async () => {
    vi.mocked(prisma.internalActionLog.findMany).mockResolvedValue([shadow(true)] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(0);

    await expect(evaluateAutoReplyRolloutGate()).resolves.toMatchObject({
      approved: false,
      reasons: expect.arrayContaining([
        "insufficient_shadow_sample",
        "insufficient_supervised_reviews",
      ]),
    });
  });

  it("blocks any action authorized during shadow mode", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "2";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "1";
    vi.mocked(prisma.internalActionLog.findMany).mockResolvedValue([
      shadow(true),
      shadow(true, true),
    ] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(1);

    await expect(evaluateAutoReplyRolloutGate()).resolves.toMatchObject({
      approved: false,
      reasons: ["shadow_action_was_authorized"],
    });
  });

  it("approves sufficient shadow agreement and supervised reviews", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "5";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "2";
    vi.mocked(prisma.internalActionLog.findMany).mockResolvedValue([
      shadow(true), shadow(true), shadow(true), shadow(true), shadow(false),
    ] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(2);

    await expect(evaluateAutoReplyRolloutGate()).resolves.toEqual({
      approved: true,
      reasons: [],
      metrics: {
        shadowSample: 5,
        shadowAgreementRate: 0.8,
        shadowAuthorizedActions: 0,
        supervisedReviewed: 2,
      },
    });
  });
});
