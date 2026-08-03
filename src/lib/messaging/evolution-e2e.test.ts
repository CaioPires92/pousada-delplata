import { describe, expect, it, vi } from "vitest";
import { runEvolutionMessagingE2E } from "./evolution-e2e";

describe("Evolution messaging E2E runner", () => {
  it("fails closed without explicit opt-in and recipient", async () => {
    const factory = vi.fn();
    await expect(runEvolutionMessagingE2E({}, factory)).rejects.toThrow("EVOLUTION_E2E_ENABLED=true");
    await expect(runEvolutionMessagingE2E({ EVOLUTION_E2E_ENABLED: "true" }, factory)).rejects.toThrow("EVOLUTION_TEST_RECIPIENT");
    expect(factory).not.toHaveBeenCalled();
  });

  it("rejects invalid polling configuration before sending", async () => {
    const send = vi.fn();
    await expect(runEvolutionMessagingE2E({
      EVOLUTION_E2E_ENABLED: "true",
      EVOLUTION_TEST_RECIPIENT: "5511999990001",
      EVOLUTION_E2E_WEBHOOK_TIMEOUT_MS: "invalid",
    }, () => ({ name: "evolution", normalizeWebhook: vi.fn(), send }))).rejects.toThrow("must be a positive integer");
    expect(send).not.toHaveBeenCalled();
  });

  it("returns sanitized end-to-end evidence", async () => {
    const send = vi.fn().mockResolvedValue({
      externalMessageId: "EVO_E2E_001",
      acceptedAt: "2026-08-03T20:30:00.000Z",
      status: "sent",
    });
    const findFirst = vi.fn().mockResolvedValue({
      normalizedEventJson: JSON.stringify({ status: "delivered" }),
      receivedAt: new Date("2026-08-03T20:30:02.000Z"),
    });
    await expect(runEvolutionMessagingE2E({
      EVOLUTION_E2E_ENABLED: "true",
      EVOLUTION_TEST_RECIPIENT: "5511999990001",
    }, () => ({ name: "evolution", normalizeWebhook: vi.fn(), send }), () => new Date("2026-08-03T20:30:00.000Z"), {
      messagingWebhookEvent: { findFirst },
    })).resolves.toEqual({
      ok: true,
      provider: "evolution",
      externalMessageId: "EVO_E2E_001",
      acceptedAt: "2026-08-03T20:30:00.000Z",
      status: "sent",
      delivery: { status: "delivered", receivedAt: "2026-08-03T20:30:02.000Z" },
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { provider: "evolution", externalMessageId: "EVO_E2E_001", eventKind: "status" },
    }));
  });
});
