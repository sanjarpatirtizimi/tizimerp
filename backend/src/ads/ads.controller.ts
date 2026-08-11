import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { StaffJwtPayload } from '../common/decorators/current-user.decorator';
import { memoryStorage } from 'multer';

@Controller('ads')
@UseGuards(JwtStaffGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post()
  create(@Body() dto: CreateAdDto, @CurrentUser() user: StaffJwtPayload) {
    return this.adsService.create(dto, user.sub);
  }

  @Get()
  list() {
    return this.adsService.listForStaff();
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.adsService.update(id, dto, user.sub);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: StaffJwtPayload) {
    return this.adsService.deactivate(id, user.sub);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.adsService.uploadImage(id, file, user.sub);
  }

  @Post(':id/slides')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  addSlide(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: StaffJwtPayload,
    @Body() body: { title?: string; body?: string },
  ) {
    return this.adsService.addSlide(id, file, user.sub, {
      title: body?.title,
      body: body?.body,
    });
  }
}
