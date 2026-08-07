PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_PipelineCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NOVO_LEAD',
    "priority" TEXT NOT NULL DEFAULT 'media',
    "assignedUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "lastActivityAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "estimatedValue" REAL,
    "intendedArrival" DATETIME,
    "intendedCheckin" DATETIME,
    "intendedCheckout" DATETIME,
    "adults" INTEGER,
    "children" INTEGER,
    "roomTypeInterest" TEXT,
    "lossReason" TEXT,
    "lostReason" TEXT,
    "bookingId" TEXT,
    "tags" TEXT,
    "followUpAt" DATETIME,
    "quoteStatus" TEXT,
    "upsellStatus" TEXT,
    CONSTRAINT "PipelineCard_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PipelineCard_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_PipelineCard" (
    "adults", "assignedUserId", "bookingId", "children", "contactId",
    "conversationId", "createdAt", "estimatedValue", "followUpAt", "id",
    "intendedArrival", "intendedCheckin", "intendedCheckout", "lastActivityAt",
    "lossReason", "lostReason", "priority", "quoteStatus", "roomTypeInterest",
    "source", "stage", "tags", "updatedAt", "upsellStatus"
)
SELECT
    "adults", "assignedUserId", "bookingId", "children", "contactId",
    "conversationId", "createdAt", "estimatedValue", "followUpAt", "id",
    "intendedArrival", "intendedCheckin", "intendedCheckout", "lastActivityAt",
    "lossReason", "lostReason", "priority", "quoteStatus", "roomTypeInterest",
    "source", CASE WHEN "stage" = 'novo' THEN 'NOVO_LEAD' ELSE "stage" END,
    "tags", "updatedAt", "upsellStatus"
FROM "PipelineCard";

DROP TABLE "PipelineCard";
ALTER TABLE "new_PipelineCard" RENAME TO "PipelineCard";
CREATE INDEX "PipelineCard_contactId_idx" ON "PipelineCard"("contactId");
CREATE INDEX "PipelineCard_conversationId_idx" ON "PipelineCard"("conversationId");
CREATE INDEX "PipelineCard_stage_priority_idx" ON "PipelineCard"("stage", "priority");
CREATE INDEX "PipelineCard_assignedUserId_idx" ON "PipelineCard"("assignedUserId");
CREATE INDEX "PipelineCard_lastActivityAt_idx" ON "PipelineCard"("lastActivityAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
