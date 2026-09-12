-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "agentConfig" JSONB,
ADD COLUMN     "agentLastSeenAt" TIMESTAMP(3),
ADD COLUMN     "agentVersion" TEXT;

-- CreateTable
CREATE TABLE "agent_logs" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "raw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_logs_deviceId_createdAt_idx" ON "agent_logs"("deviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
