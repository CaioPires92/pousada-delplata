const ROOM_ORDER_KEYWORDS = ['terreo', 'superior', 'chale', 'anexo'];

export function normalizeRoomName(name: string) {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

export function getRoomSortPriority(name: string) {
    const normalized = normalizeRoomName(name);
    const index = ROOM_ORDER_KEYWORDS.findIndex((keyword) => normalized.includes(keyword));
    return index >= 0 ? index : ROOM_ORDER_KEYWORDS.length;
}
