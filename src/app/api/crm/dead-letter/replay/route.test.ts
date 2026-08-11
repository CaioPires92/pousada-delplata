import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/crm/automationQueue", () => ({
  replayDeadLetterItem: vi.fn(),
}));

import { replayDeadLetterItem } from "@/lib/crm/automationQueue";
import { POST } from "./route";

function replayRequest(token?: string, body: unknown = { deadLetterId: "dead-letter-1" }) {
  return new Request("http://localhost/api/crm/dead-letter/replay", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/crm/dead-letter/replay security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRM_INTERNAL_API_TOKEN = "internal-token";
  });

  it.each([undefined, "wrong-token"])("rejects an unauthorized replay (%s)", async token => {
    const response = await POST(replayRequest(token));

    expect(response.status).toBe(401);
    expect(replayDeadLetterItem).not.toHaveBeenCalled();
  });

  it("rejects an empty identifier without touching the queue", async () => {
    const response = await POST(replayRequest("internal-token", { deadLetterId: " " }));

    expect(response.status).toBe(400);
    expect(replayDeadLetterItem).not.toHaveBeenCalled();
  });

  it("allows an authenticated replay", async () => {
    vi.mocked(replayDeadLetterItem).mockResolvedValue({ ok: true, jobId: "job-1" });

    const response = await POST(replayRequest("internal-token"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, jobId: "job-1" });
  });
});
