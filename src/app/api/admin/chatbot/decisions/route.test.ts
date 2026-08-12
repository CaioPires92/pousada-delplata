import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  requireAdminAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: { internalActionLog: { findMany: mocks.findMany, findFirst: mocks.findFirst, create: mocks.create } },
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));

import { GET, POST } from "./route";

describe("admin chatbot decision review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ adminId: "admin-1" });
    mocks.findMany.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "review-1" });
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
    mocks.findMany.mockResolvedValue([{
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
        accepted: true,
        actionAuthorized: false,
        agreementWithHeuristic: false,
        suggestedAction: "answer_approved_faq",
        result: "classified",
        latencyMs: 320,
        inputTokens: 42,
        outputTokens: 18,
      }),
    }]);

    const response = await GET();
    const body = await response.json();

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 25,
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
    });
    expect(body.reviewDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.summary).toEqual({
      sampled: 1,
      shadow: 1,
      authorizedActions: 0,
      agreementRate: 0,
      gatePassed: true,
    });
  });

  it("fails the daily gate if shadow mode authorized any action", async () => {
    mocks.findMany.mockResolvedValue([{
      id: "log-risk",
      createdAt: new Date(),
      conversationId: null,
      conversation: null,
      metadataJson: JSON.stringify({ mode: "shadow", actionAuthorized: true }),
    }]);

    const response = await GET();
    const body = await response.json();

    expect(body.summary).toMatchObject({ authorizedActions: 1, gatePassed: false });
  });

  it("persists an audited human review for a shadow decision", async () => {
    mocks.findFirst
      .mockResolvedValueOnce({
        id: "log-1",
        conversationId: "conversation-1",
        metadataJson: JSON.stringify({ mode: "shadow" }),
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

  it("rejects review of a decision outside shadow mode", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: "log-1",
      conversationId: null,
      metadataJson: JSON.stringify({ mode: "deterministic" }),
    });

    const response = await POST(new Request("http://localhost/api/admin/chatbot/decisions", {
      method: "POST",
      body: JSON.stringify({ decisionId: "log-1", verdict: "rejected" }),
    }));

    expect(response.status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
