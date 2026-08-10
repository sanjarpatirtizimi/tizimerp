import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import { Device } from '@prisma/client';
import { DigestHttpClient } from './digest-http.client';
import { decryptSecret } from '../common/utils/crypto.util';
import { AppConfig } from '../config/configuration';

export interface FaceEnrollmentResult {
  hikvisionFaceId: string;
  raw: unknown;
}

/**
 * Thin wrapper around Hikvision's ISAPI for face-recognition terminals.
 *
 * Endpoints below follow Hikvision's standard "Access Control" / "Intelligent"
 * ISAPI modules. Exact payload shapes can vary slightly by device model and
 * firmware version — treat these as a solid starting point to validate
 * against your actual hardware, not a guaranteed-correct final contract.
 *
 * Docs: Hikvision ISAPI "Intelligent Application" / "Access Control" service groups.
 */
@Injectable()
export class HikvisionService {
  private readonly logger = new Logger(HikvisionService.name);
  private readonly encKey: string;

  constructor(private readonly configService: ConfigService) {
    this.encKey =
      configService.get<AppConfig>('app')!.security.deviceCredentialsEncKey;
  }

  private clientFor(device: Device): DigestHttpClient {
    if (!device.ipAddress || !device.username || !device.passwordEnc) {
      throw new InternalServerErrorException(
        `Device "${device.name}" has no ISAPI credentials configured (IP/username/password) — it can only receive webhook events, not be controlled directly.`,
      );
    }
    const password = decryptSecret(device.passwordEnc, this.encKey);
    const baseURL = `http://${device.ipAddress}:${device.port}`;
    return new DigestHttpClient(baseURL, device.username, password);
  }

  /**
   * Step 1: register (or update) the person record on the device, keyed by
   * our internal driverId as the device's `employeeNo`.
   */
  async upsertPerson(
    device: Device,
    driverId: string,
    fullName: string,
  ): Promise<void> {
    const client = this.clientFor(device);
    const body = {
      UserInfo: {
        employeeNo: driverId,
        name: fullName,
        userType: 'normal',
        Valid: {
          enable: true,
          beginTime: '2020-01-01T00:00:00',
          endTime: '2037-12-31T23:59:59',
          timeType: 'local',
        },
        doorRight: '1',
        RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
      },
    };

    // Many terminals require POST for Record (PUT → methodNotAllowed).
    // If the person already exists, fall back to Modify.
    let response = await client.post(
      '/ISAPI/AccessControl/UserInfo/Record?format=json',
      {
        data: body,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (this.isIsapiFailure(response)) {
      response = await client.put(
        '/ISAPI/AccessControl/UserInfo/Modify?format=json',
        {
          data: body,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (this.isIsapiFailure(response)) {
      this.logger.error(
        `Failed to upsert person ${driverId} on device ${device.name}: ${response.status} ${JSON.stringify(response.data)}`,
      );
      throw new InternalServerErrorException(
        `Hikvision device "${device.name}" rejected person enrollment (HTTP ${response.status})`,
      );
    }
  }

  private isIsapiFailure(response: {
    status: number;
    data: unknown;
  }): boolean {
    if (response.status >= 400) return true;
    const data = response.data as { statusCode?: number } | null;
    return Boolean(data?.statusCode && data.statusCode !== 1);
  }

  /**
   * Step 2: upload the driver's face photo and link it to the employeeNo
   * created in `upsertPerson`.
   */
  async uploadFace(
    device: Device,
    driverId: string,
    photoBuffer: Buffer,
    photoFileName = 'face.jpg',
  ): Promise<FaceEnrollmentResult> {
    const client = this.clientFor(device);

    const buildForm = () => {
      const form = new FormData();
      form.append(
        'FaceDataRecord',
        JSON.stringify({ faceLibType: 'blackFD', FDID: '1', FPID: driverId }),
        { contentType: 'application/json' },
      );
      form.append('FaceImage', photoBuffer, {
        filename: photoFileName,
        contentType: 'image/jpeg',
      });
      return form;
    };

    // Prefer FaceDataRecord POST. Some terminals reject POST FDSetUp
    // (methodNotAllowed) and expect FaceImage (not img).
    let form = buildForm();
    let response = await client.post(
      '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json',
      {
        data: form,
        headers: form.getHeaders(),
      },
    );

    if (this.isIsapiFailure(response)) {
      form = buildForm();
      response = await client.put(
        '/ISAPI/Intelligent/FDLib/FDSetUp?format=json',
        {
          data: form,
          headers: form.getHeaders(),
        },
      );
    }

    if (this.isIsapiFailure(response)) {
      this.logger.error(
        `Failed to upload face for driver ${driverId} on device ${device.name}: ${response.status} ${JSON.stringify(response.data)}`,
      );
      throw new InternalServerErrorException(
        `Hikvision device "${device.name}" rejected face upload (HTTP ${response.status})`,
      );
    }

    return { hikvisionFaceId: driverId, raw: response.data };
  }

  /** Enrolls a driver on a device end-to-end: person record + face photo. */
  async enrollDriver(
    device: Device,
    driverId: string,
    fullName: string,
    photoBuffer: Buffer,
  ): Promise<FaceEnrollmentResult> {
    await this.upsertPerson(device, driverId, fullName);
    return this.uploadFace(device, driverId, photoBuffer);
  }

  async removeDriver(device: Device, driverId: string): Promise<void> {
    const client = this.clientFor(device);
    const response = await client.delete(
      `/ISAPI/AccessControl/UserInfo/Delete?format=json&EmployeeNo=${encodeURIComponent(driverId)}`,
    );
    if (response.status >= 400) {
      this.logger.warn(
        `Failed to remove driver ${driverId} from device ${device.name}: ${response.status}`,
      );
    }
  }

  /** Quick reachability/credentials check, used by the Devices module to report status. */
  async ping(device: Device): Promise<boolean> {
    try {
      const client = this.clientFor(device);
      const response = await client.get('/ISAPI/System/deviceInfo?format=json');
      return response.status < 400;
    } catch (error) {
      this.logger.warn(
        `Ping failed for device ${device.name}: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
