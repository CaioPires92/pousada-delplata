import prisma from "@/lib/prisma";
import { enqueueAutomationJob } from "@/lib/crm/automationQueue";
import { buildAuditMetadata } from "@/lib/crm/audit";
import { recordCrmEvent } from "@/lib/crm/events";
import { resolveEvolutionSendTarget } from "@/lib/whatsapp/evolution";
import { getPostStaySettings } from "@/lib/crm/postStaySettings";

export const POST_STAY_SATISFACTION_DELAY_MS = 3 * 60 * 60 * 1000;
export const POST_STAY_REVIEW_DELAY_MS = 24 * 60 * 60 * 1000;
export const POST_STAY_SATISFACTION_MESSAGE =
  "Olá! Esperamos que tenha aproveitado sua estadia. Como foi sua experiência conosco?";

export async function schedulePostStaySatisfaction(input: {
  bookingId: string;
  checkoutConfirmedAt: Date;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      crmContactId: true,
      crmConversationId: true,
      crmContact: {
        select: {
          phone: true,
          phoneRaw: true,
          whatsappJid: true,
          optInWhatsapp: true,
          optOutAt: true,
        },
      },
    },
  });
  if (!booking?.crmContactId || !booking.crmConversationId || !booking.crmContact) {
    return { scheduled: false as const, reason: "missing_crm_link" as const };
  }
  if (booking.crmContact.optOutAt || !booking.crmContact.optInWhatsapp) {
    return { scheduled: false as const, reason: "whatsapp_consent_missing" as const };
  }

  const target = resolveEvolutionSendTarget(booking.crmContact);
  if (!target) return { scheduled: false as const, reason: "missing_target" as const };

  const scheduledAt = new Date(input.checkoutConfirmedAt.getTime() + POST_STAY_SATISFACTION_DELAY_MS);
  const job = await enqueueAutomationJob({
    conversationId: booking.crmConversationId,
    action: "SEND_WHATSAPP_MESSAGE",
    journeyType: "post_stay",
    dedupeKey: `post-stay:${input.bookingId}:satisfaction`,
    scheduledAt,
    payload: {
      target,
      text: POST_STAY_SATISFACTION_MESSAGE,
      bookingId: input.bookingId,
      postStayStep: "satisfaction",
      checkoutConfirmedAt: input.checkoutConfirmedAt.toISOString(),
    },
  });

  await recordCrmEvent({
    action: "PostStaySatisfactionScheduled",
    bookingId: input.bookingId,
    contactId: booking.crmContactId,
    conversationId: booking.crmConversationId,
    metadata: {
      queueJobId: job.id,
      scheduledAt: scheduledAt.toISOString(),
      ...buildAuditMetadata({ actorType: "system", origin: "system" }),
    },
  });
  return { scheduled: true as const, jobId: job.id, scheduledAt };
}

export async function schedulePostStayReviewRequest(input: {
  bookingId: string;
  checkoutConfirmedAt: Date;
}) {
  const settings = await getPostStaySettings();
  if (!settings.officialReviewUrl) {
    return { scheduled: false as const, reason: "review_url_not_configured" as const };
  }
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      crmContactId: true,
      crmConversationId: true,
      crmContact: { select: { phone: true, phoneRaw: true, whatsappJid: true, optInWhatsapp: true, optOutAt: true } },
    },
  });
  if (!booking?.crmContactId || !booking.crmConversationId || !booking.crmContact) {
    return { scheduled: false as const, reason: "missing_crm_link" as const };
  }
  if (booking.crmContact.optOutAt || !booking.crmContact.optInWhatsapp) {
    return { scheduled: false as const, reason: "whatsapp_consent_missing" as const };
  }
  const target = resolveEvolutionSendTarget(booking.crmContact);
  if (!target) return { scheduled: false as const, reason: "missing_target" as const };

  const scheduledAt = new Date(input.checkoutConfirmedAt.getTime() + POST_STAY_REVIEW_DELAY_MS);
  const job = await enqueueAutomationJob({
    conversationId: booking.crmConversationId,
    action: "SEND_WHATSAPP_MESSAGE",
    journeyType: "post_stay",
    dedupeKey: `post-stay:${input.bookingId}:review`,
    scheduledAt,
    payload: {
      target,
      text: `Obrigado pelo retorno! Se quiser compartilhar sua experiência, este é nosso link oficial: ${settings.officialReviewUrl}`,
      bookingId: input.bookingId,
      postStayStep: "review",
    },
  });
  await recordCrmEvent({
    action: "ReviewRequestScheduled",
    bookingId: input.bookingId,
    contactId: booking.crmContactId,
    conversationId: booking.crmConversationId,
    metadata: { queueJobId: job.id, scheduledAt: scheduledAt.toISOString() },
  });
  return { scheduled: true as const, jobId: job.id, scheduledAt };
}
