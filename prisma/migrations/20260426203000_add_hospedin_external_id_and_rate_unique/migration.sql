-- AlterTable
ALTER TABLE "RoomType" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Rate_roomTypeId_startDate_endDate_key" ON "Rate"("roomTypeId", "startDate", "endDate");
