import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { inferPresenceFromLastGuestMessage } from "@/lib/crm/presence";
import { resolveAutomationMode } from "@/lib/crm/automationPause";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePagination(request: Request) {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const cursorParam = searchParams.get("cursor");
    const limit = limitParam === null ? DEFAULT_LIMIT : Number(limitParam);

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return null;
    if (searchParams.has("cursor") && (!cursorParam || cursorParam.length > 100)) return null;

    return {
        limit,
        cursor: cursorParam,
        legacyResponse: !searchParams.has("limit") && !searchParams.has("cursor"),
    };
}

export async function GET(request: Request) {
    try {
        const pagination = parsePagination(request);
        if (!pagination) {
            return NextResponse.json(
                { ok: false, error: "invalid_pagination" },
                { status: 400 }
            );
        }

        const humanQueueWhere: Prisma.ConversationWhereInput = {
            awaitingHumanResponse: true,
            automationMode: { in: ["off", "supervised"] },
        };
        const [conversations, awaitingHumanCount, humanQueueMetrics, responseMetrics] = await Promise.all([
            prisma.conversation.findMany({
            orderBy: [
                { lastMessageAt: "desc" },
                { updatedAt: "desc" },
                { id: "desc" },
            ],
            take: pagination.limit + 1,
            ...(pagination.cursor
                ? { cursor: { id: pagination.cursor }, skip: 1 }
                : {}),
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        lid: true,
                    },
                },
                messages: {
                    orderBy: [
                        { sentAt: "desc" },
                        { createdAt: "desc" },
                    ],
                    take: 1,
                    select: {
                        content: true,
                        sentAt: true,
                        createdAt: true,
                    },
                },
            },
            }),
            prisma.conversation.count({ where: humanQueueWhere }),
            prisma.conversation.aggregate({
                where: humanQueueWhere,
                _min: { waitingSince: true },
            }),
            prisma.conversation.aggregate({
                where: { firstResponseTimeSeconds: { not: null } },
                _avg: { firstResponseTimeSeconds: true },
            }),
        ]);

        const hasMore = conversations.length > pagination.limit;
        const page = hasMore ? conversations.slice(0, pagination.limit) : conversations;

        const latestGuestByConversation = await Promise.all(
            page.map(async (conversation) => {
                const latestGuest = await prisma.message.findFirst({
                    where: {
                        conversationId: conversation.id,
                        senderType: "guest",
                    },
                    orderBy: [
                        { sentAt: "desc" },
                        { createdAt: "desc" },
                    ],
                    select: {
                        sentAt: true,
                        createdAt: true,
                    },
                });

                return {
                    conversationId: conversation.id,
                    lastGuestAt: latestGuest?.sentAt ?? latestGuest?.createdAt ?? null,
                };
            })
        );

        const latestGuestMap = new Map(
            latestGuestByConversation.map((item) => [item.conversationId, item.lastGuestAt])
        );

        const items = page.map((c) => ({
                id: c.id,
                name: c.contact?.name || "Sem nome",
                phone: c.contact?.phone || null,
                lid: c.contact?.lid || null,
                lastMessage: c.messages[0]?.content || null,
                lastMessageAt: c.lastMessageAt ?? c.messages[0]?.sentAt ?? c.messages[0]?.createdAt ?? null,
                unreadCount: c.unreadCount,
                waitingSince: c.awaitingHumanResponse && resolveAutomationMode(c) !== "auto"
                    ? c.waitingSince
                    : null,
                firstResponseTimeSeconds: c.firstResponseTimeSeconds,
                presence: inferPresenceFromLastGuestMessage(latestGuestMap.get(c.id) ?? null),
            }));

        if (pagination.legacyResponse) return NextResponse.json(items);

        return NextResponse.json({
            items,
            metrics: {
                awaitingHumanCount,
                oldestWaitingSince: humanQueueMetrics._min.waitingSince,
                averageFirstResponseSeconds: responseMetrics._avg.firstResponseTimeSeconds,
            },
            pageInfo: {
                hasMore,
                nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
            },
        });
    } catch (error) {
        console.error("Erro ao listar conversas:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}
