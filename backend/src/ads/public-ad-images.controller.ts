import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AdsService } from './ads.service';

/** Public image endpoint for ad creatives (no JWT). */
@Controller('public/ad-images')
export class PublicAdImagesController {
  constructor(private readonly adsService: AdsService) {}

  @Get(':id')
  async getImage(@Param('id') id: string, @Res() res: Response) {
    const { buffer, mimeType } = await this.adsService.getStoredImage(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  }
}
