-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "badgeLabel" TEXT,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "discountPercent" DECIMAL NOT NULL,
    "maxDiscountAmount" DECIMAL,
    "minDaysBeforeCheckIn" INTEGER,
    "maxDaysBeforeCheckIn" INTEGER,
    "stayStart" DATETIME,
    "stayEnd" DATETIME,
    "bookableFrom" DATETIME,
    "bookableUntil" DATETIME,
    "minNights" INTEGER,
    "allowedRoomTypeIds" TEXT,
    "stackWithCoupons" BOOLEAN NOT NULL DEFAULT false,
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "promotionId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "promotionName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "promotionDiscount" DECIMAL;

-- CreateIndex
CREATE INDEX "Promotion_active_idx" ON "Promotion"("active");
CREATE INDEX "Promotion_type_idx" ON "Promotion"("type");
