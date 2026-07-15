UPDATE "Booking"
SET "confirmationEmailSentAt" = COALESCE("updatedAt", "createdAt")
WHERE "status" = 'CONFIRMED'
  AND "confirmationEmailSentAt" IS NULL;
