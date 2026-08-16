import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { DriversService } from './drivers.service';
import { SelfRegisterDriverDto } from './dto/self-register-driver.dto';

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 12;
const hitsByIp = new Map<string, number[]>();

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function assertRateLimit(ip: string) {
  const now = Date.now();
  const recent = (hitsByIp.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hitsByIp.set(ip, recent);
  if (recent.length > RATE_MAX) {
    throw new HttpException(
      'Ko‘p urinish. Biroz kuting, keyin qayta yozing.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Controller('public/drivers')
export class PublicSelfRegisterController {
  constructor(private readonly driversService: DriversService) {}

  @Post('self-register')
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  selfRegister(
    @Body() dto: SelfRegisterDriverDto,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    assertRateLimit(clientIp(req));
    return this.driversService.selfRegister(dto, photo);
  }
}
