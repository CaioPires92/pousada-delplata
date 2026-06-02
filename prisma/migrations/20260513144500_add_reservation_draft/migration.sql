-- Additive migration: assisted reservation draft context.
CREATE TABLE "ReservationDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contactId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "pipelineCardId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "guestName" TEXT,
  "guestCpf" TEXT,
  "guestEmail" TEXT,
  "paymentMethod" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReservationDraft_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReservationDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReservationDraft_pipelineCardId_fkey" FOREIGN KEY ("pipelineCardId") REFERENCES "PipelineCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ReservationDraft_contactId_createdAt_idx" ON "ReservationDraft"("contactId", "createdAt");
CREATE INDEX "ReservationDraft_conversationId_updatedAt_idx" ON "ReservationDraft"("conversationId", "updatedAt");
CREATE INDEX "ReservationDraft_pipelineCardId_idx" ON "ReservationDraft"("pipelineCardId");
CREATE INDEX "ReservationDraft_status_idx" ON "ReservationDraft"("status");
