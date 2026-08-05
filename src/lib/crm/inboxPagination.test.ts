import { describe, expect, it } from "vitest";

import { mergeConversationItems, parseConversationPage, type ConversationListItem } from "./inboxPagination";

function item(id: string, lastMessageAt: string): ConversationListItem {
  return {
    id,
    name: id,
    phone: null,
    lid: null,
    lastMessage: null,
    lastMessageAt,
    unreadCount: 0,
  };
}

describe("Inbox pagination client contract", () => {
  it("parses a valid page and normalizes optional fields", () => {
    expect(parseConversationPage({
      items: [{ id: "conversation-1", name: "Hóspede" }],
      pageInfo: { hasMore: true, nextCursor: "conversation-1" },
    })).toEqual({
      items: [{
        id: "conversation-1",
        name: "Hóspede",
        phone: null,
        lid: null,
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0,
        presence: undefined,
      }],
      pageInfo: { hasMore: true, nextCursor: "conversation-1" },
    });
  });

  it("rejects malformed page metadata", () => {
    expect(parseConversationPage({ items: [], pageInfo: { hasMore: "yes", nextCursor: null } })).toBeNull();
  });

  it("merges refreshed and paginated rows without duplicates in activity order", () => {
    const merged = mergeConversationItems(
      [
        item("conversation-2", "2026-08-05T11:00:00.000Z"),
        item("conversation-1", "2026-08-05T10:00:00.000Z"),
      ],
      [
        item("conversation-3", "2026-08-05T12:00:00.000Z"),
        item("conversation-2", "2026-08-05T13:00:00.000Z"),
      ],
    );

    expect(merged.map(row => row.id)).toEqual([
      "conversation-2",
      "conversation-3",
      "conversation-1",
    ]);
  });
});
