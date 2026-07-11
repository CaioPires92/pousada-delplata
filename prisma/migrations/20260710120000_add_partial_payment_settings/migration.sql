CREATE TABLE "PartialPaymentSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "percentage" INTEGER NOT NULL DEFAULT 50,
    "minimumBookingAmount" DECIMAL,
    "minimumLeadTimeDays" INTEGER,
    "balanceDueAt" TEXT NOT NULL DEFAULT 'CHECK_IN',
    "balanceDueDaysBeforeCheckIn" INTEGER,
    "defaultPaymentMode" TEXT NOT NULL DEFAULT 'FULL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

ALTER TABLE "Payment" ADD COLUMN "totalAmount" DECIMAL;
ALTER TABLE "Payment" ADD COLUMN "remainingAmount" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "paymentMode" TEXT NOT NULL DEFAULT 'FULL';
ALTER TABLE "Payment" ADD COLUMN "balanceDueAt" TEXT;
ALTER TABLE "Payment" ADD COLUMN "balanceDueDate" DATETIME;
