ALTER TABLE "Conversation"
ADD COLUMN "automationMode" TEXT NOT NULL DEFAULT 'off';

UPDATE "Conversation"
SET "automationMode" = CASE
  WHEN "chatbotEnabled" = true THEN 'auto'
  ELSE 'off'
END;
