import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  default: {
    conversation: { findMany: vi.fn() },
    message: { findFirst: vi.fn() },
  },
}));

function conversation(id: string, lastMessageAt: Date) {
  return {
    id,
    contact: { id: `contact-${id}`, name: `Hóspede ${id}`, phone: null, lid: `lid-${id}` },
    messages: [{ content: `Mensagem ${id}`, sentAt: lastMessageAt, createdAt: lastMessageAt }],
    lastMessageAt,
    updatedAt: lastMessageAt,
    unreadCount: 0,
  };
}

describe("GET /api/crm/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.message.findFirst).mockResolvedValue(null);
  });

  it("preserves the legacy array response when pagination is not requested", async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([
      conversation("conversation-1", new Date("2026-08-05T10:00:00.000Z")),
    ] as never);

    const response = await GET(new Request("http://localhost/api/crm/conversations"));
    const body = await response.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe("conversation-1");
  });

  it("returns a stable first page and a cursor when more rows exist", async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([
      conversation("conversation-3", new Date("2026-08-05T12:00:00.000Z")),
      conversation("conversation-2", new Date("2026-08-05T11:00:00.000Z")),
      conversation("conversation-1", new Date("2026-08-05T10:00:00.000Z")),
    ] as never);

    const response = await GET(new Request("http://localhost/api/crm/conversations?limit=2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 3,
      orderBy: [
        { lastMessageAt: "desc" },
        { updatedAt: "desc" },
        { id: "desc" },
      ],
    }));
    expect(body.items.map((item: { id: string }) => item.id)).toEqual([
      "conversation-3",
      "conversation-2",
    ]);
    expect(body.pageInfo).toEqual({
      hasMore: true,
      nextCursor: "conversation-2",
    });
    expect(prisma.message.findFirst).toHaveBeenCalledTimes(2);
  });

  it("applies the cursor and reports the final page", async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([
      conversation("conversation-1", new Date("2026-08-05T10:00:00.000Z")),
    ] as never);

    const response = await GET(new Request(
      "http://localhost/api/crm/conversations?limit=2&cursor=conversation-2",
    ));
    const body = await response.json();

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { id: "conversation-2" },
      skip: 1,
      take: 3,
    }));
    expect(body.pageInfo).toEqual({ hasMore: false, nextCursor: null });
  });

  it.each([
    "limit=0",
    "limit=51",
    "limit=abc",
    "cursor=",
  ])("rejects invalid pagination parameters: %s", async (query) => {
    const response = await GET(new Request(`http://localhost/api/crm/conversations?${query}`));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "invalid_pagination" });
    expect(prisma.conversation.findMany).not.toHaveBeenCalled();
  });
});
