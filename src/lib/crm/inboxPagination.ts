export type ConversationListItem = {
  id: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  name: string;
  phone: string | null;
  lid: string | null;
  unreadCount: number;
  presence?: {
    isOnline: boolean;
    typing: boolean;
    lastSeenAt: string | null;
    delivery: {
      sent: boolean;
      read: boolean;
      note: string;
    };
  };
};

export type ConversationPage = {
  items: ConversationListItem[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
};

function normalizeItem(item: unknown): ConversationListItem | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;

  return {
    id: record.id,
    lastMessage: typeof record.lastMessage === "string" ? record.lastMessage : null,
    lastMessageAt: typeof record.lastMessageAt === "string" ? record.lastMessageAt : null,
    name: record.name,
    phone: typeof record.phone === "string" ? record.phone : null,
    lid: typeof record.lid === "string" ? record.lid : null,
    unreadCount: typeof record.unreadCount === "number" ? record.unreadCount : 0,
    presence: typeof record.presence === "object" && record.presence !== null
      ? record.presence as ConversationListItem["presence"]
      : undefined,
  };
}

export function parseConversationPage(data: unknown): ConversationPage | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const pageInfo = record.pageInfo;
  if (!Array.isArray(record.items) || !pageInfo || typeof pageInfo !== "object") return null;

  const pageRecord = pageInfo as Record<string, unknown>;
  if (typeof pageRecord.hasMore !== "boolean") return null;
  if (pageRecord.nextCursor !== null && typeof pageRecord.nextCursor !== "string") return null;

  const items = record.items.map(normalizeItem).filter((item): item is ConversationListItem => item !== null);
  return {
    items,
    pageInfo: {
      hasMore: pageRecord.hasMore,
      nextCursor: pageRecord.nextCursor as string | null,
    },
  };
}

function activityTimestamp(item: ConversationListItem) {
  if (!item.lastMessageAt) return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(item.lastMessageAt).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function mergeConversationItems(
  current: ConversationListItem[],
  incoming: ConversationListItem[],
) {
  const byId = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);

  return Array.from(byId.values()).sort((left, right) => {
    const activityDifference = activityTimestamp(right) - activityTimestamp(left);
    return activityDifference || right.id.localeCompare(left.id);
  });
}
