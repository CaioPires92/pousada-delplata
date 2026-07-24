CREATE TABLE "DiscountPolicySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sendEnabled" BOOLEAN NOT NULL DEFAULT true,
    "percentage" INTEGER NOT NULL DEFAULT 10,
    "validityDays" INTEGER NOT NULL DEFAULT 7,
    "minimumBookingValue" DECIMAL,
    "maximumDiscountAmount" DECIMAL,
    "blockedDateRanges" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
