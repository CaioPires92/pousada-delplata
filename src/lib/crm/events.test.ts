import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";

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

describe("CRM external event safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.N8N_ENABLED = "true";
    process.env.N8N_WEBHOOK_URL = "https://n8n.invalid/webhook";
    vi.mocked(prisma.internalActionLog.create).mockResolvedValue({ id: "log-1" } as never);
  });

  it("never emits external webhooks in the test environment", async () => {
    await recordCrmEvent({ action: "TestEvent" });

    expect(prisma.internalActionLog.create).toHaveBeenCalledOnce();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
