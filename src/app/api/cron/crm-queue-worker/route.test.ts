import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

vi.mock("@/lib/crm/automationQueueWorker", () => ({
  runAutomationQueueWorker: vi.fn().mockResolvedValue({ ok: true, processed: 2, failed: 0 }),
}));

describe("POST /api/cron/crm-queue-worker", () => {
  beforeEach(() => {
    process.env.CRM_INTERNAL_API_TOKEN = "test-token";
    process.env.CRON_SECRET = "cron-token";
  });

  it("runs scheduled batches with the cron token", async () => {
    const req = new Request("http://localhost/api/cron/crm-queue-worker", {
      headers: { Authorization: "Bearer cron-token" },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result).toMatchObject({ processed: 2 });
  });

  it("requires token", async () => {
    const req = new Request("http://localhost/api/cron/crm-queue-worker", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("runs worker with token", async () => {
    const req = new Request("http://localhost/api/cron/crm-queue-worker", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ maxConversations: 10 }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result).toMatchObject({ ok: true, processed: 2 });
  });
});
