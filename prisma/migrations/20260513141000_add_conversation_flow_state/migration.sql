-- Additive migration: conversational flow state for CRM automation.
ALTER TABLE "Conversation" ADD COLUMN "currentFlow" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "flowStep" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "flowDataJson" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "lastAutomationAt" DATETIME;
