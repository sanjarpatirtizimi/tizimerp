-- AlterTable: local relay-agent auth for zero-touch face enrollment
ALTER TABLE "devices" ADD COLUMN "agentKeyHash" TEXT,
ADD COLUMN "agentKeyCreatedAt" TIMESTAMP(3);
