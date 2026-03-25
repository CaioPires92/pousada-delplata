CREATE TABLE "FourGuestInventoryAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomTypeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dateKey" TEXT NOT NULL,
    "totalUnits" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FourGuestInventoryAdjustment_roomTypeId_fkey"
      FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FourGuestInventoryAdjustment_roomTypeId_dateKey_key"
ON "FourGuestInventoryAdjustment"("roomTypeId", "dateKey");

CREATE INDEX "FourGuestInventoryAdjustment_dateKey_idx"
ON "FourGuestInventoryAdjustment"("dateKey");
