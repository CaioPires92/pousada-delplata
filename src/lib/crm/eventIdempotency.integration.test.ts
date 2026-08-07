import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import prisma from "@/lib/prisma";
import { claimCrmEvent, completeCrmEvent, releaseCrmEvent } from "@/lib/crm/eventIdempotency";

const eventIds: string[] = [];

afterEach(async () => {
  if (eventIds.length > 0) {
    await prisma.crmEventReceipt.deleteMany({ where: { eventId: { in: eventIds.splice(0) } } });
  }
});

describe("CRM event idempotency", () => {
  it("allows only one concurrent claim for the same eventId", async () => {
    const eventId = `test:${randomUUID()}`;
    eventIds.push(eventId);

    const claims = await Promise.all([
      claimCrmEvent({ eventId, source: "test", eventType: "PaymentApproved" }),
      claimCrmEvent({ eventId, source: "test", eventType: "PaymentApproved" }),
    ]);

    expect(claims.filter((claim) => claim.claimed)).toHaveLength(1);
    expect(claims.filter((claim) => !claim.claimed)).toHaveLength(1);

    await completeCrmEvent(eventId, { ok: true });
    await expect(claimCrmEvent({ eventId, source: "test", eventType: "PaymentApproved" }))
      .resolves.toMatchObject({
        claimed: false,
        receipt: { status: "completed", resultJson: '{"ok":true}' },
      });
  });

  it("releases an unfinished claim so a retry can process it", async () => {
    const eventId = `test:${randomUUID()}`;
    eventIds.push(eventId);

    await expect(claimCrmEvent({ eventId, source: "test", eventType: "PaymentPending" }))
      .resolves.toEqual({ claimed: true });
    await releaseCrmEvent(eventId);
    await expect(claimCrmEvent({ eventId, source: "test", eventType: "PaymentPending" }))
      .resolves.toEqual({ claimed: true });
  });
});
