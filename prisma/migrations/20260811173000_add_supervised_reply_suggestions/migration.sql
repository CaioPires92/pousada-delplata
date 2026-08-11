CREATE TABLE "SupervisedReplySuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "sentMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupervisedReplySuggestion_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SupervisedReplySuggestion_sourceMessageId_key"
ON "SupervisedReplySuggestion"("sourceMessageId");

CREATE INDEX "SupervisedReplySuggestion_conversationId_status_createdAt_idx"
ON "SupervisedReplySuggestion"("conversationId", "status", "createdAt");

CREATE INDEX "SupervisedReplySuggestion_status_createdAt_idx"
ON "SupervisedReplySuggestion"("status", "createdAt");
