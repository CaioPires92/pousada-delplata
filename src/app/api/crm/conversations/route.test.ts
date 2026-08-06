import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    conversationFindMany: vi.fn(),
    conversationAggregate: vi.fn(),
    conversationCount: vi.fn(),
    messageFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        conversation: {
            findMany: mocks.conversationFindMany,
            aggregate: mocks.conversationAggregate,
            count: mocks.conversationCount,
        },
        message: { findFirst: mocks.messageFindFirst },
    },
}));

import { GET } from "./route";

describe("conversation inbox metrics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.conversationFindMany.mockResolvedValue([{
            id: "conversation-1",
            chatbotEnabled: false,
            automationMode: "off",
            lastMessageAt: new Date("2026-08-06T15:00:00.000Z"),
            updatedAt: new Date("2026-08-06T15:00:00.000Z"),
            unreadCount: 1,
            awaitingHumanResponse: true,
            waitingSince: new Date("2026-08-06T15:00:00.000Z"),
            firstResponseTimeSeconds: 120,
            contact: {
                id: "contact-1",
                name: "Hóspede",
                phone: "5511999999999",
                lid: null,
            },
            messages: [{
                content: "Olá",
                sentAt: new Date("2026-08-06T15:00:00.000Z"),
                createdAt: new Date("2026-08-06T15:00:00.000Z"),
            }],
        }]);
        mocks.conversationCount.mockResolvedValue(3);
        mocks.conversationAggregate
            .mockResolvedValueOnce({
                _min: { waitingSince: new Date("2026-08-06T14:30:00.000Z") },
            })
            .mockResolvedValueOnce({ _avg: { firstResponseTimeSeconds: 95 } });
        mocks.messageFindFirst.mockResolvedValue({
            sentAt: new Date("2026-08-06T15:00:00.000Z"),
            createdAt: new Date("2026-08-06T15:00:00.000Z"),
        });
    });

    it("returns global service indicators and waiting state per conversation", async () => {
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
        expect(mocks.conversationCount).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ awaitingHumanResponse: true }),
        }));
    });
});
