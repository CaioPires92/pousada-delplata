import { describe, expect, it, vi } from "vitest";
import type { NormalizedStatusEvent } from "./provider";
import { persistMessageDeliveryStatus } from "./delivery-status-store";

const failedEvent: NormalizedStatusEvent = {
  kind: "status",
  externalEventId: "status:wamid.TEST_FAILED:failed:1785254411",
  externalMessageId: "wamid.TEST_FAILED",
  channel: "whatsapp",
  status: "failed",
  occurredAt: "2026-07-28T12:00:11.000Z",
  error: {
    code: "131047",
    title: "Re-engagement message",
    detail: "Authorization: Bearer secret-token; access_token=private-value",
  },
};

describe("persistMessageDeliveryStatus", () => {
  it("updates every correlated message with a sanitized delivery failure", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });

    await expect(persistMessageDeliveryStatus(failedEvent, {
      message: { updateMany },
    })).resolves.toEqual({ matchedMessages: 1 });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        externalMessageId: "wamid.TEST_FAILED",
        OR: [
          { deliveryUpdatedAt: null },
          { deliveryUpdatedAt: { lte: new Date("2026-07-28T12:00:11.000Z") } },
        ],
      },
      data: {
        deliveryStatus: "failed",
        deliveryErrorCode: "131047",
        deliveryErrorTitle: "Re-engagement message",
        deliveryErrorDetail: "Authorization: Bearer [REDACTED]; access_token=[REDACTED]",
        deliveryUpdatedAt: new Date("2026-07-28T12:00:11.000Z"),
      },
    });
  });

  it("clears an older error when a later successful status arrives", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });

    await persistMessageDeliveryStatus({
      ...failedEvent,
      externalEventId: "status:wamid.TEST_FAILED:delivered:1785254420",
      status: "delivered",
      occurredAt: "2026-07-28T12:00:20.000Z",
      error: undefined,
    }, {
      message: { updateMany },
    });

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        deliveryStatus: "delivered",
        deliveryErrorCode: null,
        deliveryErrorTitle: null,
        deliveryErrorDetail: null,
      }),
    }));
  });

  it("rejects an invalid event timestamp before accessing the database", async () => {
    const updateMany = vi.fn();

    await expect(persistMessageDeliveryStatus({
      ...failedEvent,
      occurredAt: "invalid",
    }, {
      message: { updateMany },
    })).rejects.toThrow("Invalid delivery status timestamp");

    expect(updateMany).not.toHaveBeenCalled();
  });
});
