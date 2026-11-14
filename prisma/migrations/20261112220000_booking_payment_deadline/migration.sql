-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "paymentDeadlineAt" DATETIME;

-- CreateIndex
CREATE INDEX "Booking_status_paymentDeadlineAt_idx" ON "Booking"("status", "paymentDeadlineAt");
