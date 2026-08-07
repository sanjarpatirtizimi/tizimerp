-- AlterTable: Device credentials become optional (auto-provisioned devices have none)
ALTER TABLE "devices" ALTER COLUMN "ipAddress" DROP NOT NULL;
ALTER TABLE "devices" ALTER COLUMN "username" DROP NOT NULL;
ALTER TABLE "devices" ALTER COLUMN "passwordEnc" DROP NOT NULL;

-- AlterTable: pairing/auto-claim window for DriverDeviceRegistration
ALTER TABLE "driver_device_registrations" ADD COLUMN "pairingExpiresAt" TIMESTAMP(3);
