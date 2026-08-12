import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ requireAdminAuth: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));
vi.mock("@/lib/prisma", () => ({ default: { deadLetterQueueItem: { findMany: mocks.findMany } } }));

import { GET } from "./route";

describe("admin dead-letter listing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ adminId: "admin-1" });
    mocks.findMany.mockResolvedValue([{ id: "dl-1", status: "open" }]);
  });

  it("requires an authenticated admin", async () => {
    mocks.requireAdminAuth.mockResolvedValue(NextResponse.json({ ok: false }, { status: 401 }));
    expect((await GET(new Request("http://localhost/api/admin/crm/dead-letter"))).status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("lists open items by default without selecting payloadJson", async () => {
    const response = await GET(new Request("http://localhost/api/admin/crm/dead-letter"));
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "open" },
      take: 100,
      select: expect.not.objectContaining({ payloadJson: true }),
    }));
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: "open" });
  });

  it("rejects unknown status filters", async () => {
    expect((await GET(new Request("http://localhost/api/admin/crm/dead-letter?status=invalid"))).status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
