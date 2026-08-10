import prisma from "@/lib/prisma";
import { buildAuditMetadata } from "@/lib/crm/audit";
import { enqueueAutomationJob } from "@/lib/crm/automationQueue";
import { recordCrmEvent } from "@/lib/crm/events";
import { resolveEvolutionSendTarget } from "@/lib/whatsapp/evolution";

export const DEFAULT_FOLLOW_UP_CADENCE_HOURS = [2, 24, 72] as const;

const FOLLOW_UP_MESSAGES = [
  "Olá! Ficou alguma dúvida sobre a hospedagem ou sobre o orçamento que enviei?",
  "Olá! Se ainda tiver interesse nas datas consultadas, posso ajudar a continuar sua reserva.",
  "Olá! Caso ainda queira verificar aquelas datas, me avise por aqui para consultarmos a disponibilidade novamente.",
] as const;

export function normalizeFollowUpCadenceHours(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) return null;
  if (value.some(item => !Number.isInteger(item) || item < 1 || item > 24 * 30)) return null;
  const normalized = Array.from(new Set(value as number[])).sort((left, right) => left - right);
  return normalized.length === value.length ? normalized : null;
}

export function parseFollowUpCadenceHours(value: string | null | undefined): number[] {
  if (!value) return [...DEFAULT_FOLLOW_UP_CADENCE_HOURS];
  try {
    return normalizeFollowUpCadenceHours(JSON.parse(value))
      ?? [...DEFAULT_FOLLOW_UP_CADENCE_HOURS];
  } catch {
    return [...DEFAULT_FOLLOW_UP_CADENCE_HOURS];
  }
}

export async function getFollowUpCadenceSettings() {
  const settings = await prisma.followUpSettings.findUnique({ where: { id: "global" } });
  return {
    enabled: settings?.enabled ?? false,
    cadenceHours: parseFollowUpCadenceHours(settings?.cadenceHoursJson),
  };
}

export async function scheduleCommercialFollowUpCadence(input: {
  conversationId: string;
  journeyId: string;
  baseAt?: Date;
}) {
  const settings = await getFollowUpCadenceSettings();
  if (!settings.enabled) return { scheduled: 0, reason: "disabled" as const };

  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: {
      contactId: true,
      contact: { select: { phone: true, phoneRaw: true, whatsappJid: true } },
    },
  });
  const target = conversation ? resolveEvolutionSendTarget(conversation.contact) : null;
  if (!conversation || !target) return { scheduled: 0, reason: "missing_target" as const };

  const baseAt = input.baseAt ?? new Date();
  for (const [index, hours] of settings.cadenceHours.entries()) {
    await enqueueAutomationJob({
      conversationId: input.conversationId,
      action: "SEND_WHATSAPP_MESSAGE",
      journeyType: "commercial_followup",
      dedupeKey: `commercial:${input.conversationId}:${input.journeyId}:${index + 1}`,
      scheduledAt: new Date(baseAt.getTime() + hours * 60 * 60 * 1000),
      payload: {
        target,
        text: FOLLOW_UP_MESSAGES[Math.min(index, FOLLOW_UP_MESSAGES.length - 1)],
        cadenceStep: index + 1,
        cadenceHours: hours,
      },
    });
  }

  await recordCrmEvent({
    action: "CommercialFollowUpCadenceScheduled",
    contactId: conversation.contactId,
    conversationId: input.conversationId,
    metadata: {
      journeyId: input.journeyId,
      cadenceHours: settings.cadenceHours,
      scheduledCount: settings.cadenceHours.length,
      ...buildAuditMetadata({
        actorType: "system",
        origin: "system",
        reason: "Cadência comercial criada após envio de orçamento",
      }),
    },
  });
  return { scheduled: settings.cadenceHours.length, reason: null };
}
