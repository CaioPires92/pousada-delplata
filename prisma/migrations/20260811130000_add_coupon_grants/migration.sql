CREATE TABLE "CouponGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "couponId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "issuedAt" DATETIME,
    "sentAt" DATETIME,
    "clickedAt" DATETIME,
    "redeemedAt" DATETIME,
    CONSTRAINT "CouponGrant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponGrant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponGrant_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CouponGrant_bookingId_key" ON "CouponGrant"("bookingId");
CREATE UNIQUE INDEX "CouponGrant_couponId_key" ON "CouponGrant"("couponId");
CREATE INDEX "CouponGrant_contactId_status_idx" ON "CouponGrant"("contactId", "status");
CREATE INDEX "CouponGrant_status_createdAt_idx" ON "CouponGrant"("status", "createdAt");
