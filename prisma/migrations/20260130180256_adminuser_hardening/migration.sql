/*
  Warnings:

  - You are about to drop the column `password` on the `AdminUser` table. All the data in the column will be lost.
  - Added the required column `passwordHash` to the `AdminUser` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AdminUser" ("createdAt", "email", "id", "name", "updatedAt", "passwordHash", "isActive") SELECT "createdAt", "email", "id", "name", "updatedAt", 'INVALID', false FROM "AdminUser";
DROP TABLE "AdminUser";
ALTER TABLE "new_AdminUser" RENAME TO "AdminUser";
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE TABLE "new_InventoryAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomTypeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "totalUnits" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryAdjustment_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InventoryAdjustment" ("createdAt", "date", "id", "roomTypeId", "totalUnits", "updatedAt") SELECT "createdAt", "date", "id", "roomTypeId", "totalUnits", "updatedAt" FROM "InventoryAdjustment";
DROP TABLE "InventoryAdjustment";
ALTER TABLE "new_InventoryAdjustment" RENAME TO "InventoryAdjustment";
CREATE UNIQUE INDEX "InventoryAdjustment_roomTypeId_date_key" ON "InventoryAdjustment"("roomTypeId", "date");
CREATE TABLE "new_Rate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomTypeId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "cta" BOOLEAN NOT NULL DEFAULT false,
    "ctd" BOOLEAN NOT NULL DEFAULT false,
    "stopSell" BOOLEAN NOT NULL DEFAULT false,
    "minLos" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Rate" ("createdAt", "endDate", "id", "price", "roomTypeId", "startDate", "updatedAt") SELECT "createdAt", "endDate", "id", "price", "roomTypeId", "startDate", "updatedAt" FROM "Rate";
DROP TABLE "Rate";
ALTER TABLE "new_Rate" RENAME TO "Rate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
