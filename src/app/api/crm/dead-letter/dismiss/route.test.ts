import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dismiss: vi.fn(), createLog: vi.fn() }));
vi.mock("@/lib/crm/automationQueue", () => ({ dismissDeadLetterItem: mocks.dismiss }));
vi.mock("@/lib/prisma", () => ({ default: { internalActionLog: { create: mocks.createLog } } }));

import { POST } from "./route";

function request(token = "secret", body: unknown = { deadLetterId: "dl-1", reason: "mensagem antiga" }) {
  return new Request("http://localhost/api/crm/dead-letter/dismiss", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("dead-letter dismiss API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRM_INTERNAL_API_TOKEN = "secret";
    mocks.dismiss.mockResolvedValue({ ok: true, dismissed: true });
    mocks.createLog.mockResolvedValue({});
  });

  it("requires the internal token and a reason", async () => {
    expect((await POST(request("wrong"))).status).toBe(401);
    expect((await POST(request("secret", { deadLetterId: "dl-1" }))).status).toBe(400);
    expect(mocks.dismiss).not.toHaveBeenCalled();
  });

  it("dismisses without replay and records an audit event", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.dismiss).toHaveBeenCalledWith({ deadLetterId: "dl-1", reason: "mensagem antiga" });
    expect(mocks.createLog).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "DeadLetterDismissed" }) });
  });
});
