CREATE TABLE "CrmEventReceipt" (
    "eventId" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "resultJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

CREATE INDEX "CrmEventReceipt_source_eventType_idx" ON "CrmEventReceipt"("source", "eventType");
CREATE INDEX "CrmEventReceipt_status_createdAt_idx" ON "CrmEventReceipt"("status", "createdAt");
