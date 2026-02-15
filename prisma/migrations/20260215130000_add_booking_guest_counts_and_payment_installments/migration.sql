-- Persist guest counts on booking for receipts and operations
ALTER TABLE "Booking" ADD COLUMN "adults" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN "children" INTEGER NOT NULL DEFAULT 0;

-- Persist installments for credit-card payments
ALTER TABLE "Payment" ADD COLUMN "installments" INTEGER;
