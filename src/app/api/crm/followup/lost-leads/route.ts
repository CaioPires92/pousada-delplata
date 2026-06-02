import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { resolveEvolutionSendTarget, sendEvolutionTextWithRetry } from "@/lib/whatsapp/evolution";

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

const DEFAULT_TEMPLATE = "Oi! Passando para saber se você ainda tem interesse na reserva. Se quiser, posso te enviar novas opções agora.";

export async function POST(request: Request) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const token = getBearerToken(request);

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = Boolean((body as any)?.dryRun);
  const template = typeof (body as any)?.template === "string" && (body as any).template.trim()
    ? (body as any).template.trim()
    : DEFAULT_TEMPLATE;

  const windowHours = Math.max(1, Number.parseInt(process.env.CRM_LOST_FOLLOWUP_WINDOW_HOURS ?? "72", 10) || 72);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.CRM_LOST_FOLLOWUP_MAX_ATTEMPTS ?? "2", 10) || 2);
  const threshold = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const lostCards = await prisma.pipelineCard.findMany({
    where: {
      stage: "PERDIDO",
      conversationId: { not: null },
      updatedAt: { lte: threshold },
    },
    take: 50,
    orderBy: { updatedAt: "asc" },
    include: {
      conversation: {
        include: {
          contact: {
            select: {
              id: true,
              phone: true,
              phoneRaw: true,
              whatsappJid: true,
            },
          },
        },
      },
    },
  });

  let sent = 0;
  let skippedDefinitive = 0;
  let skippedAttempts = 0;
  let skippedNoTarget = 0;

  for (const card of lostCards) {
    if (!card.conversation) continue;

    const lossText = `${card.lostReason ?? ""} ${card.lossReason ?? ""}`.toLowerCase();
    if (lossText.includes("definitiv")) {
      skippedDefinitive += 1;
      continue;
    }

    const attempts = await prisma.internalActionLog.count({
      where: {
        conversationId: card.conversation.id,
        action: "LostLeadFollowupSent",
      },
    });

    if (attempts >= maxAttempts) {
      skippedAttempts += 1;
      continue;
    }

    const target = resolveEvolutionSendTarget(card.conversation.contact);
    if (!target) {
      skippedNoTarget += 1;
      continue;
    }

    if (!dryRun) {
      const evolutionResponse = await sendEvolutionTextWithRetry({
        number: target,
        text: template,
      });

      await prisma.message.create({
        data: {
          conversationId: card.conversation.id,
          senderType: "bot",
          content: template,
          messageType: "text",
          sentAt: new Date(),
          metadataJson: JSON.stringify({
            followupType: "lost_lead",
            evolutionResponse,
          }),
        },
      });

      await prisma.conversation.update({
        where: { id: card.conversation.id },
        data: { lastMessageAt: new Date() },
      });

      await recordCrmEvent({
        action: "LostLeadFollowupSent",
        contactId: card.contactId,
        conversationId: card.conversation.id,
        metadata: {
          attempt: attempts + 1,
          maxAttempts,
          windowHours,
        },
      });
    }

    sent += 1;
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    scanned: lostCards.length,
    sent,
    skippedDefinitive,
    skippedAttempts,
    skippedNoTarget,
    config: { windowHours, maxAttempts },
  });
}
