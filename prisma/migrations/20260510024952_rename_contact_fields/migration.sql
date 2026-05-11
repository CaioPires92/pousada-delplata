/*
  Warnings:

  - You are about to drop the column `phoneNormalized` on the `Contact` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PipelineCard" ADD COLUMN "bookingId" TEXT;
ALTER TABLE "PipelineCard" ADD COLUMN "estimatedValue" REAL;
ALTER TABLE "PipelineCard" ADD COLUMN "intendedArrival" DATETIME;
ALTER TABLE "PipelineCard" ADD COLUMN "lossReason" TEXT;

-- CreateTable
CREATE TABLE "ChatbotRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trigger" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'faq',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "phoneRaw" TEXT,
    "phone" TEXT,
    "lid" TEXT,
    "whatsappJid" TEXT,
    "email" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'lead',
    "optInWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "optOutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Contact" ("createdAt", "email", "id", "name", "optInWhatsapp", "optOutAt", "phoneRaw", "source", "status", "updatedAt") SELECT "createdAt", "email", "id", "name", "optInWhatsapp", "optOutAt", "phoneRaw", "source", "status", "updatedAt" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE UNIQUE INDEX "Contact_phone_key" ON "Contact"("phone");
CREATE UNIQUE INDEX "Contact_lid_key" ON "Contact"("lid");
CREATE UNIQUE INDEX "Contact_whatsappJid_key" ON "Contact"("whatsappJid");
CREATE INDEX "Contact_email_idx" ON "Contact"("email");
CREATE INDEX "Contact_source_idx" ON "Contact"("source");
CREATE INDEX "Contact_status_idx" ON "Contact"("status");
CREATE INDEX "Contact_createdAt_idx" ON "Contact"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotRule_trigger_key" ON "ChatbotRule"("trigger");

-- CreateIndex
CREATE INDEX "InternalNote_conversationId_idx" ON "InternalNote"("conversationId");

-- CreateIndex
CREATE INDEX "InternalNote_createdAt_idx" ON "InternalNote"("createdAt");
