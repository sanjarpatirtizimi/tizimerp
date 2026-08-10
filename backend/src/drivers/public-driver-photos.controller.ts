import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DriversService } from './drivers.service';

/**
 * Public (no JWT) photo endpoint so the local relay-agent can download a
 * driver's face image. Photos are served from Postgres, not ephemeral disk.
 */
@Controller('public/driver-photos')
export class PublicDriverPhotosController {
  constructor(private readonly driversService: DriversService) {}

  @Get(':id')
  async getPhoto(@Param('id') id: string, @Res() res: Response) {
    const { buffer, mimeType } = await this.driversService.getStoredPhoto(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  }
}
