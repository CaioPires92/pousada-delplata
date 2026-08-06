import { describe, expect, it } from "vitest";

import { buildConversationResponseMetricUpdate } from "./responseMetrics";

const emptyState = {
    lastCustomerMessageAt: null,
    lastHumanMessageAt: null,
    firstCustomerMessageAt: null,
    firstHumanResponseAt: null,
};

describe("conversation response metrics", () => {
    it("starts a human waiting interval on a guest message", () => {
        const occurredAt = new Date("2026-08-06T15:00:00.000Z");
        expect(buildConversationResponseMetricUpdate({
            senderType: "guest",
            occurredAt,
            state: emptyState,
        })).toEqual({
            lastCustomerMessageAt: occurredAt,
            firstCustomerMessageAt: occurredAt,
            awaitingHumanResponse: true,
            waitingSince: occurredAt,
        });
    });

    it("records the first human response and closes the current wait", () => {
        const firstCustomerMessageAt = new Date("2026-08-06T15:00:00.000Z");
        const occurredAt = new Date("2026-08-06T15:02:30.000Z");
        expect(buildConversationResponseMetricUpdate({
            senderType: "human",
            occurredAt,
            state: {
                ...emptyState,
                firstCustomerMessageAt,
                lastCustomerMessageAt: firstCustomerMessageAt,
            },
        })).toEqual({
            lastHumanMessageAt: occurredAt,
            firstHumanResponseAt: occurredAt,
            firstResponseTimeSeconds: 150,
            awaitingHumanResponse: false,
            waitingSince: null,
        });
    });

    it("does not let delayed events regress the active wait", () => {
        expect(buildConversationResponseMetricUpdate({
            senderType: "human",
            occurredAt: new Date("2026-08-06T15:01:00.000Z"),
            state: {
                lastCustomerMessageAt: new Date("2026-08-06T15:03:00.000Z"),
                lastHumanMessageAt: new Date("2026-08-06T15:02:00.000Z"),
                firstCustomerMessageAt: new Date("2026-08-06T15:00:00.000Z"),
                firstHumanResponseAt: new Date("2026-08-06T15:02:00.000Z"),
            },
        })).toEqual({
            firstHumanResponseAt: new Date("2026-08-06T15:01:00.000Z"),
            firstResponseTimeSeconds: 60,
        });
    });

    it("ignores bot messages for human service metrics", () => {
        expect(buildConversationResponseMetricUpdate({
            senderType: "bot",
            occurredAt: new Date(),
            state: emptyState,
        })).toEqual({});
    });
});
