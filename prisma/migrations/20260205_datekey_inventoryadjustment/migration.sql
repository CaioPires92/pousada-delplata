-- SQLite migration: add dateKey and indexes

ALTER TABLE "InventoryAdjustment" ADD COLUMN "dateKey" TEXT;

-- backfill (se a coluna legacy "date" existir e tiver valores válidos)
UPDATE "InventoryAdjustment"
SET "dateKey" = date("date")
WHERE "dateKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryAdjustment_roomTypeId_dateKey_key"
ON "InventoryAdjustment" ("roomTypeId", "dateKey");

CREATE INDEX IF NOT EXISTS "InventoryAdjustment_dateKey_idx"
ON "InventoryAdjustment" ("dateKey");
