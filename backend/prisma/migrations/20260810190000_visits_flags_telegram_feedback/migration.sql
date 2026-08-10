-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'READ', 'RESOLVED');

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN "telegramUsername" TEXT;

-- AlterTable
ALTER TABLE "recognition_events" ADD COLUMN "isRedFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recognition_events" ADD COLUMN "flaggedAt" TIMESTAMP(3);
ALTER TABLE "recognition_events" ADD COLUMN "flaggedById" TEXT;
ALTER TABLE "recognition_events" ADD COLUMN "flagNote" TEXT;

-- CreateTable
CREATE TABLE "driver_feedback" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "staffNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_feedback_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recognition_events" ADD CONSTRAINT "recognition_events_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_feedback" ADD CONSTRAINT "driver_feedback_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "recognition_events_isRedFlagged_createdAt_idx" ON "recognition_events"("isRedFlagged", "createdAt");

-- CreateIndex
CREATE INDEX "driver_feedback_status_createdAt_idx" ON "driver_feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "driver_feedback_driverId_createdAt_idx" ON "driver_feedback"("driverId", "createdAt");
