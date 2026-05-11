-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "chatbotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "automationPausedUntil" DATETIME,
    "assignedUserId" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" DATETIME,
    "lastMessageAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("assignedUserId", "automationPausedUntil", "channel", "chatbotEnabled", "contactId", "createdAt", "id", "lastMessageAt", "status", "updatedAt") SELECT "assignedUserId", "automationPausedUntil", "channel", "chatbotEnabled", "contactId", "createdAt", "id", "lastMessageAt", "status", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");
CREATE INDEX "Conversation_channel_status_idx" ON "Conversation"("channel", "status");
CREATE INDEX "Conversation_assignedUserId_idx" ON "Conversation"("assignedUserId");
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
