import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    internalActionLog: { findMany: vi.fn() },
    supervisedReplySuggestion: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { evaluateAutoReplyRolloutGate } from "./rolloutGate";

function shadow(agreement: boolean, actionAuthorized = false, source = "ai", result = "classified", id = crypto.randomUUID(), intent = "quote", suggestedAction = "collect_quote_fields") {
  return { id, metadataJson: JSON.stringify({ mode: "shadow", source, result, agreementWithHeuristic: agreement, actionAuthorized, intent, suggestedAction }) };
}

function review(verdict: "approved" | "rejected", decisionId = "decision-1") {
  return { metadataJson: JSON.stringify({ verdict, decisionId }) };
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
      .mockResolvedValueOnce([shadow(true, false, "ai", "classified", "decision-1"), shadow(true, true, "ai", "classified", "decision-2")] as never)
      .mockResolvedValueOnce([review("approved", "decision-1")] as never);
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
      .mockResolvedValueOnce([
        shadow(true, false, "ai", "classified", "decision-1"),
        shadow(true, false, "ai", "classified", "decision-2"),
        shadow(true, false, "ai", "classified", "decision-3"),
        shadow(true, false, "ai", "classified", "decision-4"),
        shadow(false, false, "ai", "classified", "decision-5"),
      ] as never)
      .mockResolvedValueOnce([
        review("approved", "decision-1"), review("approved", "decision-2"), review("approved", "decision-3"),
        review("approved", "decision-4"), review("rejected", "decision-5"),
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
        humanShadowReviewed: 5,
        humanShadowApprovalRate: 0.8,
      },
      requirements: {
        minimumShadowSample: 5,
        minimumShadowAgreementRate: 0.8,
        minimumSupervisedReviews: 2,
        minimumHumanShadowReviews: 5,
        minimumHumanShadowApprovalRate: 0.8,
      },
    });
  });

  it("blocks rollout when human approval is below the threshold", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "2";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "1";
    process.env.CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS = "2";
    vi.mocked(prisma.internalActionLog.findMany)
      .mockResolvedValueOnce([
        shadow(true, false, "ai", "classified", "decision-1"),
        shadow(true, false, "ai", "classified", "decision-2"),
      ] as never)
      .mockResolvedValueOnce([review("approved", "decision-1"), review("rejected", "decision-2")] as never);
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

  it("ignores reviews that do not reference a valid decision in the current window", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "1";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "1";
    process.env.CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS = "1";
    vi.mocked(prisma.internalActionLog.findMany)
      .mockResolvedValueOnce([shadow(true, false, "ai", "classified", "current-decision")] as never)
      .mockResolvedValueOnce([review("approved", "old-decision")] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(1);

    await expect(evaluateAutoReplyRolloutGate()).resolves.toMatchObject({
      approved: false,
      reasons: expect.arrayContaining(["insufficient_human_shadow_reviews"]),
      metrics: { humanShadowReviewed: 0 },
    });
  });

  it("does not approve FAQ rollout using evidence from another intent", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "1";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "1";
    process.env.CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS = "1";
    vi.mocked(prisma.internalActionLog.findMany)
      .mockResolvedValueOnce([
        shadow(true, false, "ai", "classified", "quote-decision", "quote", "collect_quote_fields"),
      ] as never)
      .mockResolvedValueOnce([review("approved", "quote-decision")] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(1);

    await expect(evaluateAutoReplyRolloutGate(new Date(), "faq")).resolves.toMatchObject({
      approved: false,
      reasons: expect.arrayContaining(["insufficient_shadow_sample"]),
      metrics: { shadowSample: 0 },
    });
    expect(prisma.supervisedReplySuggestion.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ rolloutIntent: "faq" }),
    });
  });

  it("counts supervised evidence only for the requested non-FAQ intent", async () => {
    process.env.CRM_ROLLOUT_MIN_SHADOW_SAMPLE = "1";
    process.env.CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS = "1";
    process.env.CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS = "1";
    vi.mocked(prisma.internalActionLog.findMany)
      .mockResolvedValueOnce([
        shadow(true, false, "ai", "classified", "parking-decision", "parking", "none"),
      ] as never)
      .mockResolvedValueOnce([review("approved", "parking-decision")] as never);
    vi.mocked(prisma.supervisedReplySuggestion.count).mockResolvedValue(1);

    await expect(evaluateAutoReplyRolloutGate(new Date(), "parking")).resolves.toMatchObject({
      approved: true,
      metrics: { supervisedReviewed: 1 },
    });
    expect(prisma.supervisedReplySuggestion.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ intent: "parking" }),
    });
  });
});
