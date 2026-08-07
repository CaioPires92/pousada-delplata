UPDATE "PipelineCard"
SET "lossReason" = "lostReason"
WHERE ("lossReason" IS NULL OR TRIM("lossReason") = '')
  AND "lostReason" IS NOT NULL
  AND TRIM("lostReason") <> '';

-- Compatibilidade temporária para leitores antigos durante a migração aditiva.
UPDATE "PipelineCard"
SET "lostReason" = "lossReason"
WHERE ("lostReason" IS NULL OR TRIM("lostReason") = '')
  AND "lossReason" IS NOT NULL
  AND TRIM("lossReason") <> '';
