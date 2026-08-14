import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), replay: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: mocks.auth }));
vi.mock("@/lib/crm/automationQueue", () => ({ replayDeadLetterItem: mocks.replay }));
vi.mock("@/lib/prisma", () => ({ default: { internalActionLog: { create: mocks.log } } }));

import { POST } from "./route";

function call(confirmation = "REPROCESSAR") {
  return POST(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ confirmation }),
    }),
    { params: Promise.resolve({ id: "dl-1" }) },
  );
}

describe("admin dead-letter replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ adminId: "admin-1" });
    mocks.replay.mockResolvedValue({ ok: true, jobId: "job-1" });
    mocks.log.mockResolvedValue({});
  });

  it("requires admin authentication and exact typed confirmation", async () => {
    mocks.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await call()).status).toBe(401);
    expect((await call("reprocessar")).status).toBe(400);
    expect(mocks.replay).not.toHaveBeenCalled();
  });

  it("queues one replay and attributes the audit to the admin", async () => {
    expect((await call()).status).toBe(200);
    expect(mocks.replay).toHaveBeenCalledWith({ deadLetterId: "dl-1" });
    expect(mocks.log).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DeadLetterReplayQueued",
        userId: "admin-1",
      }),
    });
  });

  it("returns conflict when the item is no longer open", async () => {
    mocks.replay.mockResolvedValue({ ok: false, error: "dead_letter_not_open" });
    expect((await call()).status).toBe(409);
    expect(mocks.log).not.toHaveBeenCalled();
  });
});
