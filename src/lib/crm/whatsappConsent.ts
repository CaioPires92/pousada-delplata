import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { buildAuditMetadata, type AuditOrigin } from "@/lib/crm/audit";
import { recordCrmEvent } from "@/lib/crm/events";

const OPT_OUT_WORDS = new Set(["sair", "parar", "pare", "cancelar", "stop"]);

export function isWhatsappOptOutMessage(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return OPT_OUT_WORDS.has(normalized);
}

export async function setWhatsappConsent(input: {
  contactId: string;
  optInWhatsapp: boolean;
  origin: AuditOrigin;
  sourceOrigin?: string;
}) {
  const now = new Date();
  try {
    const result = await prisma.$transaction(async tx => {
      const contact = await tx.contact.update({
        where: { id: input.contactId },
        data: {
          optInWhatsapp: input.optInWhatsapp,
          optOutAt: input.optInWhatsapp ? null : now,
        },
        select: { id: true, optInWhatsapp: true, optOutAt: true },
      });
      const cancelled = input.optInWhatsapp
        ? { count: 0 }
        : await tx.automationQueueJob.updateMany({
            where: {
              action: "SEND_WHATSAPP_MESSAGE",
              status: "pending",
              conversation: { contactId: input.contactId },
            },
            data: {
              status: "cancelled",
              cancelledAt: now,
              cancelReason: "contact_opted_out",
              finishedAt: now,
            },
          });
      return { contact, cancelledJobs: cancelled.count };
    });

    await recordCrmEvent({
      action: "ContactConsentUpdated",
      contactId: result.contact.id,
      metadata: {
        optInWhatsapp: result.contact.optInWhatsapp,
        optOutAt: result.contact.optOutAt,
        cancelledJobs: result.cancelledJobs,
        sourceOrigin: input.sourceOrigin ?? null,
        ...buildAuditMetadata({
          actorType: input.origin === "webhook" ? "webhook" : "human",
          origin: input.origin,
          reason: input.optInWhatsapp ? "Consentimento registrado" : "Opt-out solicitado",
        }),
      },
    });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}
