-- Additive migration: simple automation queue + dead letter queue.
CREATE TABLE "AutomationQueueJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "startedAt" DATETIME,
  "finishedAt" DATETIME,
  CONSTRAINT "AutomationQueueJob_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DeadLetterQueueItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT,
  "source" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "replayedAt" DATETIME,
  CONSTRAINT "DeadLetterQueueItem_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AutomationQueueJob_conversationId_status_createdAt_idx" ON "AutomationQueueJob"("conversationId", "status", "createdAt");
CREATE INDEX "AutomationQueueJob_status_createdAt_idx" ON "AutomationQueueJob"("status", "createdAt");
CREATE INDEX "DeadLetterQueueItem_status_createdAt_idx" ON "DeadLetterQueueItem"("status", "createdAt");
CREATE INDEX "DeadLetterQueueItem_conversationId_createdAt_idx" ON "DeadLetterQueueItem"("conversationId", "createdAt");
CREATE INDEX "DeadLetterQueueItem_source_action_idx" ON "DeadLetterQueueItem"("source", "action");
