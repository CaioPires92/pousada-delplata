-- Persist card brand (VISA, MASTER, etc.) for admin and receipts
ALTER TABLE "Payment" ADD COLUMN "cardBrand" TEXT;
