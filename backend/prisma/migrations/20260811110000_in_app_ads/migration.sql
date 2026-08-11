-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "phone" TEXT,
    "telegramUsername" TEXT,
    "linkUrl" TEXT,
    "imageUrl" TEXT,
    "imageBytes" BYTEA,
    "imageMimeType" TEXT DEFAULT 'image/jpeg',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "audiencePercent" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_dismissals" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ads_isActive_startsAt_endsAt_idx" ON "ads"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ad_dismissals_driverId_idx" ON "ad_dismissals"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_dismissals_adId_driverId_key" ON "ad_dismissals"("adId", "driverId");

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_dismissals" ADD CONSTRAINT "ad_dismissals_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_dismissals" ADD CONSTRAINT "ad_dismissals_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
