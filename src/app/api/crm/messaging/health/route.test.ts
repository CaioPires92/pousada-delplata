import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkMetaMessagingHealth,
  metaMessagingHealthConfigFromEnv,
} from "@/lib/messaging/meta-health";
import { GET } from "./route";

vi.mock("@/lib/messaging/meta-health", () => ({
  checkMetaMessagingHealth: vi.fn(),
  metaMessagingHealthConfigFromEnv: vi.fn(),
}));

const request = (token?: string) => new Request(
  "http://localhost/api/crm/messaging/health",
  {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  },
);

describe("GET /api/crm/messaging/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRM_INTERNAL_API_TOKEN = "synthetic-internal-token";
    vi.mocked(metaMessagingHealthConfigFromEnv).mockReturnValue({
      accessToken: "hidden",
      businessAccountId: "waba",
      phoneNumberId: "phone",
      graphApiVersion: "v99.0",
    });
  });

  it("rejects unauthenticated requests before checking Meta", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(checkMetaMessagingHealth).not.toHaveBeenCalled();
  });

  it("returns only the sanitized provider health", async () => {
    vi.mocked(checkMetaMessagingHealth).mockResolvedValue({
      status: "healthy",
      qualityRating: "GREEN",
    });

    const response = await GET(request("synthetic-internal-token"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      provider: "meta",
      status: "healthy",
      qualityRating: "GREEN",
    });
  });

  it("returns 503 for missing configuration or provider failure", async () => {
    vi.mocked(metaMessagingHealthConfigFromEnv).mockImplementationOnce(() => {
      throw new Error("missing secret name");
    });
    const unconfigured = await GET(request("synthetic-internal-token"));
    expect(unconfigured.status).toBe(503);
    await expect(unconfigured.json()).resolves.toEqual({
      ok: false,
      provider: "meta",
      status: "unconfigured",
    });

    vi.mocked(checkMetaMessagingHealth).mockResolvedValueOnce({
      status: "unhealthy",
      reason: "provider_request_failed",
      providerStatus: 401,
    });
    const unhealthy = await GET(request("synthetic-internal-token"));
    expect(unhealthy.status).toBe(503);
    await expect(unhealthy.json()).resolves.toEqual({
      ok: false,
      provider: "meta",
      status: "unhealthy",
      reason: "provider_request_failed",
      providerStatus: 401,
    });
  });
});
