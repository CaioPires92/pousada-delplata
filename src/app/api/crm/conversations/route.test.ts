import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  default: {
    conversation: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
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
    chatbotEnabled: false,
    automationMode: "off",
    awaitingHumanResponse: false,
    waitingSince: null,
    firstResponseTimeSeconds: null,
  };
}

describe("GET /api/crm/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.message.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.conversation.count).mockResolvedValue(0);
    vi.mocked(prisma.conversation.aggregate)
      .mockResolvedValueOnce({ _min: { waitingSince: null } } as never)
      .mockResolvedValueOnce({ _avg: { firstResponseTimeSeconds: null } } as never);
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

  it("returns global service indicators and waiting state per conversation", async () => {
    const waiting = {
      ...conversation("conversation-1", new Date("2026-08-06T15:00:00.000Z")),
      awaitingHumanResponse: true,
      waitingSince: new Date("2026-08-06T15:00:00.000Z"),
      firstResponseTimeSeconds: 120,
    };
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([waiting] as never);
    vi.mocked(prisma.conversation.count).mockResolvedValue(3);
    vi.mocked(prisma.conversation.aggregate).mockReset()
      .mockResolvedValueOnce({
        _min: { waitingSince: new Date("2026-08-06T14:30:00.000Z") },
      } as never)
      .mockResolvedValueOnce({ _avg: { firstResponseTimeSeconds: 95 } } as never);

    const response = await GET(new Request("http://localhost/api/crm/conversations?limit=20"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{
        id: "conversation-1",
        waitingSince: "2026-08-06T15:00:00.000Z",
        firstResponseTimeSeconds: 120,
      }],
      metrics: {
        awaitingHumanCount: 3,
        oldestWaitingSince: "2026-08-06T14:30:00.000Z",
        averageFirstResponseSeconds: 95,
      },
    });
    expect(prisma.conversation.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ awaitingHumanResponse: true }),
    }));
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
