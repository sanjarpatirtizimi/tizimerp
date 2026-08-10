import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DriverStatus, UserRole } from '@prisma/client';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { ManualFaceMappingDto } from './dto/manual-face-mapping.dto';
import { RequeueEnrollmentDto } from './dto/requeue-enrollment.dto';
import { UpdateTelegramDto } from './dto/update-telegram.dto';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { StaffJwtPayload } from '../common/decorators/current-user.decorator';

@Controller('drivers')
@UseGuards(JwtStaffGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('photo'))
  create(
    @Body() dto: CreateDriverDto,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.create(dto, photo, user.sub);
  }

  @Post(':id/enroll')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('photo'))
  enroll(
    @Param('id') id: string,
    @Body('deviceIds') deviceIds: string,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    const ids = JSON.parse(deviceIds) as string[];
    // Prefer a freshly uploaded photo; otherwise re-queue from the stored one.
    if (photo?.buffer?.length) {
      return this.driversService.enrollOnDevices(id, ids, photo.buffer, user.sub);
    }
    return this.driversService.requeueEnrollment(id, ids, user.sub);
  }

  /** Re-queue face push to devices using the driver's already-stored photo. */
  @Post(':id/requeue-enrollment')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  requeueEnrollment(
    @Param('id') id: string,
    @Body() dto: RequeueEnrollmentDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.requeueEnrollment(id, dto.deviceIds, user.sub);
  }

  /** Upload or replace the durable face photo stored in the database. */
  @Post(':id/photo')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('photo'))
  updatePhoto(
    @Param('id') id: string,
    @UploadedFile() photo: Express.Multer.File,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.updatePhoto(id, photo, user.sub);
  }

  @Post(':id/manual-face-mapping')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  setManualFaceMapping(
    @Param('id') id: string,
    @Body() dto: ManualFaceMappingDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.setManualFaceMapping(id, dto, user.sub);
  }

  @Post(':id/devices/:deviceId/pairing')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  startDevicePairing(
    @Param('id') id: string,
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.startDevicePairing(id, deviceId, user.sub);
  }

  @Delete(':id/devices/:deviceId/pairing')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  cancelDevicePairing(
    @Param('id') id: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.driversService.cancelDevicePairing(id, deviceId);
  }

  @Delete(':id/devices/:deviceId')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  unlinkDevice(
    @Param('id') id: string,
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.unlinkDevice(id, deviceId, user.sub);
  }

  @Get()
  findAll(@Query('status') status?: DriverStatus) {
    return this.driversService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDriverStatusDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.setStatus(id, dto.status, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.update(id, dto, user.sub);
  }

  @Patch(':id/telegram')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  setTelegram(
    @Param('id') id: string,
    @Body() dto: UpdateTelegramDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.setTelegramUsername(
      id,
      dto.telegramUsername,
      user.sub,
    );
  }

  @Delete(':id')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.driversService.softDelete(id, user.sub);
  }
}
