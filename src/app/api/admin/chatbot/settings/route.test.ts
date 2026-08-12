import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  createSettings: vi.fn(),
  createLog: vi.fn(),
  findLatestRolloutChange: vi.fn(),
  findConversations: vi.fn(),
  evaluateRolloutGate: vi.fn(),
  evaluateRolloutStability: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));
vi.mock("@/lib/crm/rolloutGate", () => ({ evaluateAutoReplyRolloutGate: mocks.evaluateRolloutGate }));
vi.mock("@/lib/crm/rolloutStability", () => ({ evaluateRolloutStability: mocks.evaluateRolloutStability }));
vi.mock("@/lib/prisma", () => ({
  default: {
    chatbotSettings: {
      findFirst: mocks.findFirst,
      update: mocks.update,
      create: mocks.createSettings,
    },
    internalActionLog: { create: mocks.createLog, findFirst: mocks.findLatestRolloutChange },
    conversation: { findMany: mocks.findConversations },
  },
}));

import { GET, PUT } from "./route";

describe("admin chatbot settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ adminId: "admin-1" });
    mocks.findFirst.mockResolvedValue({
      id: "global",
      autoReplyIntentsJson: '["quote"]',
      autoReplyRolloutPercentage: 0,
    });
    mocks.evaluateRolloutGate.mockResolvedValue({ approved: true, reasons: [], metrics: {} });
    mocks.evaluateRolloutStability.mockResolvedValue({ approved: true, reasons: [], metrics: {} });
    mocks.update.mockImplementation(async ({ data }) => ({
      enabledGlobal: false,
      enabledWhatsapp: false,
      pipelineAutomationEnabled: true,
      autoReplyIntentsJson: '["quote"]',
      autoReplyRolloutPercentage: 0,
      ...data,
    }));
    mocks.createLog.mockResolvedValue({});
    mocks.findLatestRolloutChange.mockResolvedValue(null);
    mocks.findConversations.mockResolvedValue([
      { id: "conversation-1" },
      { id: "conversation-2" },
    ]);
  });

  it("validates, persists and audits the rollout percentage", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "global",
      autoReplyIntentsJson: '["faq"]',
      autoReplyRolloutPercentage: 0,
    });
    const invalid = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 101 }),
    }));
    expect(invalid.status).toBe(400);

    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 5 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { autoReplyRolloutPercentage: 5 },
    }));
    expect(mocks.createLog).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "AutoReplyRolloutPercentageUpdated" }),
    });
    expect(body.settings.autoReplyRolloutPercentage).toBe(5);
  });

  it("blocks expansion when operational evidence has not passed", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "global",
      autoReplyIntentsJson: '["faq"]',
      autoReplyRolloutPercentage: 0,
    });
    mocks.evaluateRolloutGate.mockResolvedValue({
      approved: false,
      reasons: ["insufficient_shadow_sample"],
      metrics: { shadowSample: 0 },
    });

    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 5 }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "rollout_gate_blocked",
      gate: { approved: false },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows only one intent and five percentage points per approved expansion", async () => {
    const intents = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ releasedAutoReplyIntents: ["quote", "parking", "pet"] }),
    }));
    const percentage = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 6 }),
    }));

    expect(intents.status).toBe(400);
    expect(percentage.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows the first production percentage only for FAQ alone", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 5 }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "first_rollout_requires_faq_only",
      requiredIntents: ["faq"],
      configuredIntents: ["quote"],
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows the first production percentage after isolating FAQ", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "global",
      autoReplyIntentsJson: '["faq"]',
      autoReplyRolloutPercentage: 0,
    });

    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 5 }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { autoReplyRolloutPercentage: 5 },
    }));
  });

  it("requires 24 hours of stability before increasing an active rollout", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "global",
      autoReplyIntentsJson: '["faq"]',
      autoReplyRolloutPercentage: 5,
    });
    mocks.findLatestRolloutChange.mockResolvedValue({
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      metadataJson: JSON.stringify({ previousPercentage: 0, percentage: 5 }),
    });

    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 10 }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "rollout_stability_period_active",
      currentPercentage: 5,
      requestedPercentage: 10,
      retryAt: expect.any(String),
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows expansion after 24 stable hours", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "global",
      autoReplyIntentsJson: '["faq"]',
      autoReplyRolloutPercentage: 5,
    });
    mocks.findLatestRolloutChange.mockResolvedValue({
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      metadataJson: JSON.stringify({ previousPercentage: 0, percentage: 5 }),
    });

    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 10 }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.evaluateRolloutStability).toHaveBeenCalledWith(expect.any(Date));
  });

  it("blocks expansion after 24 hours when operational failures occurred", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "global",
      autoReplyIntentsJson: '["faq"]',
      autoReplyRolloutPercentage: 5,
    });
    mocks.findLatestRolloutChange.mockResolvedValue({
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      metadataJson: JSON.stringify({ previousPercentage: 0, percentage: 5 }),
    });
    mocks.evaluateRolloutStability.mockResolvedValue({
      approved: false,
      reasons: ["operational_event_failures"],
      metrics: { eventFailures: 1 },
    });

    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 10 }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "rollout_operational_stability_failed",
      stability: { approved: false, reasons: ["operational_event_failures"] },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("always permits an immediate rollout reduction", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "global",
      autoReplyIntentsJson: '["faq"]',
      autoReplyRolloutPercentage: 10,
    });
    mocks.findLatestRolloutChange.mockResolvedValue({
      createdAt: new Date(),
      metadataJson: JSON.stringify({ previousPercentage: 5, percentage: 10 }),
    });

    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ autoReplyRolloutPercentage: 0 }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.findLatestRolloutChange).not.toHaveBeenCalled();
  });

  it("protects both reading and writing with admin authentication", async () => {
    mocks.requireAdminAuth.mockResolvedValue(
      NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    );

    await expect(GET()).resolves.toMatchObject({ status: 401 });
    await expect(PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      body: JSON.stringify({ releasedAutoReplyIntents: ["quote"] }),
    }))).resolves.toMatchObject({ status: 401 });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns the current rollout gate with settings", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rolloutGate).toMatchObject({ approved: true });
    expect(body.intentGates).toEqual(expect.objectContaining({
      faq: expect.objectContaining({ approved: true }),
      quote: expect.objectContaining({ approved: true }),
    }));
    expect(body.rolloutPreview).toMatchObject({
      current: { percentage: 0, openWhatsappConversations: 2, eligibleConversations: 0 },
      nextIncrement: { percentage: 5, openWhatsappConversations: 2 },
    });
    expect(body.rolloutPreview.current).not.toHaveProperty("conversationIds");
    expect(body.rolloutStability).toEqual({
      requiredHours: 24,
      timeReadyAt: null,
      timeReady: true,
      operational: null,
      ready: false,
    });
    expect(mocks.evaluateRolloutGate).toHaveBeenCalledWith(expect.any(Date), "faq");
  });

  it("returns the operational and temporal stability of an active rollout", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "global",
      enabledGlobal: true,
      enabledWhatsapp: true,
      pipelineAutomationEnabled: true,
      autoReplyIntentsJson: '["faq"]',
      autoReplyRolloutPercentage: 5,
    });
    mocks.findLatestRolloutChange.mockResolvedValue({
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      metadataJson: JSON.stringify({ previousPercentage: 0, percentage: 5 }),
    });
    mocks.evaluateRolloutStability.mockResolvedValue({
      approved: true,
      reasons: [],
      metrics: { eventFailures: 0, failedJobs: 0, openDeadLetters: 0, messagingStatus: "healthy" },
    });

    const body = await (await GET()).json();

    expect(body.rolloutStability).toMatchObject({ timeReady: true, ready: true });
    expect(mocks.evaluateRolloutStability).toHaveBeenCalledWith(expect.any(Date));
  });

  it("rejects an intent outside the rollout allowlist", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releasedAutoReplyIntents: ["quote", "discount"] }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("persists and audits the released intent set", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/chatbot/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releasedAutoReplyIntents: ["quote", "parking", "parking"] }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { autoReplyIntentsJson: '["quote","parking"]' },
    }));
    expect(mocks.createLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "AutoReplyIntentRolloutUpdated",
        userId: "admin-1",
      }),
    });
    expect(body.settings.releasedAutoReplyIntents).toEqual(["quote", "parking"]);
  });
});
