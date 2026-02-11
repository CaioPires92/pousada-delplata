-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "appliedCouponCode" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "expiredEmailSentAt" DATETIME;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "pendingEmailSentAt" DATETIME;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "subtotalPrice" DECIMAL;

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "maxDiscountAmount" DECIMAL,
    "minBookingValue" DECIMAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "maxGlobalUses" INTEGER,
    "maxUsesPerGuest" INTEGER,
    "bindEmail" TEXT,
    "bindPhone" TEXT,
    "allowedRoomTypeIds" TEXT,
    "allowedSources" TEXT,
    "singleUse" BOOLEAN NOT NULL DEFAULT true,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "couponId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "bookingId" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "reservedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "confirmedAt" DATETIME,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponRedemption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CouponAttemptLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "couponId" TEXT,
    "codePrefix" TEXT,
    "guestEmail" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "result" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponAttemptLog_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomTypeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dateKey" TEXT NOT NULL,
    "totalUnits" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryAdjustment_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InventoryAdjustment" ("createdAt", "date", "dateKey", "id", "roomTypeId", "totalUnits", "updatedAt") SELECT "createdAt", "date", "dateKey", "id", "roomTypeId", "totalUnits", "updatedAt" FROM "InventoryAdjustment";
DROP TABLE "InventoryAdjustment";
ALTER TABLE "new_InventoryAdjustment" RENAME TO "InventoryAdjustment";
CREATE INDEX "InventoryAdjustment_dateKey_idx" ON "InventoryAdjustment"("dateKey");
CREATE UNIQUE INDEX "InventoryAdjustment_roomTypeId_dateKey_key" ON "InventoryAdjustment"("roomTypeId", "dateKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_codeHash_key" ON "Coupon"("codeHash");

-- CreateIndex
CREATE INDEX "Coupon_codePrefix_idx" ON "Coupon"("codePrefix");

-- CreateIndex
CREATE INDEX "Coupon_active_idx" ON "Coupon"("active");

-- CreateIndex
CREATE INDEX "Coupon_startsAt_endsAt_idx" ON "Coupon"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_bookingId_key" ON "CouponRedemption"("bookingId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_status_idx" ON "CouponRedemption"("couponId", "status");

-- CreateIndex
CREATE INDEX "CouponRedemption_guestEmail_couponId_idx" ON "CouponRedemption"("guestEmail", "couponId");

-- CreateIndex
CREATE INDEX "CouponAttemptLog_createdAt_idx" ON "CouponAttemptLog"("createdAt");

-- CreateIndex
CREATE INDEX "CouponAttemptLog_codePrefix_idx" ON "CouponAttemptLog"("codePrefix");

