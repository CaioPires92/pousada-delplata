import type { OutboundMessage } from "./provider";
import type { MessagingProviderName } from "./provider-factory";

export const META_CUSTOMER_CARE_WINDOW_MS = 24 * 60 * 60 * 1000;

export class OutboundPolicyError extends Error {
  readonly code = "outside_customer_care_window";
  readonly retryable = false;

  constructor() {
    super("Meta text messages require a customer message within the last 24 hours");
    this.name = "OutboundPolicyError";
  }
}

export function assertOutboundProviderPolicy(input: {
  provider: MessagingProviderName;
  message: OutboundMessage;
  lastInboundAt?: Date | null;
  now?: Date;
}) {
  if (input.provider !== "meta" || input.message.kind === "template") return;

  const now = input.now ?? new Date();
  const elapsed = input.lastInboundAt
    ? now.getTime() - input.lastInboundAt.getTime()
    : Number.POSITIVE_INFINITY;

  if (elapsed < 0 || elapsed > META_CUSTOMER_CARE_WINDOW_MS) {
    throw new OutboundPolicyError();
  }
}
