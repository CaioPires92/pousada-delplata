import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  createSettings: vi.fn(),
  createLog: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));
vi.mock("@/lib/prisma", () => ({
  default: {
    chatbotSettings: {
      findFirst: mocks.findFirst,
      update: mocks.update,
      create: mocks.createSettings,
    },
    internalActionLog: { create: mocks.createLog },
  },
}));

import { GET, PUT } from "./route";

describe("admin chatbot settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ adminId: "admin-1" });
    mocks.findFirst.mockResolvedValue({ id: "global" });
    mocks.update.mockImplementation(async ({ data }) => ({
      enabledGlobal: false,
      enabledWhatsapp: false,
      pipelineAutomationEnabled: true,
      autoReplyIntentsJson: '["quote"]',
      autoReplyRolloutPercentage: 0,
      ...data,
    }));
    mocks.createLog.mockResolvedValue({});
  });

  it("validates, persists and audits the rollout percentage", async () => {
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
