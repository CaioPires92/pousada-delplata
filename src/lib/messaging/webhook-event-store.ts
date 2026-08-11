import prisma from "@/lib/prisma";
import type { NormalizedMessagingEvent } from "./provider";
import { sanitizeStatusError } from "./status-error-sanitizer";

type WebhookEventCreateClient = {
  messagingWebhookEvent: {
    create(args: {
      data: {
        provider: string;
        externalEventId: string;
        eventKind: string;
        externalMessageId: string;
        normalizedEventJson: string;
      };
    }): Promise<unknown>;
  };
};

export type PersistWebhookEventsResult = {
  acceptedEvents: number;
  duplicateEvents: number;
};

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === "P2002",
  );
}

export async function persistNormalizedWebhookEvents(
  provider: string,
  events: ReadonlyArray<NormalizedMessagingEvent>,
  client: WebhookEventCreateClient = prisma,
): Promise<PersistWebhookEventsResult> {
  const results: Array<"accepted" | "duplicate"> = [];
  // SQLite/Turso serializa escritas. Manter este trecho sequencial evita que
  // rajadas do provedor esgotem o timeout do banco por contenção interna.
  for (const event of events) {
    try {
      const persistedEvent = event.kind === "status"
        ? {
            ...event,
            ...(event.error
              ? { error: sanitizeStatusError(event.error) }
              : {}),
          }
        : event;
      await client.messagingWebhookEvent.create({
        data: {
          provider,
          externalEventId: event.externalEventId,
          eventKind: event.kind,
          externalMessageId: event.externalMessageId,
          normalizedEventJson: JSON.stringify(persistedEvent),
        },
      });
      results.push("accepted");
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        results.push("duplicate");
        continue;
      }
      throw error;
    }
  }

  return {
    acceptedEvents: results.filter(result => result === "accepted").length,
    duplicateEvents: results.filter(result => result === "duplicate").length,
  };
}
