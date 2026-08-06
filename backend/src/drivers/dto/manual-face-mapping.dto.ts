import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Used when a driver's face was enrolled directly on the device's own
 * local UI (instead of through our platform's ISAPI push), so the device
 * assigned its own Person ID (employeeNo) that has nothing to do with our
 * internal driver id. This lets staff manually record that mapping so
 * inbound recognition webhooks can still be matched to the right driver.
 */
export class ManualFaceMappingDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  /** The Person ID / employeeNo / Face ID as shown on the device itself. */
  @IsString()
  @IsNotEmpty()
  hikvisionFaceId: string;
}
