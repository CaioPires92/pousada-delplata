import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { enqueueAutomationJob } from "@/lib/crm/automationQueue";
import { recordCrmEvent } from "@/lib/crm/events";

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function inAllowedHourWindow(startHour: number, endHour: number) {
  const now = new Date();
  const hour = now.getHours();
  if (startHour <= endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export async function POST(request: Request) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const token = getBearerToken(request);

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const text = asNonEmptyString(body?.text);
  const stage = asNonEmptyString(body?.stage);
  const dryRun = Boolean(body?.dryRun ?? true);
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(body?.limit ?? "50"), 10) || 50));
  const startHour = Math.min(23, Math.max(0, Number.parseInt(String(body?.startHour ?? "9"), 10) || 9));
  const endHour = Math.min(24, Math.max(1, Number.parseInt(String(body?.endHour ?? "20"), 10) || 20));

  if (!text) {
    return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD", message: "Informe text" }, { status: 400 });
  }

  if (!inAllowedHourWindow(startHour, endHour)) {
    return NextResponse.json({
      ok: false,
      error: "OUTSIDE_WINDOW",
      message: "Fora da janela de envio configurada",
      window: { startHour, endHour },
    }, { status: 409 });
  }

  const cards = await prisma.pipelineCard.findMany({
    where: {
      ...(stage ? { stage } : {}),
      contact: {
        optOutAt: null,
        optInWhatsapp: true,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          phone: true,
          phoneRaw: true,
          whatsappJid: true,
          optOutAt: true,
          optInWhatsapp: true,
        },
      },
    },
  });

  const preview = cards.map(card => ({
    pipelineCardId: card.id,
    contactId: card.contactId,
    name: card.contact.name,
    target: card.contact.whatsappJid || card.contact.phone || card.contact.phoneRaw,
    stage: card.stage,
  }));

  if (dryRun) {
    await recordCrmEvent({
      action: "BroadcastPreviewGenerated",
      metadata: {
        stage: stage ?? null,
        limit,
        recipients: preview.length,
      },
    });

    return NextResponse.json({
      ok: true,
      dryRun: true,
      recipients: preview.length,
      preview,
      window: { startHour, endHour },
    });
  }

  let enqueued = 0;

  for (const card of cards) {
    const target = card.contact.whatsappJid || card.contact.phone || card.contact.phoneRaw;
    if (!target) continue;

    let conversationId = card.conversationId;

    if (!conversationId) {
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          contactId: card.contactId,
          channel: "whatsapp",
          status: "open",
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });

      if (existingConversation) {
        conversationId = existingConversation.id;
      } else {
        const created = await prisma.conversation.create({
          data: {
            contactId: card.contactId,
            channel: "whatsapp",
            status: "open",
            chatbotEnabled: true,
          },
          select: { id: true },
        });
        conversationId = created.id;
      }
    }

    await enqueueAutomationJob({
      conversationId,
      action: "SEND_WHATSAPP_MESSAGE",
      payload: {
        target,
        text,
      },
    });

    enqueued += 1;
  }

  await recordCrmEvent({
    action: "BroadcastEnqueued",
    metadata: {
      stage: stage ?? null,
      limit,
      enqueued,
      window: { startHour, endHour },
    },
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    requested: cards.length,
    enqueued,
    window: { startHour, endHour },
  });
}
