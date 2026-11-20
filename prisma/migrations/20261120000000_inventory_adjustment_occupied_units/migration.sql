-- A coluna já existe no Turso de produção (adicionada por prisma/migrate_turso.js),
-- mas faltava nas migrações: banco local novo quebrava no seed (P2022 occupiedUnits).
ALTER TABLE "InventoryAdjustment" ADD COLUMN "occupiedUnits" INTEGER NOT NULL DEFAULT 0;
