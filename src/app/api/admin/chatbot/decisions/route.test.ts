import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  messageFindMany: vi.fn(),
  requireAdminAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    internalActionLog: { findMany: mocks.findMany, findFirst: mocks.findFirst, create: mocks.create },
    message: { findMany: mocks.messageFindMany },
  },
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));

import { GET, POST } from "./route";
import { AI_DECISION_SCHEMA_VERSION } from "@/lib/crm/aiDecision";
import { CRM_AI_PROMPT_VERSION, CRM_AUTOMATION_POLICY_VERSION } from "@/lib/crm/automationVersions";

const currentVersions = {
  promptVersion: CRM_AI_PROMPT_VERSION,
  decisionSchemaVersion: AI_DECISION_SCHEMA_VERSION,
  policyVersion: CRM_AUTOMATION_POLICY_VERSION,
};

describe("admin chatbot decision review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ adminId: "admin-1" });
    mocks.findMany.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "review-1" });
    mocks.messageFindMany.mockResolvedValue([]);
  });

  it("rejects unauthenticated access", async () => {
    mocks.requireAdminAuth.mockResolvedValue(
      NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    );

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("returns a bounded and sanitized review sample", async () => {
    mocks.findMany.mockResolvedValueOnce([{
      id: "log-1",
      createdAt: new Date("2026-08-07T19:00:00.000Z"),
      conversationId: "conversation-1",
      conversation: { contact: { name: "Hóspede teste", phone: "5519999999999" } },
      metadataJson: JSON.stringify({
        intent: "parking",
        heuristicIntent: "amenity",
        confidence: 0.91,
        source: "ai",
        mode: "shadow",
        ...currentVersions,
        accepted: true,
        actionAuthorized: false,
        agreementWithHeuristic: false,
        suggestedAction: "answer_approved_faq",
        result: "classified",
        latencyMs: 320,
        inputTokens: 42,
        outputTokens: 18,
        sourceMessageId: "message-1",
      }),
    }]).mockResolvedValueOnce([]);
    mocks.messageFindMany.mockResolvedValueOnce([{
      id: "message-1",
      content: "Tem estacionamento disponível?",
    }]);

    const response = await GET();
    const body = await response.json();

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      where: expect.objectContaining({
        action: "IntentClassified",
        createdAt: { gte: expect.any(Date) },
      }),
    }));
    expect(body.decisions[0]).toMatchObject({
      contactLabel: "Hóspede teste",
      mode: "shadow",
      actionAuthorized: false,
      totalTokens: 60,
      agreementWithHeuristic: false,
      sourceMessageId: "message-1",
      sourceMessageExcerpt: "Tem estacionamento disponível?",
    });
    expect(mocks.messageFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["message-1"] }, senderType: "guest" },
      select: { id: true, content: true },
    });
    expect(body.windowStartedAt).toEqual(expect.any(String));
    expect(body.summary).toEqual({
      sampled: 1,
      shadow: 1,
      diagnostics: 0,
      obsoleteVersions: 0,
      pendingReview: 1,
      authorizedActions: 0,
      agreementRate: 0,
      shadowSafetyPassed: true,
      corrections: [],
      byIntent: [{
        intent: "faq",
        sampled: 1,
        reviewed: 0,
        approved: 0,
        rejected: 0,
        pending: 1,
        approvalRate: null,
      }],
    });
  });

  it("summarizes persisted human reviews by rollout intent", async () => {
    const base = {
      createdAt: new Date("2026-08-12T19:00:00.000Z"),
      conversationId: null,
      conversation: null,
    };
    mocks.findMany.mockResolvedValueOnce([
      { id: "faq-approved", ...base, metadataJson: JSON.stringify({ intent: "amenity", suggestedAction: "answer_approved_faq", mode: "shadow", source: "ai", result: "classified", ...currentVersions }) },
      { id: "faq-pending", ...base, metadataJson: JSON.stringify({ intent: "amenity", suggestedAction: "answer_approved_faq", mode: "shadow", source: "ai", result: "classified", ...currentVersions }) },
      { id: "quote-rejected", ...base, metadataJson: JSON.stringify({ intent: "quote", mode: "shadow", source: "ai", result: "classified", ...currentVersions }) },
      { id: "diagnostic", ...base, metadataJson: JSON.stringify({ intent: "unknown", mode: "shadow", source: "heuristic", result: "fallback_invalid_response" }) },
    ]).mockResolvedValueOnce([
      { metadataJson: JSON.stringify({ decisionId: "faq-approved", verdict: "approved" }), createdAt: new Date(), userId: "admin-1" },
      { metadataJson: JSON.stringify({ decisionId: "quote-rejected", verdict: "rejected", expectedIntent: "reservation" }), createdAt: new Date(), userId: "admin-1" },
    ]);

    const body = await (await GET()).json();

    expect(body.summary.byIntent).toEqual([
      { intent: "faq", sampled: 2, reviewed: 1, approved: 1, rejected: 0, pending: 1, approvalRate: 1 },
      { intent: "quote", sampled: 1, reviewed: 1, approved: 0, rejected: 1, pending: 0, approvalRate: 0 },
    ]);
    expect(body.summary.corrections).toEqual([{
      predictedIntent: "quote",
      expectedIntent: "reservation",
      count: 1,
    }]);
    expect(body.decisions.find((decision: { id: string }) => decision.id === "quote-rejected")).toMatchObject({
      reviewVerdict: "rejected",
      expectedIntent: "reservation",
    });
  });

  it("prioritizes valid unreviewed Gemini decisions over diagnostics", async () => {
    const base = {
      createdAt: new Date("2026-08-12T19:00:00.000Z"),
      conversationId: null,
      conversation: null,
    };
    mocks.findMany.mockResolvedValueOnce([
      { id: "fallback", ...base, metadataJson: JSON.stringify({ mode: "shadow", source: "heuristic", result: "fallback_invalid_response" }) },
      { id: "reviewed-ai", ...base, metadataJson: JSON.stringify({ mode: "shadow", source: "ai", result: "classified", agreementWithHeuristic: true, ...currentVersions }) },
      { id: "pending-ai", ...base, metadataJson: JSON.stringify({ mode: "shadow", source: "ai", result: "classified", agreementWithHeuristic: true, ...currentVersions }) },
    ]).mockResolvedValueOnce([{
      metadataJson: JSON.stringify({ decisionId: "reviewed-ai", verdict: "approved" }),
      createdAt: new Date(),
      userId: "admin-1",
    }]);

    const body = await (await GET()).json();

    expect(body.decisions.map((decision: { id: string }) => decision.id)).toEqual([
      "pending-ai", "reviewed-ai", "fallback",
    ]);
    expect(body.summary).toMatchObject({ sampled: 2, shadow: 2, diagnostics: 1, pendingReview: 1 });
  });

  it("excludes and flags decisions from obsolete runtime versions", async () => {
    const base = {
      createdAt: new Date("2026-08-12T19:00:00.000Z"),
      conversationId: null,
      conversation: null,
    };
    mocks.findMany.mockResolvedValueOnce([{
      id: "obsolete-ai",
      ...base,
      metadataJson: JSON.stringify({
        mode: "shadow",
        source: "ai",
        result: "classified",
        intent: "parking",
        promptVersion: "old-prompt",
        decisionSchemaVersion: AI_DECISION_SCHEMA_VERSION,
        policyVersion: CRM_AUTOMATION_POLICY_VERSION,
      }),
    }]).mockResolvedValueOnce([]);

    const body = await (await GET()).json();

    expect(body.decisions[0]).toMatchObject({ id: "obsolete-ai", currentVersion: false });
    expect(body.summary).toMatchObject({
      sampled: 0,
      shadow: 0,
      obsoleteVersions: 1,
      pendingReview: 0,
      shadowSafetyPassed: false,
    });
  });

  it("fails the daily gate if shadow mode authorized any action", async () => {
    mocks.findMany.mockResolvedValueOnce([{
      id: "log-risk",
      createdAt: new Date(),
      conversationId: null,
      conversation: null,
      metadataJson: JSON.stringify({ mode: "shadow", source: "ai", result: "classified", actionAuthorized: true, ...currentVersions }),
    }]).mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(body.summary).toMatchObject({ authorizedActions: 1, shadowSafetyPassed: false });
  });

  it("persists an audited human review for a shadow decision", async () => {
    mocks.findFirst
      .mockResolvedValueOnce({
        id: "log-1",
        conversationId: "conversation-1",
        metadataJson: JSON.stringify({ mode: "shadow", source: "ai", result: "classified", ...currentVersions }),
      })
      .mockResolvedValueOnce(null);

    const response = await POST(new Request("http://localhost/api/admin/chatbot/decisions", {
      method: "POST",
      body: JSON.stringify({ decisionId: "log-1", verdict: "approved" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "AiDecisionReviewed",
        userId: "admin-1",
        conversationId: "conversation-1",
        metadataJson: expect.stringContaining('"verdict":"approved"'),
      }),
    });
  });

  it("requires and persists the expected intent for an incorrect decision", async () => {
    const missing = await POST(new Request("http://localhost/api/admin/chatbot/decisions", {
      method: "POST",
      body: JSON.stringify({ decisionId: "log-1", verdict: "rejected" }),
    }));
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({ error: "expected_intent_required" });
    expect(mocks.findFirst).not.toHaveBeenCalled();

    mocks.findFirst
      .mockResolvedValueOnce({
        id: "log-1",
        conversationId: "conversation-1",
        metadataJson: JSON.stringify({ mode: "shadow", source: "ai", result: "classified", ...currentVersions }),
      })
      .mockResolvedValueOnce(null);

    const response = await POST(new Request("http://localhost/api/admin/chatbot/decisions", {
      method: "POST",
      body: JSON.stringify({ decisionId: "log-1", verdict: "rejected", expectedIntent: "parking" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadataJson: expect.stringContaining('"expectedIntent":"parking"'),
      }),
    });
  });

  it("rejects review of a decision outside shadow mode", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: "log-1",
      conversationId: null,
      metadataJson: JSON.stringify({ mode: "deterministic" }),
    });

    const response = await POST(new Request("http://localhost/api/admin/chatbot/decisions", {
      method: "POST",
      body: JSON.stringify({ decisionId: "log-1", verdict: "rejected", expectedIntent: "unknown" }),
    }));

    expect(response.status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects review of a heuristic fallback from shadow diagnostics", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: "log-fallback",
      conversationId: null,
      metadataJson: JSON.stringify({ mode: "shadow", source: "heuristic", result: "fallback_invalid_response" }),
    });

    const response = await POST(new Request("http://localhost/api/admin/chatbot/decisions", {
      method: "POST",
      body: JSON.stringify({ decisionId: "log-fallback", verdict: "approved" }),
    }));

    expect(response.status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("limits human review to decisions inside the current 24-hour sample", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);

    const response = await POST(new Request("http://localhost/api/admin/chatbot/decisions", {
      method: "POST",
      body: JSON.stringify({ decisionId: "old-decision", verdict: "approved" }),
    }));

    expect(response.status).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "old-decision",
        action: "IntentClassified",
        createdAt: { gte: expect.any(Date) },
      },
    }));
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
