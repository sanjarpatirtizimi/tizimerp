-- Soft-delete support for drivers (ledger history is preserved).
ALTER TABLE "drivers" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "drivers_deletedAt_idx" ON "drivers"("deletedAt");
