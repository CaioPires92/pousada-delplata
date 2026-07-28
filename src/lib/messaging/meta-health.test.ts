import { describe, expect, it, vi } from "vitest";
import {
  checkMetaMessagingHealth,
  metaMessagingHealthConfigFromEnv,
} from "./meta-health";

const config = {
  accessToken: "synthetic-access-token",
  businessAccountId: "WABA_TEST_001",
  phoneNumberId: "PHONE_NUMBER_TEST_001",
  graphApiVersion: "v99.0",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Meta messaging health", () => {
  it("confirms the configured phone number without exposing account metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      data: [{
        id: "PHONE_NUMBER_TEST_001",
        verified_name: "Synthetic Hotel",
        display_phone_number: "+55 00 00000-0000",
        quality_rating: "GREEN",
      }],
    }));

    await expect(checkMetaMessagingHealth(config, fetchMock)).resolves.toEqual({
      status: "healthy",
      qualityRating: "GREEN",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v99.0/WABA_TEST_001/phone_numbers?fields=id%2Cquality_rating",
      {
        method: "GET",
        headers: { authorization: "Bearer synthetic-access-token" },
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("returns a controlled failure when Meta rejects the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      error: { message: `sensitive ${config.accessToken}` },
    }, 401));

    const result = await checkMetaMessagingHealth(config, fetchMock);

    expect(result).toEqual({
      status: "unhealthy",
      reason: "provider_request_failed",
      providerStatus: 401,
    });
    expect(JSON.stringify(result)).not.toContain(config.accessToken);
  });

  it("reports a mismatched phone number and malformed responses", async () => {
    await expect(checkMetaMessagingHealth(
      config,
      vi.fn().mockResolvedValue(response({
        data: [{ id: "ANOTHER_PHONE", quality_rating: "GREEN" }],
      })),
    )).resolves.toEqual({
      status: "unhealthy",
      reason: "configured_phone_not_found",
    });

    await expect(checkMetaMessagingHealth(
      config,
      vi.fn().mockResolvedValue(response({ data: "invalid" })),
    )).resolves.toEqual({
      status: "unhealthy",
      reason: "invalid_provider_response",
    });
  });

  it("requires every server-side health configuration value", () => {
    expect(() => metaMessagingHealthConfigFromEnv({})).toThrow(
      "Missing Meta messaging health configuration",
    );
  });
});
