-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'STAMP_REDEMPTION';

-- CreateEnum
CREATE TYPE "StampRedeemKind" AS ENUM ('CASH', 'GOODS', 'OTHER');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "redeemedAt" TIMESTAMP(3),
ADD COLUMN "redeemedById" TEXT,
ADD COLUMN "redeemKind" "StampRedeemKind",
ADD COLUMN "redeemNote" TEXT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "transactions_driverId_type_redeemedAt_idx" ON "transactions"("driverId", "type", "redeemedAt");
