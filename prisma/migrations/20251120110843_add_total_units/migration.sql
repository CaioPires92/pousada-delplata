-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RoomType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "totalUnits" INTEGER NOT NULL DEFAULT 1,
    "basePrice" DECIMAL NOT NULL,
    "amenities" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RoomType" ("amenities", "basePrice", "capacity", "createdAt", "description", "id", "name", "updatedAt") SELECT "amenities", "basePrice", "capacity", "createdAt", "description", "id", "name", "updatedAt" FROM "RoomType";
DROP TABLE "RoomType";
ALTER TABLE "new_RoomType" RENAME TO "RoomType";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
