import { randomUUID } from "node:crypto";

import prisma from "../../../src/lib/prisma";
import { enqueueAutomationJob, processNextAutomationJobForConversation } from "../../../src/lib/crm/automationQueue";
import { deliverN8nEvent } from "../../../src/lib/crm/n8nDelivery";
import type { N8nEventEnvelope } from "../../../src/lib/crm/n8nEventContract";

async function main() {
  if (process.env.N8N_E2E_ENABLED !== "true") {
    throw new Error("Defina N8N_E2E_ENABLED=true para autorizar o teste real.");
  }
  if (process.env.N8N_ENABLED !== "true") {
    throw new Error("Defina N8N_ENABLED=true somente durante o teste controlado.");
  }

  const requestedConversationId = process.env.N8N_E2E_CONVERSATION_ID?.trim();
  const conversation = requestedConversationId
    ? await prisma.conversation.findUnique({
        where: { id: requestedConversationId },
        select: { id: true },
      })
    : await prisma.conversation.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });

  if (!conversation) throw new Error("Nenhuma conversa disponível para vincular o job E2E.");

  const existingPending = await prisma.automationQueueJob.count({
    where: { conversationId: conversation.id, status: { in: ["pending", "processing"] } },
  });
  if (existingPending > 0) {
    throw new Error("A conversa escolhida possui jobs pendentes; use N8N_E2E_CONVERSATION_ID com uma conversa ociosa.");
  }

  const eventId = `n8n-e2e-${randomUUID()}`;
  const envelope: N8nEventEnvelope = {
    schemaVersion: 1,
    eventId,
    eventType: "LeadCreated",
    occurredAt: new Date().toISOString(),
    entityId: conversation.id,
    correlationId: eventId,
    causationId: eventId,
    resources: { conversationId: conversation.id },
    data: { source: "n8n_e2e" },
  };
  const job = await enqueueAutomationJob({
    conversationId: conversation.id,
    action: "EMIT_N8N_EVENT",
    payload: { event: envelope },
  });

  const result = await processNextAutomationJobForConversation(conversation.id, async queuedJob => {
    if (queuedJob.action !== "EMIT_N8N_EVENT" || !queuedJob.payload.event) {
      throw new Error("invalid_n8n_e2e_job");
    }
    const delivery = await deliverN8nEvent(queuedJob.payload.event);
    if (!delivery.delivered) throw new Error("n8n_e2e_delivery_disabled");
  });

  if (!result.ok || result.jobId !== job.id) {
    throw new Error(`O E2E n8n falhou; job=${job.id}; resultado=${JSON.stringify(result)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    eventId,
    jobId: job.id,
    conversationId: conversation.id,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : "n8n_e2e_failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
