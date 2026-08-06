import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import { buildAuditMetadata } from "@/lib/crm/audit";
import prisma from "@/lib/prisma";

type RouteParams = {
    params: Promise<{ id: string }>;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as JsonRecord
        : undefined;
}

export async function GET(_request: Request, { params }: RouteParams) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;
        const conversation = await prisma.conversation.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!conversation) {
            return NextResponse.json({ ok: false, error: "conversation_not_found" }, { status: 404 });
        }

        const notes = await prisma.internalNote.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                authorId: true,
                content: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return NextResponse.json({ ok: true, notes });
    } catch (error) {
        console.error("Erro ao buscar notas internas:", error);
        return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: RouteParams) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;
        const body = asRecord(await request.json().catch(() => null));
        const content = typeof body?.content === "string" ? body.content.trim() : "";
        if (!content || content.length > 2_000) {
            return NextResponse.json({ ok: false, error: "invalid_note_content" }, { status: 400 });
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id },
            select: { id: true, contactId: true },
        });
        if (!conversation) {
            return NextResponse.json({ ok: false, error: "conversation_not_found" }, { status: 404 });
        }

        const note = await prisma.$transaction(async (tx) => {
            const createdNote = await tx.internalNote.create({
                data: {
                    conversationId: id,
                    authorId: auth.adminId,
                    content,
                },
                select: {
                    id: true,
                    authorId: true,
                    content: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            await tx.internalActionLog.create({
                data: {
                    action: "InternalNoteCreated",
                    contactId: conversation.contactId,
                    conversationId: id,
                    metadataJson: JSON.stringify({
                        noteId: createdNote.id,
                        contentLength: content.length,
                        ...buildAuditMetadata({
                            actorType: "human",
                            origin: "admin_ui",
                            actorId: auth.adminId,
                        }),
                    }),
                },
            });

            return createdNote;
        });

        return NextResponse.json({ ok: true, note }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar nota interna:", error);
        return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
    }
}
