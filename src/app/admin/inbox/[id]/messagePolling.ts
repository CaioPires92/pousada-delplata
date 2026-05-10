export type InboxMessage = {
    id: string;
    senderType: string;
    content: string | null;
    messageType: string;
    createdAt: string;
    sentAt: string | null;
    status?: "pending" | "sent" | "error";
};

function messageTimestamp(message: InboxMessage) {
    return new Date(message.sentAt || message.createdAt).getTime();
}

function matchesOptimisticMessage(serverMessage: InboxMessage, localMessage: InboxMessage) {
    return serverMessage.senderType === localMessage.senderType &&
        serverMessage.content === localMessage.content &&
        Math.abs(messageTimestamp(serverMessage) - messageTimestamp(localMessage)) < 60_000;
}

export function mergePolledMessages(currentMessages: InboxMessage[], serverMessages: InboxMessage[]) {
    const serverIds = new Set(serverMessages.map(message => message.id));
    const pendingLocals = currentMessages.filter(message => {
        if (message.status !== "pending" && message.status !== "error") return false;
        if (serverIds.has(message.id)) return false;

        return !serverMessages.some(serverMessage => matchesOptimisticMessage(serverMessage, message));
    });

    return [...serverMessages, ...pendingLocals].sort((a, b) => messageTimestamp(a) - messageTimestamp(b));
}
