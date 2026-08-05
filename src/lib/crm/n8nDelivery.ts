import { parseN8nEventEnvelope } from "@/lib/crm/n8nEventContract";

type FetchLike = typeof fetch;

export type N8nDeliveryConfig = {
  url: string;
  token: string;
  timeoutMs: number;
  maxAttempts: number;
};

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function getN8nDeliveryConfig(): N8nDeliveryConfig | null {
  if (process.env.N8N_ENABLED !== "true") return null;

  const url = process.env.N8N_WEBHOOK_URL?.trim();
  const token = process.env.N8N_WEBHOOK_TOKEN?.trim();
  if (!url || !token) throw new Error("n8n_configuration_incomplete");

  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("n8n_webhook_url_invalid");
  }

  return {
    url: parsedUrl.toString(),
    token,
    timeoutMs: boundedInteger(process.env.N8N_TIMEOUT_MS, 3_000, 500, 10_000),
    maxAttempts: boundedInteger(process.env.N8N_MAX_ATTEMPTS, 3, 1, 5),
  };
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function defaultSleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function deliverN8nEvent(
  envelope: unknown,
  options?: {
    config?: N8nDeliveryConfig;
    fetchImpl?: FetchLike;
    sleep?: (ms: number) => Promise<void>;
  }
) {
  const validatedEnvelope = parseN8nEventEnvelope(envelope);
  if (!validatedEnvelope) throw new Error("invalid_n8n_event_payload");

  const config = options?.config ?? getN8nDeliveryConfig();
  if (!config) return { delivered: false as const, reason: "disabled" as const };

  const fetchImpl = options?.fetchImpl ?? fetch;
  const sleep = options?.sleep ?? defaultSleep;
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.token}`,
          "X-CRM-Event-ID": validatedEnvelope.eventId,
        },
        body: JSON.stringify(validatedEnvelope),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      lastStatus = response.status;

      if (response.ok) {
        return { delivered: true as const, attempts: attempt, status: response.status };
      }

      if (!isRetryableStatus(response.status)) {
        throw new Error(`n8n_delivery_rejected_${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("n8n_delivery_rejected_")) {
        throw error;
      }
      if (attempt === config.maxAttempts) {
        throw new Error(lastStatus ? `n8n_delivery_failed_${lastStatus}` : "n8n_delivery_failed_network");
      }
    }

    if (attempt < config.maxAttempts) {
      await sleep(100 * (2 ** (attempt - 1)));
    }
  }

  throw new Error(lastStatus ? `n8n_delivery_failed_${lastStatus}` : "n8n_delivery_failed_network");
}
