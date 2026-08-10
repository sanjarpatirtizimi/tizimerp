-- AlterTable: persist driver face photos in the database (Render disk is ephemeral)
ALTER TABLE "drivers" ADD COLUMN "photoBytes" BYTEA,
ADD COLUMN "photoMimeType" TEXT DEFAULT 'image/jpeg';
