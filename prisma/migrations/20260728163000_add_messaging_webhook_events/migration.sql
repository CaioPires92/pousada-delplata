CREATE TABLE "MessagingWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "normalizedEventJson" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "MessagingWebhookEvent_provider_externalEventId_eventKind_key"
ON "MessagingWebhookEvent"("provider", "externalEventId", "eventKind");

CREATE INDEX "MessagingWebhookEvent_processingStatus_receivedAt_idx"
ON "MessagingWebhookEvent"("processingStatus", "receivedAt");

CREATE INDEX "MessagingWebhookEvent_externalMessageId_idx"
ON "MessagingWebhookEvent"("externalMessageId");
