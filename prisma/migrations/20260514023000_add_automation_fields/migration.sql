-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "lastCustomerMessageAt" DATETIME;
ALTER TABLE "Conversation" ADD COLUMN "lastHumanMessageAt" DATETIME;

-- AlterTable
ALTER TABLE "PipelineCard" ADD COLUMN "tags" TEXT;
ALTER TABLE "PipelineCard" ADD COLUMN "followUpAt" DATETIME;
ALTER TABLE "PipelineCard" ADD COLUMN "quoteStatus" TEXT;
ALTER TABLE "PipelineCard" ADD COLUMN "upsellStatus" TEXT;
