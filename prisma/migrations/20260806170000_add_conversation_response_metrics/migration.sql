ALTER TABLE "Conversation" ADD COLUMN "firstCustomerMessageAt" DATETIME;
ALTER TABLE "Conversation" ADD COLUMN "firstHumanResponseAt" DATETIME;
ALTER TABLE "Conversation" ADD COLUMN "firstResponseTimeSeconds" INTEGER;
ALTER TABLE "Conversation" ADD COLUMN "awaitingHumanResponse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "waitingSince" DATETIME;

UPDATE "Conversation"
SET
  "lastCustomerMessageAt" = COALESCE(
    "lastCustomerMessageAt",
    (SELECT MAX(COALESCE("sentAt", "createdAt")) FROM "Message"
      WHERE "conversationId" = "Conversation"."id" AND "senderType" = 'guest')
  ),
  "lastHumanMessageAt" = COALESCE(
    "lastHumanMessageAt",
    (SELECT MAX(COALESCE("sentAt", "createdAt")) FROM "Message"
      WHERE "conversationId" = "Conversation"."id" AND "senderType" = 'human')
  ),
  "firstCustomerMessageAt" = (
    SELECT MIN(COALESCE("sentAt", "createdAt")) FROM "Message"
    WHERE "conversationId" = "Conversation"."id" AND "senderType" = 'guest'
  );

UPDATE "Conversation"
SET
  "firstHumanResponseAt" = (
    SELECT MIN(COALESCE("sentAt", "createdAt")) FROM "Message"
    WHERE "conversationId" = "Conversation"."id"
      AND "senderType" = 'human'
      AND COALESCE("sentAt", "createdAt") >= "Conversation"."firstCustomerMessageAt"
  );

UPDATE "Conversation"
SET
  "firstResponseTimeSeconds" = CASE
    WHEN "firstCustomerMessageAt" IS NOT NULL AND "firstHumanResponseAt" IS NOT NULL
      THEN MAX(0, CAST((julianday("firstHumanResponseAt") - julianday("firstCustomerMessageAt")) * 86400 AS INTEGER))
    ELSE NULL
  END,
  "awaitingHumanResponse" = CASE
    WHEN "lastCustomerMessageAt" IS NOT NULL
      AND ("lastHumanMessageAt" IS NULL OR "lastCustomerMessageAt" > "lastHumanMessageAt")
      THEN true
    ELSE false
  END,
  "waitingSince" = CASE
    WHEN "lastCustomerMessageAt" IS NOT NULL
      AND ("lastHumanMessageAt" IS NULL OR "lastCustomerMessageAt" > "lastHumanMessageAt")
      THEN "lastCustomerMessageAt"
    ELSE NULL
  END;

CREATE INDEX "Conversation_awaitingHumanResponse_waitingSince_idx"
ON "Conversation"("awaitingHumanResponse", "waitingSince");
