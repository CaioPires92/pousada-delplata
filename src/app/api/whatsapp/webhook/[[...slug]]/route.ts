import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { fetchEvolutionContact } from '@/lib/whatsapp/evolution';
import { extractWhatsAppIdentity, resolveContactJidFromEvolutionPayload } from '@/lib/whatsapp/identity';

export const runtime = 'nodejs';

function logToFile(data: any) {
  try {
    const logPath = path.join(process.cwd(), 'webhook_debug.log');
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n---\n`;
    fs.appendFileSync(logPath, entry);
  } catch (err) {
    console.error('Falha ao escrever no log:', err);
  }
}

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

  // ETAPA 2 — LOGS DE DEBUG
  const resolution = resolveContactJidFromEvolutionPayload(payload);
  
  console.log("[WEBHOOK IDENTITY DEBUG]", {
    event: payload?.event,
    fromMe: resolution.fromMe,
    contactJid: resolution.contactJid,
    reason: resolution.reason,
    remoteJid: payload?.data?.key?.remoteJid || payload?.data?.remoteJid,
    participant: payload?.data?.key?.participant || payload?.data?.participant,
    sender: payload?.data?.sender,
    owner: payload?.data?.owner,
    instance: payload?.instance,
    pushName: payload?.data?.pushName,
  });

  const identity = extractWhatsAppIdentity(payload);
  console.log("--- [WEBHOOK] IDENTIDADE FINAL PARA CRM ---", JSON.stringify(identity, null, 2));

  const messageType = normalizeMessageType(firstString(root.messageType, payload.messageType), message);

  return {
    contactName: identity.pushName || firstString(root.pushName, root.notifyName, payload.pushName, payload.notifyName),
    externalMessageId: firstString(root.id, root.messageId, key?.id),
    fromMe: Boolean(root.fromMe ?? key?.fromMe ?? false),
    mediaUrl: extractMediaUrl(message),
    messageType,
    phoneNormalized: identity.phone,
    phoneRaw: identity.jid,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  const { slug } = await params;
  const eventName = slug?.join('/') || 'default';
  console.log(`--- [WEBHOOK] INÍCIO DA REQUISIÇÃO (Evento: ${eventName}) ---`);
  
  if (!isAuthorized(request)) {
    console.error('--- [WEBHOOK] ERRO: NÃO AUTORIZADO (SECRET INVÁLIDO) ---');
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
    console.log('--- [WEBHOOK] PAYLOAD RECEBIDO ---');
  } catch {
    console.error('--- [WEBHOOK] ERRO: JSON INVÁLIDO ---');
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
  }

  const payloadRecord = asRecord(payload);
  if (!payloadRecord) {
    console.error('--- [WEBHOOK] ERRO: PAYLOAD NÃO É UM OBJETO ---');
    return NextResponse.json({ ok: false, reason: 'invalid_payload' }, { status: 400 });
  }

  // ETAPA 2 — LOGS DE DEBUG (AUDITORIA)
  console.log("FULL WEBHOOK", JSON.stringify(payloadRecord, null, 2));

  let extracted = extractWebhookMessage(payloadRecord);
  
  // LÓGICA DE RESOLUÇÃO DE LID (WhatsApp Linked Identity)
  // Mantemos como enriquecimento, mas a identidade base já foi capturada
  if (extracted.phoneRaw?.includes('@lid')) {
    logToFile(`LID DETECTADO NO WEBHOOK: ${extracted.phoneRaw}`);
    try {
      const contactInfo = await fetchEvolutionContact(extracted.phoneRaw);
      if (contactInfo) {
        logToFile({ msg: 'ENRIQUECIMENTO VIA EVOLUTION API', contactInfo });
        
        const realJid = contactInfo.resolvedJid || contactInfo.id || contactInfo.remoteJid;
        
        if (realJid && realJid.includes('@s.whatsapp.net')) {
          const normalized = normalizeWhatsappPhone(realJid);
          logToFile(`LID RESOLVIDO PARA JID REAL: ${extracted.phoneRaw} -> ${normalized.normalized}`);
          
          extracted = {
            ...extracted,
            phoneNormalized: normalized.normalized,
            contactName: contactInfo.pushName || extracted.contactName,
          };
        }
      }
    } catch (error) {
      logToFile({ error: 'FALHA NA RESOLUÇÃO DE LID', details: error });
    }
  }

  console.log(`--- [WEBHOOK] MENSAGEM EXTRAÍDA: De=${extracted.phoneNormalized || extracted.phoneRaw} ID=${extracted.externalMessageId} DeMim=${extracted.fromMe} ---`);

  if (extracted.fromMe) {
    console.log('--- [WEBHOOK] IGNORADO: MENSAGEM ENVIADA POR MIM ---');
    return NextResponse.json({ ok: true, ignored: true, reason: 'from_me' });
  }

  // ETAPA 3 — VALIDAÇÃO HÍBRIDA
  // Permitimos prosseguir se tivermos OU o telefone normalizado OU o JID bruto (que pode ser um LID)
  if (!extracted.phoneNormalized && !extracted.phoneRaw) {
    console.warn('--- [WEBHOOK] AVISO: IDENTIDADE NÃO IDENTIFICADA ---');
    return NextResponse.json({ ok: false, reason: 'missing_identity' });
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
      // ETAPA 4 — BUSCA UNIFICADA E DEDUPLICAÇÃO
      const identity = extractWhatsAppIdentity(extracted.rawPayload);
      
      // Busca agressiva por qualquer identificador disponível
      let contact = await tx.contact.findFirst({
        where: {
          OR: [
            identity.jid ? { whatsappJid: identity.jid } : undefined,
            identity.lid ? { whatsappLid: identity.lid } : undefined,
            identity.phone ? { phoneNormalized: identity.phone } : undefined,
          ].filter(Boolean) as any
        }
      });

      // Log de Match para Auditoria
      let matchedBy: "whatsappJid" | "whatsappLid" | "phoneNormalized" | "new" = "new";
      if (contact) {
        if (identity.jid && contact.whatsappJid === identity.jid) matchedBy = "whatsappJid";
        else if (identity.lid && contact.whatsappLid === identity.lid) matchedBy = "whatsappLid";
        else if (identity.phone && contact.phoneNormalized === identity.phone) matchedBy = "phoneNormalized";
      }

      console.log("[CONTACT MATCH]", {
        matchedBy,
        contactId: contact?.id,
        identity: { jid: identity.jid, lid: identity.lid, phone: identity.phone }
      });

      if (contact) {
        // Atualização Incremental: Se achamos o contato, mas ele não tinha algum campo, preenchemos agora
        const needsUpdate = 
          (identity.jid && !contact.whatsappJid) || 
          (identity.lid && !contact.whatsappLid) || 
          (identity.phone && !contact.phoneNormalized);

        if (needsUpdate) {
          contact = await tx.contact.update({
            where: { id: contact.id },
            data: {
              whatsappJid: contact.whatsappJid || identity.jid,
              whatsappLid: contact.whatsappLid || identity.lid,
              phoneNormalized: contact.phoneNormalized || identity.phone,
              phoneRaw: contact.phoneRaw || identity.phone,
              name: contact.name || extracted.contactName || '.'
            }
          });
        }
      } else {
        // RACE CONDITION PROTECTION: Se dois webhooks chegam juntos, um deles vai falhar no create (P2002)
        // Se falhar, tentamos buscar novamente pois o outro processo acabou de criar
        try {
          contact = await tx.contact.create({
            data: {
              name: extracted.contactName || '.',
              phoneNormalized: identity.phone,
              phoneRaw: identity.phone,
              whatsappLid: identity.lid,
              whatsappJid: identity.jid,
              source: 'whatsapp',
              status: 'lead'
            }
          });
        } catch (createError: any) {
          if (createError.code === 'P2002') {
            console.log("[WEBHOOK] RACE CONDITION DETECTED - RETRYING FIND");
            contact = await tx.contact.findFirst({
              where: {
                OR: [
                  identity.jid ? { whatsappJid: identity.jid } : undefined,
                  identity.lid ? { whatsappLid: identity.lid } : undefined,
                  identity.phone ? { phoneNormalized: identity.phone } : undefined,
                ].filter(Boolean) as any
              }
            });
          } else {
            throw createError;
          }
        }
      }

      if (!contact) {
        throw new Error("Falha crítica ao resolver ou criar contato após proteção de concorrência.");
      }

      // ETAPA 5 — BUSCA/CRIAÇÃO DE CONVERSA (POR CONTACTID)
      let conversation = await tx.conversation.findFirst({
        where: {
          contactId: contact.id,
          channel: 'whatsapp',
          status: 'open',
        },
        orderBy: { lastMessageAt: 'desc' },
        select: { id: true },
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
    console.log('--- [WEBHOOK] SUCESSO: MENSAGEM SALVA NO BANCO ---');
  } catch (error) {
    console.error('--- [WEBHOOK] ERRO CRÍTICO NO PROCESSAMENTO ---');
    console.error(error);
    
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

  // --- ETAPA 6: AUTOMAÇÃO (FASE 6) ---
  const conversation = await prisma.conversation.findUnique({
    where: { id: result.conversationId },
    select: { chatbotEnabled: true, automationPausedUntil: true, contact: { select: { phoneNormalized: true } } }
  });

  const isAutomationEnabled = conversation?.chatbotEnabled && 
    (!conversation.automationPausedUntil || new Date(conversation.automationPausedUntil) < new Date());

  if (isAutomationEnabled && extracted.textContent && conversation?.contact?.phoneNormalized) {
    try {
      console.log(`--- [WEBHOOK] EXECUTANDO AUTOMAÇÃO PARA: ${conversation.contact.phoneNormalized} ---`);
      const { processAutoResponse } = await import('@/lib/whatsapp/automation');
      const response = await processAutoResponse(
        result.conversationId,
        conversation.contact.phoneNormalized,
        extracted.textContent
      );
      if (response) {
        console.log(`--- [WEBHOOK] BOT RESPONDEU: ${response} ---`);
      }
    } catch (autoError) {
      console.error('--- [WEBHOOK] ERRO NA AUTOMAÇÃO ---', autoError);
    }
  }

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
