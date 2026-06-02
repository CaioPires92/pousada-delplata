import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { normalizeBrazilianPhone } from "@/lib/crm/identity";
import { PIPELINE_STAGES, PIPELINE_TERMINAL_STAGE_VALUES } from "@/lib/crm/pipelineStages";
import { recordCrmEvent } from "@/lib/crm/events";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as JsonRecord;
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asOptionalInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const data = asRecord(body);

    const name = asNonEmptyString(data?.name);
    const email = asNonEmptyString(data?.email)?.toLowerCase();
    const rawPhone = asNonEmptyString(data?.phone);
    const source = asNonEmptyString(data?.source) ?? "site_form";
    const message = asNonEmptyString(data?.message);

    if (!name || (!email && !rawPhone)) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const phone = rawPhone ? normalizeBrazilianPhone(rawPhone) : null;

    const result = await prisma.$transaction(async tx => {
      const existingContact = await tx.contact.findFirst({
        where: {
          OR: [
            email ? { email } : undefined,
            phone ? { phone } : undefined,
          ].filter(Boolean) as any,
        },
      });

      const contact = existingContact
        ? await tx.contact.update({
            where: { id: existingContact.id },
            data: {
              name: existingContact.name || name,
              email: existingContact.email || email,
              phone: existingContact.phone || phone,
              phoneRaw: existingContact.phoneRaw || rawPhone,
              source: existingContact.source || source,
            },
          })
        : await tx.contact.create({
            data: {
              name,
              email,
              phone,
              phoneRaw: rawPhone,
              source,
              status: "lead",
            },
          });

      let conversation = await tx.conversation.findFirst({
        where: {
          contactId: contact.id,
          channel: "site_chat",
          status: "open",
        },
        orderBy: { updatedAt: "desc" },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            contactId: contact.id,
            channel: "site_chat",
            status: "open",
            chatbotEnabled: true,
          },
        });
      }

      if (message) {
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderType: "guest",
            content: message,
            messageType: "text",
            sentAt: new Date(),
          },
        });

        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
          },
        });
      }

      let card = await tx.pipelineCard.findFirst({
        where: {
          contactId: contact.id,
          NOT: { stage: { in: [...PIPELINE_TERMINAL_STAGE_VALUES] } },
        },
      });

      if (!card) {
        card = await tx.pipelineCard.create({
          data: {
            contactId: contact.id,
            conversationId: conversation.id,
            stage: PIPELINE_STAGES.NOVO_LEAD,
            source,
            lastActivityAt: new Date(),
            adults: asOptionalInteger(data?.adults),
            children: asOptionalInteger(data?.children),
            intendedCheckin: asNonEmptyString(data?.checkin) ? new Date(String(data?.checkin)) : undefined,
            intendedCheckout: asNonEmptyString(data?.checkout) ? new Date(String(data?.checkout)) : undefined,
          },
        });
      }

      return { contact, conversation, card, createdNewContact: !existingContact };
    });

    await recordCrmEvent({
      action: "SiteLeadCaptured",
      contactId: result.contact.id,
      conversationId: result.conversation.id,
      metadata: {
        source,
        createdNewContact: result.createdNewContact,
        handoffChannel: "whatsapp",
        hasPhone: Boolean(result.contact.phone),
      },
    });

    return NextResponse.json({
      ok: true,
      contactId: result.contact.id,
      conversationId: result.conversation.id,
      pipelineCardId: result.card.id,
      handoff: {
        whatsappPhone: result.contact.phone ?? null,
      },
    });
  } catch (error) {
    console.error("Erro ao integrar lead do formulário:", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
