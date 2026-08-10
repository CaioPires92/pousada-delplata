import { describe, expect, it, vi } from "vitest";

import {
  automationSendLimitsFromEnv,
  checkAutomationSendLimits,
} from "./automationSendLimits";

describe("automation send limits", () => {
  it("uses safe defaults and accepts positive environment overrides", () => {
    expect(automationSendLimitsFromEnv({})).toEqual({ perContact: 3, global: 200 });
    expect(automationSendLimitsFromEnv({
      CRM_AUTOMATION_CONTACT_DAILY_LIMIT: "5",
      CRM_AUTOMATION_GLOBAL_DAILY_LIMIT: "500",
    })).toEqual({ perContact: 5, global: 500 });
  });

  it("blocks the current claimed job when the contact limit was exceeded", async () => {
    const count = vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(20);
    const result = await checkAutomationSendLimits({
      contactId: "contact-1",
      now: new Date("2026-08-10T18:00:00.000Z"),
      limits: { perContact: 3, global: 200 },
      client: { automationQueueJob: { count } } as never,
    });

    expect(result).toMatchObject({ allowed: false, reason: "contact_send_limit" });
    expect(count).toHaveBeenCalledTimes(2);
  });

  it("gives the global emergency brake precedence", async () => {
    const count = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(201);
    await expect(checkAutomationSendLimits({
      contactId: "contact-1",
      limits: { perContact: 3, global: 200 },
      client: { automationQueueJob: { count } } as never,
    })).resolves.toMatchObject({ allowed: false, reason: "global_send_limit" });
  });
});
