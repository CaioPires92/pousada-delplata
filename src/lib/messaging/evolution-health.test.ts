import { describe, expect, it, vi } from "vitest";
import { checkEvolutionMessagingHealth } from "./evolution-health";

const config = { apiUrl: "http://evolution.test", apiKey: "synthetic-key", instanceName: "delplata-test" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Evolution messaging health", () => {
  it("reports a connected instance", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ instance: { state: "open" } }));
    await expect(checkEvolutionMessagingHealth(config, fetchMock)).resolves.toEqual({
      status: "healthy",
      connectionState: "open",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://evolution.test/instance/connectionState/delplata-test",
      { method: "GET", headers: { apikey: "synthetic-key" }, signal: expect.any(AbortSignal) },
    );
  });

  it("returns sanitized disconnected and HTTP failures", async () => {
    await expect(checkEvolutionMessagingHealth(config, vi.fn().mockResolvedValue(response({ instance: { state: "close" } })))).resolves.toEqual({
      status: "unhealthy", reason: "instance_not_connected", connectionState: "close",
    });
    const result = await checkEvolutionMessagingHealth(config, vi.fn().mockResolvedValue(response({ error: `secret ${config.apiKey}` }, 401)));
    expect(result).toEqual({ status: "unhealthy", reason: "provider_request_failed", providerStatus: 401 });
    expect(JSON.stringify(result)).not.toContain(config.apiKey);
  });

  it("handles malformed responses and network failures", async () => {
    await expect(checkEvolutionMessagingHealth(config, vi.fn().mockResolvedValue(response({})))).resolves.toEqual({ status: "unhealthy", reason: "invalid_provider_response" });
    await expect(checkEvolutionMessagingHealth(config, vi.fn().mockRejectedValue(new Error("offline")))).resolves.toEqual({ status: "unhealthy", reason: "provider_unreachable" });
  });
});
