import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

type JsonRecord = Record<string, unknown>;
type SupportedMessageType = 'text' | 'image' | 'audio' | 'document' | 'unknown';
type ExtractedWebhookMessage = {
  contactName?: string;
  externalMessageId?: string;
  fromMe: boolean;
  mediaUrl?: string;
  messageType: SupportedMessageType;
  phoneNormalized?: string;
  phoneRaw?: string;
  rawPayload: JsonRecord;
  sentAt: Date;
  textContent?: string;
};

function asRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonRecord;
}

function firstRecord(...values: unknown[]): JsonRecord | undefined {
  for (const value of values) {
    const record = asRecord(value);
    if (record) {
      return record;
    }
  }

  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function normalizeWhatsappPhone(rawValue: string | undefined): {
  normalized?: string;
  raw?: string;
} {
  if (!rawValue) {
    return {};
  }

  const withoutSuffix = rawValue.replace(/@(s\.whatsapp\.net|c\.us)$/i, '').trim();
  const digitsOnly = withoutSuffix.replace(/\D+/g, '');

  if (!digitsOnly) {
    return {
      raw: withoutSuffix || rawValue,
    };
  }

  if (digitsOnly.startsWith('55')) {
    return {
      raw: withoutSuffix,
      normalized: digitsOnly,
    };
  }

  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    return {
      raw: withoutSuffix,
      normalized: `55${digitsOnly}`,
    };
  }

  return {
    raw: withoutSuffix,
    normalized: digitsOnly,
  };
}

function normalizeMessageType(candidate: string | undefined, message: JsonRecord | undefined): SupportedMessageType {
  const normalizedCandidate = candidate?.toLowerCase();

  if (
    normalizedCandidate?.includes('conversation') ||
    normalizedCandidate?.includes('text') ||
    normalizedCandidate?.includes('extendedtext')
  ) {
    return 'text';
  }

  if (normalizedCandidate?.includes('image')) {
    return 'image';
  }

  if (normalizedCandidate?.includes('audio') || normalizedCandidate?.includes('ptt')) {
    return 'audio';
  }

  if (normalizedCandidate?.includes('document')) {
    return 'document';
  }

  if (!message) {
    return 'unknown';
  }

  if (typeof message.conversation === 'string' || asRecord(message.extendedTextMessage)) {
    return 'text';
  }

  if (asRecord(message.imageMessage)) {
    return 'image';
  }

  if (asRecord(message.audioMessage)) {
    return 'audio';
  }

  if (asRecord(message.documentMessage)) {
    return 'document';
  }

  return 'unknown';
}

function extractMessageContent(message: JsonRecord | undefined): string | undefined {
  if (!message) {
    return undefined;
  }

  const extendedText = asRecord(message.extendedTextMessage);
  const imageMessage = asRecord(message.imageMessage);
  const documentMessage = asRecord(message.documentMessage);

  return firstString(
    message.conversation,
    extendedText?.text,
    imageMessage?.caption,
    documentMessage?.caption,
  );
}

function extractMediaUrl(message: JsonRecord | undefined): string | undefined {
  if (!message) {
    return undefined;
  }

  const imageMessage = asRecord(message.imageMessage);
  const audioMessage = asRecord(message.audioMessage);
  const documentMessage = asRecord(message.documentMessage);

  return firstString(
    imageMessage?.url,
    imageMessage?.mediaUrl,
    imageMessage?.directPath,
    audioMessage?.url,
    audioMessage?.mediaUrl,
    audioMessage?.directPath,
    documentMessage?.url,
    documentMessage?.mediaUrl,
    documentMessage?.directPath,
  );
}

function extractSentAt(payload: JsonRecord, payloadData: JsonRecord | undefined): Date {
  const rawTimestamp = firstNumber(
    payload.messageTimestamp,
    payload.timestamp,
    payloadData?.messageTimestamp,
    payloadData?.timestamp,
  );

  if (!rawTimestamp) {
    return new Date();
  }

  const timestampMs = rawTimestamp < 1_000_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
  const parsed = new Date(timestampMs);

  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function summarizePayload(payload: JsonRecord): string {
  const rawJson = JSON.stringify(payload);
  if (rawJson.length <= 30_000) {
    return rawJson;
  }

  const key = firstRecord(payload.key, asRecord(payload.data)?.key);
  const summary = {
    event: firstString(payload.event, asRecord(payload.data)?.event),
    instance: firstString(payload.instance, payload.instanceName, asRecord(payload.data)?.instance),
    messageType: firstString(payload.messageType, asRecord(payload.data)?.messageType),
    pushName: firstString(payload.pushName, asRecord(payload.data)?.pushName),
    remoteJid: firstString(payload.remoteJid, payload.sender, payload.from, key?.remoteJid),
    payloadKeys: Object.keys(payload),
    truncated: true,
  };

  return JSON.stringify(summary);
}

function extractWebhookMessage(payload: JsonRecord): ExtractedWebhookMessage {
  const payloadData = firstRecord(payload.data, payload.body);
  const root = firstRecord(payloadData, payload) ?? payload;
  const key = firstRecord(root.key, payload.key);
  const message = firstRecord(root.message, payload.message);

  const rawPhone = firstString(
    root.remoteJid,
    root.sender,
    root.from,
    root.jid,
    root.participant,
    key?.remoteJid,
    key?.participant,
  );
  const normalizedPhone = normalizeWhatsappPhone(rawPhone);
  const messageType = normalizeMessageType(firstString(root.messageType, payload.messageType), message);

  return {
    contactName: firstString(root.pushName, root.notifyName, payload.pushName, payload.notifyName),
    externalMessageId: firstString(root.id, root.messageId, key?.id),
    fromMe: Boolean(root.fromMe ?? key?.fromMe ?? false),
    mediaUrl: extractMediaUrl(message),
    messageType,
    phoneNormalized: normalizedPhone.normalized,
    phoneRaw: normalizedPhone.raw ?? rawPhone,
    rawPayload: payload,
    sentAt: extractSentAt(root, payloadData),
    textContent: extractMessageContent(message),
  };
}

function secureEquals(expected: string, provided: string): boolean {
  const expectedHash = createHash('sha256').update(expected).digest();
  const providedHash = createHash('sha256').update(provided).digest();

  return timingSafeEqual(expectedHash, providedHash);
}

function isAuthorized(request: Request): boolean {
  const configuredSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!configuredSecret) {
    return true;
  }

  const authorizationHeader = request.headers.get('authorization');
  const bearerToken = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : undefined;
  const providedSecret = firstString(
    request.headers.get('x-evolution-secret'),
    request.headers.get('x-webhook-secret'),
    bearerToken,
  );

  if (!providedSecret) {
    return false;
  }

  return secureEquals(configuredSecret, providedSecret);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
  }

  const payloadRecord = asRecord(payload);
  if (!payloadRecord) {
    return NextResponse.json({ ok: false, reason: 'invalid_payload' }, { status: 400 });
  }

  const extracted = extractWebhookMessage(payloadRecord);

  if (extracted.fromMe) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'from_me' });
  }

  if (!extracted.phoneNormalized) {
    return NextResponse.json({ ok: false, reason: 'missing_phone' });
  }

  if (extracted.externalMessageId) {
    const duplicatedMessage = await prisma.message.findFirst({
      where: {
        externalMessageId: extracted.externalMessageId,
      },
      select: {
        id: true,
        conversationId: true,
        conversation: {
          select: {
            contactId: true,
          },
        },
      },
    });

    if (duplicatedMessage) {
      return NextResponse.json({
        ok: true,
        duplicated: true,
        contactId: duplicatedMessage.conversation.contactId,
        conversationId: duplicatedMessage.conversationId,
        messageId: duplicatedMessage.id,
      });
    }
  }

  const metadataJson = summarizePayload(extracted.rawPayload);

  let result: {
    contactId: string;
    conversationId: string;
    messageId: string;
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      const contact = await tx.contact.upsert({
        where: {
          phoneNormalized: extracted.phoneNormalized,
        },
        create: {
          name: extracted.contactName,
          phoneRaw: extracted.phoneRaw ?? extracted.phoneNormalized,
          phoneNormalized: extracted.phoneNormalized,
          source: 'whatsapp',
          status: 'lead',
        },
        update: {
          name: extracted.contactName,
          phoneRaw: extracted.phoneRaw ?? extracted.phoneNormalized,
          source: 'whatsapp',
          status: 'lead',
        },
        select: {
          id: true,
        },
      });

      let conversation = await tx.conversation.findFirst({
        where: {
          contactId: contact.id,
          channel: 'whatsapp',
          status: 'open',
        },
        orderBy: [
          { lastMessageAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
        },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            contactId: contact.id,
            channel: 'whatsapp',
            status: 'open',
            chatbotEnabled: true,
          },
          select: {
            id: true,
          },
        });
      }

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          externalMessageId: extracted.externalMessageId,
          senderType: 'guest',
          content: extracted.textContent,
          messageType: extracted.messageType,
          mediaUrl: extracted.mediaUrl,
          metadataJson,
          sentAt: extracted.sentAt,
        },
        select: {
          id: true,
        },
      });

      const lastActivityAt = new Date();

      await tx.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          lastMessageAt: extracted.sentAt,
        },
      });

      // O schema atual não possui status de card; nesta etapa, tratamos qualquer card
      // não perdido como aberto para evitar duplicidade no primeiro contato.
      const existingPipelineCard = await tx.pipelineCard.findFirst({
        where: {
          contactId: contact.id,
          NOT: {
            stage: 'perdido',
          },
        },
        select: {
          id: true,
        },
      });

      if (!existingPipelineCard) {
        await tx.pipelineCard.create({
          data: {
            contactId: contact.id,
            conversationId: conversation.id,
            stage: 'novo',
            priority: 'normal',
            source: 'whatsapp',
            lastActivityAt,
          },
        });
      }

      return {
        contactId: contact.id,
        conversationId: conversation.id,
        messageId: message.id,
      };
    });
  } catch (error) {
    if (
      extracted.externalMessageId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const duplicatedMessage = await prisma.message.findFirst({
        where: {
          externalMessageId: extracted.externalMessageId,
        },
        select: {
          id: true,
          conversationId: true,
          conversation: {
            select: {
              contactId: true,
            },
          },
        },
      });

      if (duplicatedMessage) {
        return NextResponse.json({
          ok: true,
          duplicated: true,
          contactId: duplicatedMessage.conversation.contactId,
          conversationId: duplicatedMessage.conversationId,
          messageId: duplicatedMessage.id,
        });
      }
    }

    throw error;
  }

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
