import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createAutomationPausedUntil, isConversationAutomationActive } from "@/lib/crm/automationPause";
import { enqueueAutomationJob, processNextAutomationJobForConversation } from "@/lib/crm/automationQueue";
import { buildAuditMetadata } from "@/lib/crm/audit";
import { cacheIncrWithTtl } from "@/lib/crm/cacheStore";
import { recordCrmEvent } from "@/lib/crm/events";
import { updatePipelineCard } from "@/lib/crm/pipelineCards";
import { resolveEvolutionSendTarget, sendEvolutionTextWithRetry } from "@/lib/whatsapp/evolution";

export const runtime = "nodejs";

type InternalAction =
  | "MOVE_PIPELINE_CARD"
  | "SEND_WHATSAPP_MESSAGE"
  | "PAUSE_AUTOMATION"
  | "SET_CONVERSATION_AUTOMATION_PAUSED"
  | "UPDATE_LEAD_FIELDS"
  | "ADD_CARD_NOTE"
  | "SET_CARD_TAGS"
  | "CREATE_FOLLOW_UP_TASK"
  | "MARK_QUOTE_SENT"
  | "MARK_RESERVATION_INTENT"
  | "MARK_PAYMENT_PENDING"
  | "MARK_RESERVATION_CONFIRMED"
  | "REGISTER_UPSELL_OFFER"
  | "REGISTER_UPSELL_ACCEPTED"
  | "REGISTER_UPSELL_REJECTED";

type JsonRecord = Record<string, unknown>;

const SUPPORTED_ACTIONS = new Set<InternalAction>([
  "MOVE_PIPELINE_CARD",
  "SEND_WHATSAPP_MESSAGE",
  "PAUSE_AUTOMATION",
  "SET_CONVERSATION_AUTOMATION_PAUSED",
  "UPDATE_LEAD_FIELDS",
  "ADD_CARD_NOTE",
  "SET_CARD_TAGS",
  "CREATE_FOLLOW_UP_TASK",
  "MARK_QUOTE_SENT",
  "MARK_RESERVATION_INTENT",
  "MARK_PAYMENT_PENDING",
  "MARK_RESERVATION_CONFIRMED",
  "REGISTER_UPSELL_OFFER",
  "REGISTER_UPSELL_ACCEPTED",
  "REGISTER_UPSELL_REJECTED",
]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;

  return authorization.slice("Bearer ".length).trim() || undefined;
}

function getInternalToken(request: Request): string | undefined {
  return getBearerToken(request) || asNonEmptyString(request.headers.get("x-internal-token"));
}

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

async function enforceConversationActionRateLimit(conversationId: string) {
  const maxActionsPerMinute = Math.max(3, Number.parseInt(process.env.CRM_ACTION_RATE_LIMIT_PER_MINUTE ?? "12", 10) || 12);
  const rateKey = `crm:rate:conversation:${conversationId}`;

  const recentCount = await cacheIncrWithTtl(rateKey, 60);

  if (recentCount >= maxActionsPerMinute) {
    return {
      ok: false as const,
      response: jsonError(429, "RATE_LIMITED", "Limite temporário de ações por conversa atingido"),
    };
  }

  return { ok: true as const };
}

function extractEvolutionMessageId(response: unknown): string | null {
  if (!isRecord(response)) return null;

  const data = isRecord(response.data) ? response.data : undefined;
  const key = isRecord(response.key) ? response.key : isRecord(data?.key) ? data.key : undefined;

  return asNonEmptyString(response.id) ??
    asNonEmptyString(response.messageId) ??
    asNonEmptyString(data?.id) ??
    asNonEmptyString(data?.messageId) ??
    asNonEmptyString(key?.id) ??
    null;
}

async function handleMovePipelineCard(payload: JsonRecord) {
  const pipelineCardId = asNonEmptyString(payload.pipelineCardId);
  const toStage = asNonEmptyString(payload.toStage);
  const reason = asNonEmptyString(payload.reason);

  if (!pipelineCardId || !toStage) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe pipelineCardId e toStage");
  }

  const existingCard = await prisma.pipelineCard.findUnique({
    where: { id: pipelineCardId },
    select: { conversationId: true },
  });

  if (existingCard?.conversationId) {
    const rateLimit = await enforceConversationActionRateLimit(existingCard.conversationId);
    if (!rateLimit.ok) return rateLimit.response;
  }

  const result = await updatePipelineCard(pipelineCardId, {
    stage: toStage,
    reason: reason ?? "Moved via internal action",
    actorType: "n8n",
  });

  if (!result.ok) {
    const error = result.error === "card_not_found" ? "NOT_FOUND" : "INVALID_PAYLOAD";
    const message = result.error === "card_not_found" ? "Card não encontrado" : "Payload inválido";
    return jsonError(result.status, error, message);
  }

  return NextResponse.json({
    ok: true,
    action: "MOVE_PIPELINE_CARD",
    result: {
      pipelineCardId: result.card.id,
      stage: result.card.stage,
      stageChanged: result.stageChanged,
    },
  });
}

async function handleUpdateLeadFields(payload: JsonRecord) {
  const pipelineCardId = asNonEmptyString(payload.pipelineCardId);

  if (!pipelineCardId) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe pipelineCardId");
  }

  const existingCard = await prisma.pipelineCard.findUnique({
    where: { id: pipelineCardId },
    select: { conversationId: true },
  });

  if (existingCard?.conversationId) {
    const rateLimit = await enforceConversationActionRateLimit(existingCard.conversationId);
    if (!rateLimit.ok) return rateLimit.response;
  }

  const fields = { ...payload };
  delete fields.pipelineCardId;

  if (Object.keys(fields).length === 0) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe ao menos um campo para atualizar");
  }

  const result = await updatePipelineCard(pipelineCardId, {
    ...fields,
    actorType: "n8n",
  });

  if (!result.ok) {
    const error = result.error === "card_not_found" ? "NOT_FOUND" : "INVALID_PAYLOAD";
    const message = result.error === "card_not_found" ? "Card não encontrado" : "Payload inválido";
    return jsonError(result.status, error, message);
  }

  return NextResponse.json({
    ok: true,
    action: "UPDATE_LEAD_FIELDS",
    result: {
      pipelineCardId: result.card.id,
      updatedFields: Object.keys(fields),
    },
  });
}

async function handlePauseAutomation(payload: JsonRecord) {
  const conversationId = asNonEmptyString(payload.conversationId);
  const minutes = typeof payload.minutes === "number" && Number.isInteger(payload.minutes) && payload.minutes > 0
    ? payload.minutes
    : undefined;
  const reason = asNonEmptyString(payload.reason);

  if (!conversationId || !minutes) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe conversationId e minutes");
  }

  const rateLimit = await enforceConversationActionRateLimit(conversationId);
  if (!rateLimit.ok) return rateLimit.response;

  const existingConversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      contactId: true,
    },
  });

  if (!existingConversation) {
    return jsonError(404, "NOT_FOUND", "Conversa não encontrada");
  }

  const pausedUntil = createAutomationPausedUntil(new Date(), minutes);
  const conversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: { automationPausedUntil: pausedUntil },
    select: {
      id: true,
      contactId: true,
      automationPausedUntil: true,
    },
  });

  await recordCrmEvent({
    action: "AutomationPaused",
    contactId: conversation.contactId,
    conversationId: conversation.id,
    metadata: {
      ...buildAuditMetadata({
        actorType: "n8n",
        origin: "n8n_api",
        reason: reason ?? "Paused via internal action",
      }),
      durationMinutes: minutes,
      pausedUntil: pausedUntil.toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    action: "PAUSE_AUTOMATION",
    result: {
      conversationId: conversation.id,
      pausedUntil: conversation.automationPausedUntil,
    },
  });
}

async function handleAddCardNote(payload: JsonRecord) {
  const pipelineCardId = asNonEmptyString(payload.pipelineCardId);
  const content = asNonEmptyString(payload.content);

  if (!pipelineCardId || !content) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe pipelineCardId e content");
  }

  const card = await prisma.pipelineCard.findUnique({
    where: { id: pipelineCardId },
    select: { conversationId: true, contactId: true },
  });

  if (!card) {
    return jsonError(404, "NOT_FOUND", "Card não encontrado");
  }

  if (!card.conversationId) {
    return jsonError(400, "INVALID_STATE", "Card sem conversa associada");
  }

  const note = await prisma.internalNote.create({
    data: {
      conversationId: card.conversationId,
      content,
      authorId: "n8n",
    },
  });

  await recordCrmEvent({
    action: "CardNoteAdded",
    contactId: card.contactId,
    conversationId: card.conversationId,
    metadata: {
      ...buildAuditMetadata({ actorType: "n8n", origin: "n8n_api" }),
      pipelineCardId,
      noteId: note.id,
    },
  });

  return NextResponse.json({
    ok: true,
    action: "ADD_CARD_NOTE",
    result: { noteId: note.id },
  });
}

async function handleSetCardTags(payload: JsonRecord) {
  const pipelineCardId = asNonEmptyString(payload.pipelineCardId);
  const tags = asNonEmptyString(payload.tags);

  if (!pipelineCardId || tags === undefined) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe pipelineCardId e tags");
  }

  const card = await prisma.pipelineCard.update({
    where: { id: pipelineCardId },
    data: { tags },
    select: { id: true, conversationId: true, contactId: true },
  });

  await recordCrmEvent({
    action: "CardTagsUpdated",
    contactId: card.contactId,
    conversationId: card.conversationId ?? undefined,
    metadata: {
      ...buildAuditMetadata({ actorType: "n8n", origin: "n8n_api" }),
      pipelineCardId,
      tags,
    },
  });

  return NextResponse.json({
    ok: true,
    action: "SET_CARD_TAGS",
    result: { pipelineCardId: card.id, tags },
  });
}

async function handleCreateFollowUpTask(payload: JsonRecord) {
  const pipelineCardId = asNonEmptyString(payload.pipelineCardId);
  const followUpAtStr = asNonEmptyString(payload.followUpAt);

  if (!pipelineCardId || !followUpAtStr) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe pipelineCardId e followUpAt (ISO)");
  }

  const followUpAt = new Date(followUpAtStr);
  if (isNaN(followUpAt.getTime())) {
    return jsonError(400, "INVALID_PAYLOAD", "Data followUpAt inválida");
  }

  const card = await prisma.pipelineCard.update({
    where: { id: pipelineCardId },
    data: { followUpAt },
    select: { id: true, conversationId: true, contactId: true, followUpAt: true },
  });

  await recordCrmEvent({
    action: "FollowUpScheduled",
    contactId: card.contactId,
    conversationId: card.conversationId ?? undefined,
    metadata: {
      ...buildAuditMetadata({ actorType: "n8n", origin: "n8n_api" }),
      pipelineCardId,
      followUpAt: followUpAt.toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    action: "CREATE_FOLLOW_UP_TASK",
    result: { pipelineCardId: card.id, followUpAt: card.followUpAt },
  });
}

async function handleMarkState(payload: JsonRecord, stage: string, actionName: string) {
  const pipelineCardId = asNonEmptyString(payload.pipelineCardId);
  const reason = asNonEmptyString(payload.reason) ?? `Marked as ${stage} via n8n`;

  if (!pipelineCardId) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe pipelineCardId");
  }

  const result = await updatePipelineCard(pipelineCardId, {
    stage,
    reason,
    actorType: "n8n",
  });

  if (!result.ok) {
    return jsonError(result.status, "UPDATE_FAILED", result.error || "Falha ao atualizar card");
  }

  return NextResponse.json({
    ok: true,
    action: actionName,
    result: {
      pipelineCardId: result.card.id,
      stage: result.card.stage,
      stageChanged: result.stageChanged,
    },
  });
}

async function handleSendWhatsAppMessage(payload: JsonRecord) {
  const conversationId = asNonEmptyString(payload.conversationId);
  const text = asNonEmptyString(payload.text);

  if (!conversationId || !text) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe conversationId e text");
  }

  const rateLimit = await enforceConversationActionRateLimit(conversationId);
  if (!rateLimit.ok) return rateLimit.response;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: {
        select: {
          phone: true,
          phoneRaw: true,
          whatsappJid: true,
        },
      },
    },
  });

  if (!conversation) {
    return jsonError(404, "NOT_FOUND", "Conversa não encontrada");
  }

  if (!isConversationAutomationActive(conversation)) {
    return jsonError(409, "AUTOMATION_PAUSED", "Automação desligada ou pausada para esta conversa");
  }

  const target = resolveEvolutionSendTarget(conversation.contact);
  if (!target) {
    return jsonError(400, "INVALID_PAYLOAD", "Contato sem destino WhatsApp válido");
  }

  await enqueueAutomationJob({
    conversationId: conversation.id,
    action: "SEND_WHATSAPP_MESSAGE",
    payload: { target, text },
  });

  const processingResult = await processNextAutomationJobForConversation(conversation.id, async job => {
    if (job.action !== "SEND_WHATSAPP_MESSAGE" || !job.payload.text || !job.payload.target) {
      throw new Error("invalid_queue_payload");
    }

    const evolutionResponse = await sendEvolutionTextWithRetry({
      number: job.payload.target,
      text: job.payload.text,
    });
    const now = new Date();

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        externalMessageId: extractEvolutionMessageId(evolutionResponse),
        senderType: "bot",
        content: job.payload.text,
        messageType: "text",
        sentAt: now,
        metadataJson: JSON.stringify({
          actorType: "n8n",
          evolutionResponse,
          queueJobId: job.id,
        }),
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });

    await recordCrmEvent({
      action: "WhatsAppMessageSent",
      contactId: conversation.contactId,
      conversationId: conversation.id,
      metadata: {
        ...buildAuditMetadata({
          actorType: "n8n",
          origin: "n8n_api",
        }),
        messageId: message.id,
        externalMessageId: message.externalMessageId,
        target: job.payload.target,
        queueJobId: job.id,
      },
    });
  });

  if (!processingResult.ok) {
    return NextResponse.json({
      ok: true,
      action: "SEND_WHATSAPP_MESSAGE",
      result: {
        conversationId: conversation.id,
        queued: true,
        processedNow: processingResult.processed,
        queueJobId: processingResult.jobId ?? null,
        deliveryStatus: "queued_failed",
        queueError: processingResult.error ?? "unknown_queue_error",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    action: "SEND_WHATSAPP_MESSAGE",
    result: {
      conversationId: conversation.id,
      queued: true,
      processedNow: processingResult.processed,
      queueJobId: processingResult.jobId ?? null,
      deliveryStatus: "sent",
    },
  });
}

export async function POST(request: Request) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const token = getInternalToken(request);

  if (!expectedToken || token !== expectedToken) {
    return jsonError(401, "UNAUTHORIZED", "Token não fornecido ou inválido");
  }

  try {
    const body = await request.json().catch(() => null);

    if (!isRecord(body) || !isRecord(body.payload)) {
      return jsonError(400, "INVALID_PAYLOAD", "Payload com formato incorreto");
    }

    const action = asNonEmptyString(body.action) as InternalAction | undefined;

    if (!action || !SUPPORTED_ACTIONS.has(action)) {
      return jsonError(400, "INVALID_ACTION", "Ação não suportada");
    }

    switch (action) {
      case "MOVE_PIPELINE_CARD":
        return handleMovePipelineCard(body.payload);
      case "SEND_WHATSAPP_MESSAGE":
        return handleSendWhatsAppMessage(body.payload);
      case "PAUSE_AUTOMATION":
      case "SET_CONVERSATION_AUTOMATION_PAUSED":
        return handlePauseAutomation(body.payload);
      case "UPDATE_LEAD_FIELDS":
        return handleUpdateLeadFields(body.payload);
      case "ADD_CARD_NOTE":
        return handleAddCardNote(body.payload);
      case "SET_CARD_TAGS":
        return handleSetCardTags(body.payload);
      case "CREATE_FOLLOW_UP_TASK":
        return handleCreateFollowUpTask(body.payload);
      case "MARK_QUOTE_SENT":
        return handleMarkState(body.payload, "ORCAMENTO_ENVIADO", "MARK_QUOTE_SENT");
      case "MARK_RESERVATION_INTENT":
        return handleMarkState(body.payload, "RESERVA_EM_ANDAMENTO", "MARK_RESERVATION_INTENT");
      case "MARK_PAYMENT_PENDING":
        return handleMarkState(body.payload, "PAGAMENTO_PENDENTE", "MARK_PAYMENT_PENDING");
      case "MARK_RESERVATION_CONFIRMED":
        return handleMarkState(body.payload, "RESERVA_CONFIRMADA", "MARK_RESERVATION_CONFIRMED");
      case "REGISTER_UPSELL_OFFER":
        return handleUpdateLeadFields({ ...body.payload, upsellStatus: "ofertado" });
      case "REGISTER_UPSELL_ACCEPTED":
        return handleUpdateLeadFields({ ...body.payload, upsellStatus: "aceito" });
      case "REGISTER_UPSELL_REJECTED":
        return handleUpdateLeadFields({ ...body.payload, upsellStatus: "recusado" });
    }
  } catch (error) {
    console.error("[CRM_INTERNAL_ACTION] Error:", error);
    return jsonError(500, "INTERNAL_ERROR", "Erro interno no servidor");
  }
}
