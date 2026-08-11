-- CreateEnum
CREATE TYPE "AdKind" AS ENUM ('POPUP', 'SLIDESHOW');

-- AlterTable
ALTER TABLE "ads" ADD COLUMN "kind" "AdKind" NOT NULL DEFAULT 'POPUP';

-- CreateIndex
CREATE INDEX "ads_kind_isActive_startsAt_endsAt_idx" ON "ads"("kind", "isActive", "startsAt", "endsAt");

-- CreateTable
CREATE TABLE "ad_slides" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "body" TEXT,
    "imageUrl" TEXT,
    "imageBytes" BYTEA,
    "imageMimeType" TEXT DEFAULT 'image/jpeg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_slides_adId_sortOrder_idx" ON "ad_slides"("adId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ad_slides" ADD CONSTRAINT "ad_slides_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
