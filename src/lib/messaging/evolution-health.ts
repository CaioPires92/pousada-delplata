import type { EvolutionMessagingProviderConfig } from "./evolution-provider";

export type EvolutionMessagingHealthResult =
  | { status: "healthy"; connectionState: "open" }
  | {
      status: "unhealthy";
      reason: "provider_request_failed" | "provider_unreachable" | "invalid_provider_response" | "instance_not_connected";
      providerStatus?: number;
      connectionState?: string;
    };

export async function checkEvolutionMessagingHealth(
  config: EvolutionMessagingProviderConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<EvolutionMessagingHealthResult> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${config.apiUrl}/instance/connectionState/${encodeURIComponent(config.instanceName)}`,
      {
        method: "GET",
        headers: { apikey: config.apiKey },
        signal: AbortSignal.timeout(5_000),
      },
    );
  } catch {
    return { status: "unhealthy", reason: "provider_unreachable" };
  }
  if (!response.ok) {
    return { status: "unhealthy", reason: "provider_request_failed", providerStatus: response.status };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: "unhealthy", reason: "invalid_provider_response" };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { status: "unhealthy", reason: "invalid_provider_response" };
  }
  const root = payload as Record<string, unknown>;
  const instance = root.instance && typeof root.instance === "object"
    ? root.instance as Record<string, unknown>
    : undefined;
  const state = [instance?.state, instance?.status, root.state, root.status]
    .find(value => typeof value === "string") as string | undefined;
  if (!state) return { status: "unhealthy", reason: "invalid_provider_response" };
  if (state.toLowerCase() === "open") return { status: "healthy", connectionState: "open" };
  return { status: "unhealthy", reason: "instance_not_connected", connectionState: state.slice(0, 50) };
}
