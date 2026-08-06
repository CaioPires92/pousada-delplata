type ResponseMetricState = {
    lastCustomerMessageAt: Date | null;
    lastHumanMessageAt: Date | null;
    firstCustomerMessageAt: Date | null;
    firstHumanResponseAt: Date | null;
};

export function buildConversationResponseMetricUpdate(input: {
    senderType: "guest" | "human" | "bot";
    occurredAt: Date;
    state: ResponseMetricState;
}) {
    const { senderType, occurredAt, state } = input;

    if (senderType === "guest") {
        const isLatestCustomerMessage = !state.lastCustomerMessageAt
            || occurredAt > state.lastCustomerMessageAt;
        return {
            ...(isLatestCustomerMessage ? {
                lastCustomerMessageAt: occurredAt,
                awaitingHumanResponse: true,
                waitingSince: occurredAt,
            } : {}),
            ...(!state.firstCustomerMessageAt || occurredAt < state.firstCustomerMessageAt
                ? { firstCustomerMessageAt: occurredAt }
                : {}),
        };
    }

    if (senderType !== "human") return {};

    const isLatestHumanMessage = !state.lastHumanMessageAt || occurredAt > state.lastHumanMessageAt;
    const answersCurrentWait = Boolean(
        state.lastCustomerMessageAt && occurredAt >= state.lastCustomerMessageAt
    );
    const isEarlierValidFirstResponse = Boolean(
        state.firstCustomerMessageAt
        && occurredAt >= state.firstCustomerMessageAt
        && (!state.firstHumanResponseAt || occurredAt < state.firstHumanResponseAt)
    );

    return {
        ...(isLatestHumanMessage ? { lastHumanMessageAt: occurredAt } : {}),
        ...(answersCurrentWait ? { awaitingHumanResponse: false, waitingSince: null } : {}),
        ...(isEarlierValidFirstResponse && state.firstCustomerMessageAt ? {
            firstHumanResponseAt: occurredAt,
            firstResponseTimeSeconds: Math.max(
                0,
                Math.floor((occurredAt.getTime() - state.firstCustomerMessageAt.getTime()) / 1_000)
            ),
        } : {}),
    };
}
