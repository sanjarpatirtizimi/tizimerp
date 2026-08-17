import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED = new Set([
  'index.js',
  'prepare-face-jpeg.js',
  'hikvision-multipart.js',
  'sync-agent-files.js',
  'digest-http-client.js',
  'acs-events.js',
  'package.json',
  'start.cmd',
  'update.cmd',
]);

/**
 * Lets the gate PC download a working relay-agent without git.
 * Render cwd is backend/, repo root is one level up.
 */
@Controller('public/relay-agent')
export class PublicRelayAgentController {
  @Get(':file')
  getFile(@Param('file') file: string, @Res() res: Response) {
    if (!ALLOWED.has(file)) {
      throw new NotFoundException();
    }
    const candidates = [
      join(process.cwd(), '..', 'relay-agent', file),
      join(process.cwd(), 'relay-agent-files', file),
    ];
    const full = candidates.find((p) => existsSync(p));
    if (!full) throw new NotFoundException('Relay agent fayli topilmadi');
    const body = readFileSync(full);
    const type = file.endsWith('.json')
      ? 'application/json'
      : 'application/javascript; charset=utf-8';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.send(body);
  }
}
