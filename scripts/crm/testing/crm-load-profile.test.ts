import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { persistNormalizedWebhookEvents } from "@/lib/messaging/webhook-event-store";
import { mergeConversationItems, type ConversationListItem } from "@/lib/crm/inboxPagination";
import { queryAvailabilityQuote } from "@/lib/availability/quote-service";
import { processNextAutomationJobForConversation } from "@/lib/crm/automationQueue";

const runId = `load-${Date.now()}`;
const timings: Record<string, number> = {};
let contactId = "";
let conversationId = "";

function elapsed(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

describe.sequential("CRM isolated load profile", () => {
  beforeAll(async () => {
    const contact = await prisma.contact.create({ data: { name: runId, source: "load_test" } });
    contactId = contact.id;
    const conversation = await prisma.conversation.create({
      data: { contactId, channel: "whatsapp", status: "open" },
    });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    await prisma.messagingWebhookEvent.deleteMany({ where: { provider: runId } });
    if (contactId) await prisma.contact.deleteMany({ where: { id: contactId } });
    console.info("CRM_LOAD_RESULT", JSON.stringify(timings));
  });

  it("persists and deduplicates 100 webhook events", async () => {
    const events = Array.from({ length: 100 }, (_, index) => ({
      kind: "message" as const,
      externalEventId: `${runId}-event-${index}`,
      externalMessageId: `${runId}-message-${index}`,
      channel: "whatsapp" as const,
      senderId: `55199999${String(index).padStart(4, "0")}`,
      recipientId: "5519000000000",
      occurredAt: new Date().toISOString(),
      content: { kind: "text" as const, text: `carga ${index}` },
    }));
    const startedAt = performance.now();
    let acceptedEvents = 0;
    let duplicateEvents = 0;
    const first = await persistNormalizedWebhookEvents(runId, events);
    const duplicate = await persistNormalizedWebhookEvents(runId, events);
    acceptedEvents += first.acceptedEvents + duplicate.acceptedEvents;
    duplicateEvents += first.duplicateEvents + duplicate.duplicateEvents;
    timings.webhookMs = elapsed(startedAt);
    expect({ acceptedEvents, duplicateEvents }).toEqual({ acceptedEvents: 100, duplicateEvents: 100 });
    expect(timings.webhookMs).toBeLessThan(45_000);
  }, 50_000);

  it("merges and orders 10,000 Inbox items", () => {
    const makeItems = (offset: number): ConversationListItem[] => Array.from({ length: 5_000 }, (_, index) => ({
      id: `conversation-${offset + index}`,
      name: `Hóspede ${offset + index}`,
      phone: null,
      lid: null,
      lastMessage: "Teste de carga",
      lastMessageAt: new Date(1_700_000_000_000 + offset + index).toISOString(),
      unreadCount: 0,
      waitingSince: null,
      firstResponseTimeSeconds: null,
    }));
    const startedAt = performance.now();
    const merged = mergeConversationItems(makeItems(0), makeItems(5_000));
    timings.inboxMs = elapsed(startedAt);
    expect(merged).toHaveLength(10_000);
    expect(merged[0].id).toBe("conversation-9999");
    expect(timings.inboxMs).toBeLessThan(1_000);
  });

  it("calculates 100 quotes concurrently without shared-state corruption", async () => {
    const client = {
      roomType: { findMany: vi.fn().mockResolvedValue([{
        id: "room-load", name: "Chalé", totalUnits: 8, inventoryFor4Guests: 2,
        basePrice: 400, includedAdults: 2, maxGuests: 4, extraAdultFee: 80, child6To11Fee: 50,
        photos: [], rates: [],
      }]) },
      booking: { findMany: vi.fn().mockResolvedValue([]) },
      inventoryAdjustment: { findMany: vi.fn().mockResolvedValue([]) },
      fourGuestInventoryAdjustment: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const startedAt = performance.now();
    const results = await Promise.all(Array.from({ length: 100 }, () => queryAvailabilityQuote({
      checkin: "2026-09-12", checkout: "2026-09-14", adults: 2, childrenAges: [],
    }, client as never)));
    timings.quoteMs = elapsed(startedAt);
    log.mockRestore();
    expect(results.every(result => result.ok && result.options[0]?.remainingUnits === 8)).toBe(true);
    expect(new Set(results.filter(result => result.ok).map(result => JSON.stringify(result.options))).size).toBe(1);
    expect(timings.quoteMs).toBeLessThan(3_000);
  });

  it("processes 30 scheduler jobs exactly once", async () => {
    await prisma.automationQueueJob.createMany({
      data: Array.from({ length: 30 }, (_, index) => ({
        conversationId,
        action: "SEND_WHATSAPP_MESSAGE",
        payloadJson: JSON.stringify({ target: "5519999999999", text: `job ${index}` }),
        journeyType: "replay",
        dedupeKey: `${runId}-job-${index}`,
        status: "pending",
        scheduledAt: new Date(0),
      })),
    });
    const processedIds = new Set<string>();
    const startedAt = performance.now();
    for (let index = 0; index < 30; index += 1) {
      const result = await processNextAutomationJobForConversation(conversationId, async job => {
        expect(processedIds.has(job.id)).toBe(false);
        processedIds.add(job.id);
      });
      expect(result.processed).toBe(true);
    }
    timings.schedulerMs = elapsed(startedAt);
    expect(processedIds.size).toBe(30);
    expect(await prisma.automationQueueJob.count({ where: { conversationId, status: "completed" } })).toBe(30);
    expect(timings.schedulerMs).toBeLessThan(25_000);
  }, 30_000);
});
