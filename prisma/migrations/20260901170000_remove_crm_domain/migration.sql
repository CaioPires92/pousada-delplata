-- DropIndex
DROP INDEX "AutomationQueueJob_status_scheduledAt_idx";

-- DropIndex
DROP INDEX "AutomationQueueJob_dedupeKey_key";

-- DropIndex
DROP INDEX "AutomationQueueJob_status_createdAt_idx";

-- DropIndex
DROP INDEX "AutomationQueueJob_conversationId_status_createdAt_idx";

-- DropIndex
DROP INDEX "ChatbotRule_trigger_key";

-- DropIndex
DROP INDEX "Contact_createdAt_idx";

-- DropIndex
DROP INDEX "Contact_status_idx";

-- DropIndex
DROP INDEX "Contact_source_idx";

-- DropIndex
DROP INDEX "Contact_email_idx";

-- DropIndex
DROP INDEX "Contact_whatsappJid_key";

-- DropIndex
DROP INDEX "Contact_lid_key";

-- DropIndex
DROP INDEX "Contact_phone_key";

-- DropIndex
DROP INDEX "Conversation_awaitingHumanResponse_waitingSince_idx";

-- DropIndex
DROP INDEX "Conversation_lastMessageAt_idx";

-- DropIndex
DROP INDEX "Conversation_assignedUserId_idx";

-- DropIndex
DROP INDEX "Conversation_channel_status_idx";

-- DropIndex
DROP INDEX "Conversation_contactId_idx";

-- DropIndex
DROP INDEX "CouponGrant_status_createdAt_idx";

-- DropIndex
DROP INDEX "CouponGrant_contactId_status_idx";

-- DropIndex
DROP INDEX "CouponGrant_couponId_key";

-- DropIndex
DROP INDEX "CouponGrant_bookingId_key";

-- DropIndex
DROP INDEX "CrmEventReceipt_status_createdAt_idx";

-- DropIndex
DROP INDEX "CrmEventReceipt_source_eventType_idx";

-- DropIndex
DROP INDEX "DeadLetterQueueItem_source_action_idx";

-- DropIndex
DROP INDEX "DeadLetterQueueItem_conversationId_createdAt_idx";

-- DropIndex
DROP INDEX "DeadLetterQueueItem_status_createdAt_idx";

-- DropIndex
DROP INDEX "InternalActionLog_createdAt_idx";

-- DropIndex
DROP INDEX "InternalActionLog_action_idx";

-- DropIndex
DROP INDEX "InternalActionLog_bookingId_idx";

-- DropIndex
DROP INDEX "InternalActionLog_conversationId_idx";

-- DropIndex
DROP INDEX "InternalActionLog_contactId_idx";

-- DropIndex
DROP INDEX "InternalActionLog_userId_idx";

-- DropIndex
DROP INDEX "InternalNote_createdAt_idx";

-- DropIndex
DROP INDEX "InternalNote_conversationId_idx";

-- DropIndex
DROP INDEX "Message_externalMessageId_idx";

-- DropIndex
DROP INDEX "Message_messageType_idx";

-- DropIndex
DROP INDEX "Message_senderType_idx";

-- DropIndex
DROP INDEX "Message_conversationId_sentAt_idx";

-- DropIndex
DROP INDEX "Message_conversationId_externalMessageId_key";

-- DropIndex
DROP INDEX "MessagingWebhookEvent_externalMessageId_idx";

-- DropIndex
DROP INDEX "MessagingWebhookEvent_processingStatus_receivedAt_idx";

-- DropIndex
DROP INDEX "MessagingWebhookEvent_provider_externalEventId_eventKind_key";

-- DropIndex
DROP INDEX "PipelineCard_lastActivityAt_idx";

-- DropIndex
DROP INDEX "PipelineCard_assignedUserId_idx";

-- DropIndex
DROP INDEX "PipelineCard_stage_priority_idx";

-- DropIndex
DROP INDEX "PipelineCard_conversationId_idx";

-- DropIndex
DROP INDEX "PipelineCard_contactId_idx";

-- DropIndex
DROP INDEX "PipelineCard_bookingId_key";

-- DropIndex
DROP INDEX "PipelineStageHistory_fromStage_toStage_idx";

-- DropIndex
DROP INDEX "PipelineStageHistory_pipelineCardId_createdAt_idx";

-- DropIndex
DROP INDEX "ReservationDraft_status_idx";

-- DropIndex
DROP INDEX "ReservationDraft_pipelineCardId_idx";

-- DropIndex
DROP INDEX "ReservationDraft_conversationId_updatedAt_idx";

-- DropIndex
DROP INDEX "ReservationDraft_contactId_createdAt_idx";

-- DropIndex
DROP INDEX "SupervisedReplySuggestion_rolloutIntent_status_reviewedAt_idx";

-- DropIndex
DROP INDEX "SupervisedReplySuggestion_status_createdAt_idx";

-- DropIndex
DROP INDEX "SupervisedReplySuggestion_conversationId_status_createdAt_idx";

-- DropIndex
DROP INDEX "SupervisedReplySuggestion_sourceMessageId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AutomationQueueJob";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ChatbotRule";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ChatbotSettings";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Contact";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Conversation";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CouponGrant";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CrmEventReceipt";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DeadLetterQueueItem";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "FollowUpSettings";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InternalActionLog";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InternalNote";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Message";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MessagingWebhookEvent";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PipelineCard";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PipelineStageHistory";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PostStaySettings";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ReservationDraft";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SupervisedReplySuggestion";
PRAGMA foreign_keys=on;

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
    "checkoutConfirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("adults", "appliedCouponCode", "checkIn", "checkOut", "checkoutConfirmedAt", "children", "childrenAges", "confirmationEmailSentAt", "createdAt", "discountAmount", "expiredEmailSentAt", "funnelStage", "funnelUpdatedAt", "guestId", "id", "lastErrorMessage", "pendingEmailSentAt", "roomTypeId", "status", "subtotalPrice", "totalPrice", "updatedAt") SELECT "adults", "appliedCouponCode", "checkIn", "checkOut", "checkoutConfirmedAt", "children", "childrenAges", "confirmationEmailSentAt", "createdAt", "discountAmount", "expiredEmailSentAt", "funnelStage", "funnelUpdatedAt", "guestId", "id", "lastErrorMessage", "pendingEmailSentAt", "roomTypeId", "status", "subtotalPrice", "totalPrice", "updatedAt" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_checkoutConfirmedAt_idx" ON "Booking"("checkoutConfirmedAt");
CREATE TABLE "new_Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "codeCiphertext" TEXT,
    "type" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "maxDiscountAmount" DECIMAL,
    "minBookingValue" DECIMAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "maxGlobalUses" INTEGER,
    "maxUsesPerGuest" INTEGER,
    "bindEmail" TEXT,
    "bindPhone" TEXT,
    "originBookingId" TEXT,
    "allowedRoomTypeIds" TEXT,
    "allowedSources" TEXT,
    "singleUse" BOOLEAN NOT NULL DEFAULT false,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Coupon_originBookingId_fkey" FOREIGN KEY ("originBookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Coupon" ("active", "allowedRoomTypeIds", "allowedSources", "bindEmail", "bindPhone", "codeCiphertext", "codeHash", "codePrefix", "createdAt", "endsAt", "id", "maxDiscountAmount", "maxGlobalUses", "maxUsesPerGuest", "minBookingValue", "name", "originBookingId", "singleUse", "stackable", "startsAt", "type", "updatedAt", "value") SELECT "active", "allowedRoomTypeIds", "allowedSources", "bindEmail", "bindPhone", "codeCiphertext", "codeHash", "codePrefix", "createdAt", "endsAt", "id", "maxDiscountAmount", "maxGlobalUses", "maxUsesPerGuest", "minBookingValue", "name", "originBookingId", "singleUse", "stackable", "startsAt", "type", "updatedAt", "value" FROM "Coupon";
DROP TABLE "Coupon";
ALTER TABLE "new_Coupon" RENAME TO "Coupon";
CREATE UNIQUE INDEX "Coupon_codeHash_key" ON "Coupon"("codeHash");
CREATE INDEX "Coupon_codePrefix_idx" ON "Coupon"("codePrefix");
CREATE INDEX "Coupon_active_idx" ON "Coupon"("active");
CREATE INDEX "Coupon_originBookingId_idx" ON "Coupon"("originBookingId");
CREATE INDEX "Coupon_startsAt_endsAt_idx" ON "Coupon"("startsAt", "endsAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

