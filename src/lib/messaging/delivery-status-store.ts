import prisma from "@/lib/prisma";
import type { NormalizedStatusEvent } from "./provider";
import { sanitizeStatusError } from "./status-error-sanitizer";

type DeliveryStatusClient = {
  message: {
    updateMany(args: {
      where: {
        externalMessageId: string;
        OR: Array<
          | { deliveryUpdatedAt: null }
          | { deliveryUpdatedAt: { lte: Date } }
        >;
      };
      data: {
        deliveryStatus: string;
        deliveryErrorCode: string | null;
        deliveryErrorTitle: string | null;
        deliveryErrorDetail: string | null;
        deliveryUpdatedAt: Date;
      };
    }): Promise<{ count: number }>;
  };
};

export async function persistMessageDeliveryStatus(
  event: NormalizedStatusEvent,
  client: DeliveryStatusClient = prisma,
) {
  const occurredAt = new Date(event.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("Invalid delivery status timestamp");
  }
  const error = sanitizeStatusError(event.error);

  const result = await client.message.updateMany({
    where: {
      externalMessageId: event.externalMessageId,
      OR: [
        { deliveryUpdatedAt: null },
        { deliveryUpdatedAt: { lte: occurredAt } },
      ],
    },
    data: {
      deliveryStatus: event.status,
      deliveryErrorCode: error?.code ?? null,
      deliveryErrorTitle: error?.title ?? null,
      deliveryErrorDetail: error?.detail ?? null,
      deliveryUpdatedAt: occurredAt,
    },
  });

  return { matchedMessages: result.count };
}
