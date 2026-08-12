ALTER TABLE "SupervisedReplySuggestion" ADD COLUMN "rolloutIntent" TEXT;

CREATE INDEX "SupervisedReplySuggestion_rolloutIntent_status_reviewedAt_idx"
ON "SupervisedReplySuggestion"("rolloutIntent", "status", "reviewedAt");
