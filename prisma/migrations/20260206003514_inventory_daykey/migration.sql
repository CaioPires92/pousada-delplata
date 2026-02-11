/*
  Warnings:

  - Made the column `dateKey` on table `InventoryAdjustment` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomTypeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dateKey" TEXT NOT NULL,
    "totalUnits" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryAdjustment_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InventoryAdjustment" ("createdAt", "date", "dateKey", "id", "roomTypeId", "totalUnits", "updatedAt") SELECT "createdAt", "date", "dateKey", "id", "roomTypeId", "totalUnits", "updatedAt" FROM "InventoryAdjustment";
DROP TABLE "InventoryAdjustment";
ALTER TABLE "new_InventoryAdjustment" RENAME TO "InventoryAdjustment";
CREATE INDEX "InventoryAdjustment_dateKey_idx" ON "InventoryAdjustment"("dateKey");
CREATE UNIQUE INDEX "InventoryAdjustment_roomTypeId_date_key" ON "InventoryAdjustment"("roomTypeId", "date");
CREATE UNIQUE INDEX "InventoryAdjustment_roomTypeId_dateKey_key" ON "InventoryAdjustment"("roomTypeId", "dateKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
