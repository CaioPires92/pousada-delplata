import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    internalActionLog: { findMany: vi.fn() },
    supervisedReplySuggestion: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { evaluateAutoReplyRolloutGate } from "./rolloutGate";

function shadow(agreement: boolean, actionAuthorized = false, source = "ai", result = "classified") {
  return { metadataJson: JSON.stringify({ mode: "shadow", source, result, agreementWithHeuristic: agreement, actionAuthorized }) };
}

function review(verdict: "approved" | "rejected") {
  return { metadataJson: JSON.stringify({ verdict }) };
}

describe("automatic reply rollout gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE;
    delete process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS;
    delete process.env.CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS;
  });

  it("blocks rollout without enough real evidence", async () => {
    vi.mocked(prisma.internalActionLog.findMany)
      .mockResolvedValueOnce([shadow(true)] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(0);

    await expect(evaluateAutoReplyRolloutGate()).resolves.toMatchObject({
      approved: false,
      reasons: expect.arrayContaining([
        "insufficient_shadow_sample",
        "insufficient_supervised_reviews",
        "insufficient_human_shadow_reviews",
      ]),
    });
  });

  it("blocks any action authorized during shadow mode", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "2";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "1";
    process.env.CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS = "1";
    vi.mocked(prisma.internalActionLog.findMany)
      .mockResolvedValueOnce([shadow(true), shadow(true, true)] as never)
      .mockResolvedValueOnce([review("approved")] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(1);

    await expect(evaluateAutoReplyRolloutGate()).resolves.toMatchObject({
      approved: false,
      reasons: ["shadow_action_was_authorized"],
    });
  });

  it("approves sufficient shadow agreement and supervised reviews", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "5";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "2";
    process.env.CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS = "5";
    vi.mocked(prisma.internalActionLog.findMany)
      .mockResolvedValueOnce([shadow(true), shadow(true), shadow(true), shadow(true), shadow(false)] as never)
      .mockResolvedValueOnce([review("approved"), review("approved"), review("approved"), review("approved"), review("rejected")] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(2);

    await expect(evaluateAutoReplyRolloutGate()).resolves.toEqual({
      approved: true,
      reasons: [],
      metrics: {
        shadowSample: 5,
        shadowAgreementRate: 0.8,
        shadowAuthorizedActions: 0,
        supervisedReviewed: 2,
        humanShadowReviewed: 5,
        humanShadowApprovalRate: 0.8,
      },
    });
  });

  it("blocks rollout when human approval is below the threshold", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "2";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "1";
    process.env.CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS = "2";
    vi.mocked(prisma.internalActionLog.findMany)
      .mockResolvedValueOnce([shadow(true), shadow(true)] as never)
      .mockResolvedValueOnce([review("approved"), review("rejected")] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(1);

    await expect(evaluateAutoReplyRolloutGate()).resolves.toMatchObject({
      approved: false,
      reasons: ["human_shadow_approval_below_threshold"],
    });
  });

  it("does not count heuristic fallbacks as valid shadow evidence", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "2";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "1";
    process.env.CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS = "1";
    vi.mocked(prisma.internalActionLog.findMany)
      .mockResolvedValueOnce([
        shadow(true),
        shadow(true, false, "heuristic", "fallback_invalid_response"),
      ] as never)
      .mockResolvedValueOnce([review("approved")] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(1);

    await expect(evaluateAutoReplyRolloutGate()).resolves.toMatchObject({
      approved: false,
      reasons: expect.arrayContaining(["insufficient_shadow_sample"]),
      metrics: { shadowSample: 1 },
    });
  });
});
