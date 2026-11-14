ALTER TABLE "Booking" ADD COLUMN "hospedinReservationId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "hospedinRegisteredAt" DATETIME;

CREATE INDEX "Booking_hospedinRegisteredAt_idx" ON "Booking"("hospedinRegisteredAt");
