import prisma from "@/lib/prisma";
import { normalizeGuestEmail, normalizeGuestPhone } from "@/lib/coupons/hash";
import { buildAuditMetadata, type AuditOrigin } from "@/lib/crm/audit";
import { recordCrmEvent } from "@/lib/crm/events";
import { PIPELINE_TERMINAL_STAGE_VALUES } from "@/lib/crm/pipelineStages";

export type BookingCrmLinkFailureReason =
  | "booking_not_found"
  | "contact_not_found"
  | "conversation_not_found"
  | "conversation_contact_mismatch"
  | "pipeline_card_not_found"
  | "pipeline_card_context_mismatch"
  | "booking_already_linked"
  | "pipeline_card_already_linked";

export type BookingCrmLinkResult =
  | {
      ok: true;
      linked: boolean;
      bookingId: string;
      contactId: string;
      conversationId: string;
      pipelineCardId: string;
    }
  | { ok: false; reason: BookingCrmLinkFailureReason };

export type BookingCrmReconciliationResult =
  | BookingCrmLinkResult
  | {
      ok: false;
      reason:
        | "identity_missing"
        | "contact_not_found"
        | "contact_ambiguous"
        | "active_pipeline_card_not_found";
    };

type LinkBookingToCrmInput = {
  bookingId: string;
  contactId: string;
  conversationId: string;
  pipelineCardId: string;
  actorType?: "human" | "system" | "n8n";
  origin?: AuditOrigin;
};

function guestPhoneVariants(phone?: string | null) {
  const rawDigits = phone ? phone.replace(/\D+/g, "") : "";
  const localDigits = normalizeGuestPhone(phone);
  return Array.from(
    new Set(
      [rawDigits, localDigits, localDigits ? `55${localDigits}` : ""].filter(Boolean)
    )
  );
}

export async function linkBookingToCrm(
  input: LinkBookingToCrmInput
): Promise<BookingCrmLinkResult> {
  const result = await prisma.$transaction(async (tx): Promise<BookingCrmLinkResult> => {
    const [booking, contact, conversation, pipelineCard] = await Promise.all([
      tx.booking.findUnique({
        where: { id: input.bookingId },
        select: { id: true, crmContactId: true, crmConversationId: true },
      }),
      tx.contact.findUnique({ where: { id: input.contactId }, select: { id: true } }),
      tx.conversation.findUnique({
        where: { id: input.conversationId },
        select: { id: true, contactId: true },
      }),
      tx.pipelineCard.findUnique({
        where: { id: input.pipelineCardId },
        select: { id: true, contactId: true, conversationId: true, bookingId: true },
      }),
    ]);

    if (!booking) return { ok: false, reason: "booking_not_found" };
    if (!contact) return { ok: false, reason: "contact_not_found" };
    if (!conversation) return { ok: false, reason: "conversation_not_found" };
    if (conversation.contactId !== contact.id) {
      return { ok: false, reason: "conversation_contact_mismatch" };
    }
    if (!pipelineCard) return { ok: false, reason: "pipeline_card_not_found" };
    if (
      pipelineCard.contactId !== contact.id ||
      pipelineCard.conversationId !== conversation.id
    ) {
      return { ok: false, reason: "pipeline_card_context_mismatch" };
    }
    if (
      (booking.crmContactId && booking.crmContactId !== contact.id) ||
      (booking.crmConversationId && booking.crmConversationId !== conversation.id)
    ) {
      return { ok: false, reason: "booking_already_linked" };
    }
    if (pipelineCard.bookingId && pipelineCard.bookingId !== booking.id) {
      return { ok: false, reason: "pipeline_card_already_linked" };
    }

    const alreadyLinked =
      booking.crmContactId === contact.id &&
      booking.crmConversationId === conversation.id &&
      pipelineCard.bookingId === booking.id;

    if (!alreadyLinked) {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          crmContactId: contact.id,
          crmConversationId: conversation.id,
        },
      });
      await tx.pipelineCard.update({
        where: { id: pipelineCard.id },
        data: { bookingId: booking.id, lastActivityAt: new Date() },
      });
    }

    return {
      ok: true,
      linked: !alreadyLinked,
      bookingId: booking.id,
      contactId: contact.id,
      conversationId: conversation.id,
      pipelineCardId: pipelineCard.id,
    };
  });

  if (result.ok && result.linked) {
    await recordCrmEvent({
      action: "BookingCrmLinked",
      bookingId: result.bookingId,
      contactId: result.contactId,
      conversationId: result.conversationId,
      metadata: {
        pipelineCardId: result.pipelineCardId,
        ...buildAuditMetadata({
          actorType: input.actorType ?? "system",
          origin: input.origin ?? "system",
          extra: { linkSource: "booking_reconciliation" },
        }),
      },
    });
  }

  return result;
}

export async function reconcileBookingToCrm(input: {
  bookingId: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
}): Promise<BookingCrmReconciliationResult> {
  const email = normalizeGuestEmail(input.guestEmail);
  const phoneVariants = guestPhoneVariants(input.guestPhone);
  const identityFilters = [
    ...phoneVariants.map((phone) => ({ phone })),
    ...(email ? [{ email }] : []),
  ];

  if (identityFilters.length === 0) {
    return { ok: false, reason: "identity_missing" };
  }

  const contacts = await prisma.contact.findMany({
    where: { OR: identityFilters },
    select: { id: true },
    take: 2,
  });

  if (contacts.length === 0) return { ok: false, reason: "contact_not_found" };
  if (contacts.length > 1) return { ok: false, reason: "contact_ambiguous" };

  const card = await prisma.pipelineCard.findFirst({
    where: {
      contactId: contacts[0].id,
      bookingId: null,
      NOT: { stage: { in: [...PIPELINE_TERMINAL_STAGE_VALUES] } },
      conversation: { is: { channel: "whatsapp", status: "open" } },
    },
    orderBy: [{ lastActivityAt: "desc" }, { updatedAt: "desc" }],
    select: { id: true, contactId: true, conversationId: true },
  });

  if (!card?.conversationId) {
    return { ok: false, reason: "active_pipeline_card_not_found" };
  }

  return linkBookingToCrm({
    bookingId: input.bookingId,
    contactId: card.contactId,
    conversationId: card.conversationId,
    pipelineCardId: card.id,
    actorType: "system",
    origin: "system",
  });
}
