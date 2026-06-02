import prisma from "@/lib/prisma";

import { classifyIntent } from "@/lib/crm/aiIntentClassifier";
import { parseCrmIntent } from "@/lib/crm/intentParser";
import { updatePipelineCard } from "@/lib/crm/pipelineCards";
import { PIPELINE_STAGES } from "@/lib/crm/pipelineStages";
import { recordCrmEvent } from "@/lib/crm/events";
import { upsertReservationDraftFromMessage } from "@/lib/crm/reservationDraft";

export async function applyPipelineAutomationOnIncomingMessage(input: {
  conversationId: string;
  contactId: string;
  text?: string;
}) {
  const activeCard = await prisma.pipelineCard.findFirst({
    where: {
      conversationId: input.conversationId,
      contactId: input.contactId,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      stage: true,
    },
  });

  if (!activeCard) return;

  const text = input.text?.trim();
  if (!text) return;

  const parsed = parseCrmIntent(text);
  const classified = await classifyIntent(text);
  const minConfidence = Math.max(0.5, Number.parseFloat(process.env.CRM_AI_INTENT_MIN_CONFIDENCE ?? "0.7") || 0.7);

  await recordCrmEvent({
    action: "IntentClassified",
    contactId: input.contactId,
    conversationId: input.conversationId,
    metadata: {
      intent: classified.intent,
      confidence: classified.confidence,
      source: classified.source,
      accepted: classified.confidence >= minConfidence,
    },
  });

  if (activeCard.stage === PIPELINE_STAGES.ORCAMENTO_ENVIADO) {
    await updatePipelineCard(activeCard.id, {
      stage: PIPELINE_STAGES.AGUARDANDO_RESPOSTA,
      reason: "Cliente respondeu após envio de orçamento",
      actorType: "system",
    });
  }

  if (
    (activeCard.stage === PIPELINE_STAGES.HOSPEDADO || activeCard.stage === PIPELINE_STAGES.POS_VENDA) &&
    /\b(problema|reclam|insatisfeit|ruim|péssim|pessim)\b/i.test(text)
  ) {
    await recordCrmEvent({
      action: "PostStayIssueDetected",
      contactId: input.contactId,
      conversationId: input.conversationId,
      metadata: {
        source: "message_keyword",
      },
    });
  }

  const reservationDetected = classified.confidence >= minConfidence
    ? classified.intent === "reservation"
    : parsed.intent === "reservation";

  if (reservationDetected) {
    await upsertReservationDraftFromMessage({
      contactId: input.contactId,
      conversationId: input.conversationId,
      pipelineCardId: activeCard.id,
      text,
    });

    await recordCrmEvent({
      action: "ReservationStarted",
      contactId: input.contactId,
      conversationId: input.conversationId,
      metadata: {
        source: "message_intent",
      },
    });

    await updatePipelineCard(activeCard.id, {
      stage: PIPELINE_STAGES.RESERVA_EM_ANDAMENTO,
      reason: "Intenção de reserva detectada automaticamente",
      actorType: "system",
    });
  }
}
