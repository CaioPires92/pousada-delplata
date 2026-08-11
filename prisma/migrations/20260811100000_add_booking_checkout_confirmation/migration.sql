ALTER TABLE "Booking" ADD COLUMN "checkoutConfirmedAt" DATETIME;

CREATE INDEX "Booking_checkoutConfirmedAt_idx" ON "Booking"("checkoutConfirmedAt");
