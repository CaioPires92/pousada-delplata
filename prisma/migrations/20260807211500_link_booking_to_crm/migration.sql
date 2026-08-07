-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "childrenAges" TEXT,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "totalPrice" DECIMAL NOT NULL,
    "subtotalPrice" DECIMAL,
    "discountAmount" DECIMAL,
    "appliedCouponCode" TEXT,
    "status" TEXT NOT NULL,
    "funnelStage" TEXT,
    "funnelUpdatedAt" DATETIME,
    "lastErrorMessage" TEXT,
    "pendingEmailSentAt" DATETIME,
    "expiredEmailSentAt" DATETIME,
    "confirmationEmailSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "crmContactId" TEXT,
    "crmConversationId" TEXT,
    CONSTRAINT "Booking_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_crmConversationId_fkey" FOREIGN KEY ("crmConversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("adults", "appliedCouponCode", "checkIn", "checkOut", "children", "childrenAges", "confirmationEmailSentAt", "createdAt", "discountAmount", "expiredEmailSentAt", "funnelStage", "funnelUpdatedAt", "guestId", "id", "lastErrorMessage", "pendingEmailSentAt", "roomTypeId", "status", "subtotalPrice", "totalPrice", "updatedAt") SELECT "adults", "appliedCouponCode", "checkIn", "checkOut", "children", "childrenAges", "confirmationEmailSentAt", "createdAt", "discountAmount", "expiredEmailSentAt", "funnelStage", "funnelUpdatedAt", "guestId", "id", "lastErrorMessage", "pendingEmailSentAt", "roomTypeId", "status", "subtotalPrice", "totalPrice", "updatedAt" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_crmContactId_idx" ON "Booking"("crmContactId");
CREATE INDEX "Booking_crmConversationId_idx" ON "Booking"("crmConversationId");

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
    CONSTRAINT "PipelineCard_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PipelineCard_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PipelineCard" ("adults", "assignedUserId", "bookingId", "children", "contactId", "conversationId", "createdAt", "estimatedValue", "followUpAt", "id", "intendedArrival", "intendedCheckin", "intendedCheckout", "lastActivityAt", "lossReason", "lostReason", "priority", "quoteStatus", "roomTypeInterest", "source", "stage", "tags", "updatedAt", "upsellStatus") SELECT "adults", "assignedUserId", "bookingId", "children", "contactId", "conversationId", "createdAt", "estimatedValue", "followUpAt", "id", "intendedArrival", "intendedCheckin", "intendedCheckout", "lastActivityAt", "lossReason", "lostReason", "priority", "quoteStatus", "roomTypeInterest", "source", "stage", "tags", "updatedAt", "upsellStatus" FROM "PipelineCard";
DROP TABLE "PipelineCard";
ALTER TABLE "new_PipelineCard" RENAME TO "PipelineCard";
CREATE UNIQUE INDEX "PipelineCard_bookingId_key" ON "PipelineCard"("bookingId");
CREATE INDEX "PipelineCard_contactId_idx" ON "PipelineCard"("contactId");
CREATE INDEX "PipelineCard_conversationId_idx" ON "PipelineCard"("conversationId");
CREATE INDEX "PipelineCard_stage_priority_idx" ON "PipelineCard"("stage", "priority");
CREATE INDEX "PipelineCard_assignedUserId_idx" ON "PipelineCard"("assignedUserId");
CREATE INDEX "PipelineCard_lastActivityAt_idx" ON "PipelineCard"("lastActivityAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
