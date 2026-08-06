import {
  Body,
  Controller,
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
import { ManualFaceMappingDto } from './dto/manual-face-mapping.dto';
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
    @UploadedFile() photo: Express.Multer.File,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    const ids = JSON.parse(deviceIds) as string[];
    return this.driversService.enrollOnDevices(id, ids, photo.buffer, user.sub);
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
}
