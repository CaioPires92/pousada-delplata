type FetchLike = typeof fetch;

export type MetaMessagingHealthConfig = {
  accessToken: string;
  businessAccountId: string;
  phoneNumberId: string;
  graphApiVersion: string;
};

export type MetaMessagingHealthResult =
  | {
      status: "healthy";
      qualityRating: "GREEN" | "YELLOW" | "RED" | "NA" | "UNKNOWN";
    }
  | {
      status: "unhealthy";
      reason:
        | "provider_request_failed"
        | "provider_unreachable"
        | "invalid_provider_response"
        | "configured_phone_not_found";
      providerStatus?: number;
    };

function required(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error("Missing Meta messaging health configuration");
  }
  return normalized;
}

export function metaMessagingHealthConfigFromEnv(
  environment: Record<string, string | undefined> = process.env,
): MetaMessagingHealthConfig {
  return {
    accessToken: required(environment.META_WHATSAPP_ACCESS_TOKEN),
    businessAccountId: required(environment.META_WHATSAPP_BUSINESS_ACCOUNT_ID),
    phoneNumberId: required(environment.META_WHATSAPP_PHONE_NUMBER_ID),
    graphApiVersion: required(environment.META_WHATSAPP_GRAPH_API_VERSION),
  };
}

function qualityRating(value: unknown) {
  return value === "GREEN"
    || value === "YELLOW"
    || value === "RED"
    || value === "NA"
    ? value
    : "UNKNOWN";
}

export async function checkMetaMessagingHealth(
  config: MetaMessagingHealthConfig,
  fetchImpl: FetchLike = fetch,
): Promise<MetaMessagingHealthResult> {
  let response: Response;
  try {
    response = await fetchImpl(
      `https://graph.facebook.com/${encodeURIComponent(config.graphApiVersion)}/${encodeURIComponent(config.businessAccountId)}/phone_numbers?fields=id%2Cquality_rating`,
      {
        method: "GET",
        headers: { authorization: `Bearer ${config.accessToken}` },
        signal: AbortSignal.timeout(5_000),
      },
    );
  } catch {
    return { status: "unhealthy", reason: "provider_unreachable" };
  }

  if (!response.ok) {
    return {
      status: "unhealthy",
      reason: "provider_request_failed",
      providerStatus: response.status,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: "unhealthy", reason: "invalid_provider_response" };
  }

  if (
    !payload
    || typeof payload !== "object"
    || !("data" in payload)
    || !Array.isArray(payload.data)
  ) {
    return { status: "unhealthy", reason: "invalid_provider_response" };
  }

  const phone = payload.data.find(item =>
    item
    && typeof item === "object"
    && "id" in item
    && item.id === config.phoneNumberId
  );
  if (!phone || typeof phone !== "object") {
    return { status: "unhealthy", reason: "configured_phone_not_found" };
  }

  return {
    status: "healthy",
    qualityRating: qualityRating(
      "quality_rating" in phone ? phone.quality_rating : undefined,
    ),
  };
}
