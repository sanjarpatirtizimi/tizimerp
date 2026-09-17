-- CreateIndex
CREATE INDEX "driver_device_registrations_deviceId_hikvisionFaceId_idx" ON "driver_device_registrations"("deviceId", "hikvisionFaceId");

-- CreateIndex
CREATE INDEX "driver_device_registrations_hikvisionFaceId_idx" ON "driver_device_registrations"("hikvisionFaceId");

-- CreateIndex
CREATE INDEX "recognition_events_employeeNoRaw_status_createdAt_idx" ON "recognition_events"("employeeNoRaw", "status", "createdAt");
