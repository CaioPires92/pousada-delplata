-- Additive migration: stage movement audit history for CRM pipeline.
CREATE TABLE "PipelineStageHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pipelineCardId" TEXT NOT NULL,
  "fromStage" TEXT NOT NULL,
  "toStage" TEXT NOT NULL,
  "actorType" TEXT NOT NULL DEFAULT 'system',
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineStageHistory_pipelineCardId_fkey" FOREIGN KEY ("pipelineCardId") REFERENCES "PipelineCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PipelineStageHistory_pipelineCardId_createdAt_idx" ON "PipelineStageHistory"("pipelineCardId", "createdAt");
CREATE INDEX "PipelineStageHistory_fromStage_toStage_idx" ON "PipelineStageHistory"("fromStage", "toStage");
