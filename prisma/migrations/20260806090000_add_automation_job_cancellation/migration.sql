ALTER TABLE "AutomationQueueJob"
ADD COLUMN "cancelledAt" DATETIME;

ALTER TABLE "AutomationQueueJob"
ADD COLUMN "cancelReason" TEXT;
