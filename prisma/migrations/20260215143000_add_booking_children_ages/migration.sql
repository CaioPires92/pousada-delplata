-- Persist child ages for audit/receipt history
ALTER TABLE "Booking" ADD COLUMN "childrenAges" TEXT;
