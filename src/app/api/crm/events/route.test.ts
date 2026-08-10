import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { internalActionLog: { findMany: vi.fn() } },
}));

import prisma from "@/lib/prisma";
import { GET } from "./route";

describe("GET /api/crm/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns normalized audit fields without exposing metadata parsing failures", async () => {
    vi.mocked(prisma.internalActionLog.findMany).mockResolvedValue([
      {
        id: "event-1",
        action: "PipelineStageChanged",
        contactId: "contact-1",
        conversationId: "conversation-1",
        metadataJson: JSON.stringify({
          actorType: "system",
          origin: "system",
          reason: "Reserva confirmada pelo gateway",
        }),
        createdAt: new Date("2026-08-10T17:30:00.000Z"),
        contact: { id: "contact-1", name: "Hóspede" },
      },
      {
        id: "event-legacy",
        action: "LegacyEvent",
        contactId: null,
        conversationId: null,
        metadataJson: "invalid-json",
        createdAt: new Date("2026-08-10T17:00:00.000Z"),
        contact: null,
      },
    ] as never);

    const response = await GET(new Request("http://localhost/api/crm/events"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toMatchObject({
      audit: {
        actorLabel: "Sistema",
        originLabel: "Processamento interno",
        reason: "Reserva confirmada pelo gateway",
      },
    });
    expect(body.items[1]).toMatchObject({
      metadata: null,
      audit: { actorLabel: "Responsável não informado" },
    });
  });
});
