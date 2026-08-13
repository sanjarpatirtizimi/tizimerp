-- CreateEnum
CREATE TYPE "OperatorCashEntryType" AS ENUM (
  'SHIFT_OPEN',
  'CASH_OUT_ADVANCE',
  'CASH_OUT_STAMP',
  'SHIFT_TRANSFER_OUT',
  'SHIFT_TRANSFER_IN'
);

-- CreateTable
CREATE TABLE "operator_cash_entries" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "type" "OperatorCashEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "counterpartyId" TEXT,
    "driverTransactionId" TEXT,
    "transferGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_cash_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operator_cash_entries_operatorId_createdAt_idx" ON "operator_cash_entries"("operatorId", "createdAt");

-- CreateIndex
CREATE INDEX "operator_cash_entries_transferGroupId_idx" ON "operator_cash_entries"("transferGroupId");

-- CreateIndex
CREATE INDEX "operator_cash_entries_driverTransactionId_idx" ON "operator_cash_entries"("driverTransactionId");

-- AddForeignKey
ALTER TABLE "operator_cash_entries" ADD CONSTRAINT "operator_cash_entries_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_cash_entries" ADD CONSTRAINT "operator_cash_entries_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
