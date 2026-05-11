import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createAutomationPausedUntil, isConversationAutomationActive } from "@/lib/crm/automationPause";
import { recordCrmEvent } from "@/lib/crm/events";
import { updatePipelineCard } from "@/lib/crm/pipelineCards";
import { resolveEvolutionSendTarget, sendEvolutionText } from "@/lib/whatsapp/evolution";

type InternalAction =
  | "MOVE_PIPELINE_CARD"
  | "SEND_WHATSAPP_MESSAGE"
  | "PAUSE_AUTOMATION"
  | "UPDATE_LEAD_FIELDS";

type JsonRecord = Record<string, unknown>;

const SUPPORTED_ACTIONS = new Set<InternalAction>([
  "MOVE_PIPELINE_CARD",
  "SEND_WHATSAPP_MESSAGE",
  "PAUSE_AUTOMATION",
  "UPDATE_LEAD_FIELDS",
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

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ ok: false, error, message }, { status });
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
      actorType: "n8n",
      reason: reason ?? "Paused via internal action",
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

async function handleSendWhatsAppMessage(payload: JsonRecord) {
  const conversationId = asNonEmptyString(payload.conversationId);
  const text = asNonEmptyString(payload.text);

  if (!conversationId || !text) {
    return jsonError(400, "INVALID_PAYLOAD", "Informe conversationId e text");
  }

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

  const evolutionResponse = await sendEvolutionText({ number: target, text });
  const now = new Date();

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      externalMessageId: extractEvolutionMessageId(evolutionResponse),
      senderType: "bot",
      content: text,
      messageType: "text",
      sentAt: now,
      metadataJson: JSON.stringify({
        actorType: "n8n",
        evolutionResponse,
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
      actorType: "n8n",
      messageId: message.id,
      externalMessageId: message.externalMessageId,
      target,
    },
  });

  return NextResponse.json({
    ok: true,
    action: "SEND_WHATSAPP_MESSAGE",
    result: {
      conversationId: conversation.id,
      messageId: message.id,
      externalMessageId: message.externalMessageId,
    },
  });
}

export async function POST(request: Request) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const token = getBearerToken(request);

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
        return handlePauseAutomation(body.payload);
      case "UPDATE_LEAD_FIELDS":
        return handleUpdateLeadFields(body.payload);
    }
  } catch (error) {
    console.error("[CRM_INTERNAL_ACTION] Error:", error);
    return jsonError(500, "INTERNAL_ERROR", "Erro interno no servidor");
  }
}
