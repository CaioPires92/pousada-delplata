import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    pipelineCard: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/crm/pipelineCards", () => ({ updatePipelineCard: vi.fn() }));
vi.mock("@/lib/crm/eventIdempotency", () => ({
  claimCrmEvent: vi.fn(),
  completeCrmEvent: vi.fn(),
  releaseCrmEvent: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { claimCrmEvent, completeCrmEvent, releaseCrmEvent } from "@/lib/crm/eventIdempotency";
import { updatePipelineCard } from "@/lib/crm/pipelineCards";
import { POST } from "./route";

function request(eventId = "event-1") {
  return new Request("http://localhost/api/crm/internal-actions", {
    method: "POST",
    headers: { Authorization: "Bearer internal-token" },
    body: JSON.stringify({
      eventId,
      action: "MOVE_PIPELINE_CARD",
      payload: { pipelineCardId: "card-1", toStage: "QUALIFICANDO" },
    }),
  });
}

describe("POST /api/crm/internal-actions idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRM_INTERNAL_API_TOKEN = "internal-token";
    vi.mocked(prisma.pipelineCard.findUnique).mockResolvedValue({ conversationId: null } as never);
    vi.mocked(updatePipelineCard).mockResolvedValue({
      ok: true,
      card: { id: "card-1", stage: "QUALIFICANDO" } as never,
      stageChanged: true,
    });
  });

  it("rejects an invalid internal token before claiming the event", async () => {
    const unauthorizedRequest = request();
    unauthorizedRequest.headers.set("Authorization", "Bearer wrong-token");

    const response = await POST(unauthorizedRequest);

    expect(response.status).toBe(401);
    expect(claimCrmEvent).not.toHaveBeenCalled();
    expect(updatePipelineCard).not.toHaveBeenCalled();
  });

  it("executes and stores the first successful result", async () => {
    vi.mocked(claimCrmEvent).mockResolvedValue({ claimed: true });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, action: "MOVE_PIPELINE_CARD" });
    expect(updatePipelineCard).toHaveBeenCalledOnce();
    expect(completeCrmEvent).toHaveBeenCalledWith("event-1", {
      httpStatus: 200,
      body: expect.objectContaining({ ok: true, action: "MOVE_PIPELINE_CARD" }),
    });
    expect(releaseCrmEvent).not.toHaveBeenCalled();
  });

  it("returns the cached result without executing the same event twice", async () => {
    vi.mocked(claimCrmEvent).mockResolvedValue({
      claimed: false,
      receipt: {
        status: "completed",
        completedAt: new Date(),
        resultJson: JSON.stringify({
          httpStatus: 200,
          body: {
            ok: true,
            action: "MOVE_PIPELINE_CARD",
            result: { pipelineCardId: "card-1", stage: "QUALIFICANDO", stageChanged: true },
          },
        }),
      },
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { pipelineCardId: "card-1" },
    });
    expect(updatePipelineCard).not.toHaveBeenCalled();
    expect(completeCrmEvent).not.toHaveBeenCalled();
  });

  it("returns accepted while another worker is processing the event", async () => {
    vi.mocked(claimCrmEvent).mockResolvedValue({
      claimed: false,
      receipt: { status: "processing", completedAt: null, resultJson: null },
    });

    const response = await POST(request());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ processing: true, eventId: "event-1" });
    expect(updatePipelineCard).not.toHaveBeenCalled();
  });
});
