import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), dismiss: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: mocks.auth }));
vi.mock("@/lib/crm/automationQueue", () => ({ dismissDeadLetterItem: mocks.dismiss }));
vi.mock("@/lib/prisma", () => ({ default: { internalActionLog: { create: mocks.log } } }));

import { POST } from "./route";

function call(body: unknown = { reason: "fora de contexto" }) {
  return POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "dl-1" }) });
}

describe("admin dead-letter dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ adminId: "admin-1" });
    mocks.dismiss.mockResolvedValue({ ok: true, dismissed: true });
    mocks.log.mockResolvedValue({});
  });

  it("requires admin authentication and a reason", async () => {
    mocks.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await call()).status).toBe(401);
    expect((await call({})).status).toBe(400);
    expect(mocks.dismiss).not.toHaveBeenCalled();
  });

  it("dismisses and attributes the audit to the admin", async () => {
    expect((await call()).status).toBe(200);
    expect(mocks.dismiss).toHaveBeenCalledWith({ deadLetterId: "dl-1", reason: "fora de contexto" });
    expect(mocks.log).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "DeadLetterDismissed", userId: "admin-1" }) });
  });
});
