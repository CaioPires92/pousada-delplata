ALTER TABLE "Coupon" ADD COLUMN "originBookingId" TEXT
    REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Coupon_originBookingId_idx" ON "Coupon"("originBookingId");
