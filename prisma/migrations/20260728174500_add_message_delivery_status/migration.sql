ALTER TABLE "Message" ADD COLUMN "deliveryStatus" TEXT;
ALTER TABLE "Message" ADD COLUMN "deliveryErrorCode" TEXT;
ALTER TABLE "Message" ADD COLUMN "deliveryErrorTitle" TEXT;
ALTER TABLE "Message" ADD COLUMN "deliveryErrorDetail" TEXT;
ALTER TABLE "Message" ADD COLUMN "deliveryUpdatedAt" DATETIME;

CREATE INDEX "Message_externalMessageId_idx" ON "Message"("externalMessageId");
