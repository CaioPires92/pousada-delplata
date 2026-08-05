import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { emitCrmEvent, recordCrmEvent } from "@/lib/crm/events";
import { enqueueAutomationJob } from "@/lib/crm/automationQueue";

vi.mock("@/lib/prisma", () => ({
  default: {
    internalActionLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crm/logger", () => ({
  crmLog: vi.fn(),
}));

vi.mock("@/lib/crm/automationQueue", () => ({
  enqueueAutomationJob: vi.fn(),
}));

describe("CRM external event safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    process.env.N8N_ENABLED = "true";
    process.env.N8N_WEBHOOK_URL = "https://n8n.invalid/webhook";
    vi.mocked(prisma.internalActionLog.create).mockResolvedValue({ id: "log-1" } as never);
    vi.mocked(enqueueAutomationJob).mockResolvedValue({ id: "job-1" } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never emits external webhooks in the test environment", async () => {
    await recordCrmEvent({ action: "TestEvent" });

    expect(prisma.internalActionLog.create).toHaveBeenCalledOnce();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("queues an allowlisted sanitized event outside tests", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.N8N_WEBHOOK_TOKEN = "dedicated-token";
    try {
      await expect(emitCrmEvent({
        action: "MessageReceived",
        contactId: "contact-1",
        conversationId: "conversation-1",
        metadata: { channel: "whatsapp", messageType: "text", text: "private" },
      }, "event-1", "2026-08-05T18:30:00.000Z")).resolves.toEqual({ queued: true, jobId: "job-1" });

      expect(enqueueAutomationJob).toHaveBeenCalledWith(expect.objectContaining({
        conversationId: "conversation-1",
        action: "EMIT_N8N_EVENT",
        payload: {
          event: expect.objectContaining({
            eventId: "event-1",
            eventType: "MessageReceived",
            schemaVersion: 1,
            data: { channel: "whatsapp", messageType: "text" },
          }),
        },
      }));
    } finally {
      vi.unstubAllEnvs();
      delete process.env.N8N_WEBHOOK_TOKEN;
    }
  });
});
