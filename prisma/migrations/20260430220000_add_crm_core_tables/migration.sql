-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "phoneRaw" TEXT,
    "phoneNormalized" TEXT,
    "email" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'lead',
    "optInWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "optOutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "chatbotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "automationPausedUntil" DATETIME,
    "assignedUserId" TEXT,
    "lastMessageAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "senderType" TEXT NOT NULL,
    "content" TEXT,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "mediaUrl" TEXT,
    "metadataJson" TEXT,
    "sentAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PipelineCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'novo',
    "priority" TEXT NOT NULL DEFAULT 'media',
    "assignedUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "lastActivityAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineCard_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PipelineCard_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatbotSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabledGlobal" BOOLEAN NOT NULL DEFAULT false,
    "enabledWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "enabledSite" BOOLEAN NOT NULL DEFAULT false,
    "defaultHandoffMessage" TEXT,
    "maxAutoReplyDelaySeconds" INTEGER NOT NULL DEFAULT 30,
    "staleAvailabilityLimitMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InternalActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "contactId" TEXT,
    "conversationId" TEXT,
    "bookingId" TEXT,
    "action" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternalActionLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalActionLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_phoneNormalized_key" ON "Contact"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_source_idx" ON "Contact"("source");

-- CreateIndex
CREATE INDEX "Contact_status_idx" ON "Contact"("status");

-- CreateIndex
CREATE INDEX "Contact_createdAt_idx" ON "Contact"("createdAt");

-- CreateIndex
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");

-- CreateIndex
CREATE INDEX "Conversation_channel_status_idx" ON "Conversation"("channel", "status");

-- CreateIndex
CREATE INDEX "Conversation_assignedUserId_idx" ON "Conversation"("assignedUserId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_externalMessageId_key" ON "Message"("conversationId", "externalMessageId");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_idx" ON "Message"("conversationId", "sentAt");

-- CreateIndex
CREATE INDEX "Message_senderType_idx" ON "Message"("senderType");

-- CreateIndex
CREATE INDEX "Message_messageType_idx" ON "Message"("messageType");

-- CreateIndex
CREATE INDEX "PipelineCard_contactId_idx" ON "PipelineCard"("contactId");

-- CreateIndex
CREATE INDEX "PipelineCard_conversationId_idx" ON "PipelineCard"("conversationId");

-- CreateIndex
CREATE INDEX "PipelineCard_stage_priority_idx" ON "PipelineCard"("stage", "priority");

-- CreateIndex
CREATE INDEX "PipelineCard_assignedUserId_idx" ON "PipelineCard"("assignedUserId");

-- CreateIndex
CREATE INDEX "PipelineCard_lastActivityAt_idx" ON "PipelineCard"("lastActivityAt");

-- CreateIndex
CREATE INDEX "InternalActionLog_userId_idx" ON "InternalActionLog"("userId");

-- CreateIndex
CREATE INDEX "InternalActionLog_contactId_idx" ON "InternalActionLog"("contactId");

-- CreateIndex
CREATE INDEX "InternalActionLog_conversationId_idx" ON "InternalActionLog"("conversationId");

-- CreateIndex
CREATE INDEX "InternalActionLog_bookingId_idx" ON "InternalActionLog"("bookingId");

-- CreateIndex
CREATE INDEX "InternalActionLog_action_idx" ON "InternalActionLog"("action");

-- CreateIndex
CREATE INDEX "InternalActionLog_createdAt_idx" ON "InternalActionLog"("createdAt");
