import { afterEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import type { NormalizedMessagingEvent } from "./provider";
import { persistNormalizedWebhookEvents } from "./webhook-event-store";

const event: NormalizedMessagingEvent = {
  kind: "status",
  externalEventId: "status:wamid.TEST_CONCURRENT:delivered:1785254411",
  externalMessageId: "wamid.TEST_CONCURRENT",
  channel: "whatsapp",
  status: "delivered",
  occurredAt: "2026-07-28T12:00:11.000Z",
};

describe("webhook event store database constraint", () => {
  afterEach(async () => {
    await prisma.messagingWebhookEvent.deleteMany();
  });

  it("persists one row when the same event arrives concurrently", async () => {
    const results = await Promise.all([
      persistNormalizedWebhookEvents("meta", [event]),
      persistNormalizedWebhookEvents("meta", [event]),
    ]);

    expect(results.reduce((sum, result) => sum + result.acceptedEvents, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.duplicateEvents, 0)).toBe(1);
    await expect(prisma.messagingWebhookEvent.count()).resolves.toBe(1);
  });
});
