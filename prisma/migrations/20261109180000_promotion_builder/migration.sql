-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN "allowedCouponIds" TEXT;
ALTER TABLE "Promotion" ADD COLUMN "allowedPromotionIds" TEXT;
ALTER TABLE "Promotion" ADD COLUMN "stackWithPromotions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "promotionBreakdown" TEXT;
