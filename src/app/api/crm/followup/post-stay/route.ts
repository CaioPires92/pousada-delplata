import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { sendEvolutionTextWithRetry, resolveEvolutionSendTarget } from "@/lib/whatsapp/evolution";

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

const DEFAULT_MESSAGE = "Obrigado por se hospedar com a gente! Se puder, nos deixe uma avaliação. Se houve qualquer problema, responda esta mensagem que vamos te atender com prioridade.";

export async function POST(request: Request) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const token = getBearerToken(request);

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = Boolean((body as any).dryRun);
  const max = Math.min(100, Math.max(1, Number.parseInt(String((body as any).limit ?? "20"), 10) || 20));
  const message = typeof (body as any).message === "string" && (body as any).message.trim()
    ? (body as any).message.trim()
    : DEFAULT_MESSAGE;

  const cards = await prisma.pipelineCard.findMany({
    where: {
      stage: "HOSPEDADO",
      contact: {
        optOutAt: null,
        optInWhatsapp: true,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: max,
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
  });

  let sent = 0;
  let skippedNoTarget = 0;
  let skippedAttempts = 0;

  for (const card of cards) {
    const attempts = await prisma.internalActionLog.count({
      where: {
        contactId: card.contactId,
        action: "PostStayFollowupSent",
      },
    });

    if (attempts >= 1) {
      skippedAttempts += 1;
      continue;
    }

    const target = resolveEvolutionSendTarget(card.contact);
    if (!target) {
      skippedNoTarget += 1;
      continue;
    }

    if (!dryRun) {
      const evolutionResponse = await sendEvolutionTextWithRetry({ number: target, text: message });

      const conversation = await prisma.conversation.findFirst({
        where: {
          contactId: card.contactId,
          channel: "whatsapp",
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });

      if (conversation) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderType: "bot",
            content: message,
            messageType: "text",
            sentAt: new Date(),
            metadataJson: JSON.stringify({ followupType: "post_stay", evolutionResponse }),
          },
        });
      }

      await recordCrmEvent({
        action: "PostStayFollowupSent",
        contactId: card.contactId,
        conversationId: conversation?.id,
        metadata: {
          stage: card.stage,
        },
      });
    }

    sent += 1;
  }

  return NextResponse.json({ ok: true, dryRun, scanned: cards.length, sent, skippedNoTarget, skippedAttempts });
}
