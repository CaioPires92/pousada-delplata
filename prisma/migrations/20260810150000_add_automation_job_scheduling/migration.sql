ALTER TABLE "AutomationQueueJob" ADD COLUMN "journeyType" TEXT;
ALTER TABLE "AutomationQueueJob" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "AutomationQueueJob" ADD COLUMN "scheduledAt" DATETIME;

UPDATE "AutomationQueueJob"
SET "scheduledAt" = "createdAt"
WHERE "scheduledAt" IS NULL;

CREATE UNIQUE INDEX "AutomationQueueJob_dedupeKey_key"
ON "AutomationQueueJob"("dedupeKey");

CREATE INDEX "AutomationQueueJob_status_scheduledAt_idx"
ON "AutomationQueueJob"("status", "scheduledAt");
