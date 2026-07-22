import { Controller, Get, NotFoundException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import path from 'node:path';
import { createStorage } from '../storage/local-storage';

@Controller('storage')
export class StorageController {
  @Get()
  root() {
    return { ok: true, message: 'Pass a storage key path after /api/storage/' };
  }

  @Get('*')
  async get(@Req() req: Request, @Res() res: Response) {
    const prefix = '/api/storage/';
    const full = req.path.startsWith(prefix) ? req.path.slice(prefix.length) : req.path.replace(/^\/+/, '');
    const key = decodeURIComponent(full);
    if (!key || key.includes('..')) {
      throw new NotFoundException('File not found');
    }

    const storage = createStorage();
    try {
      const buffer = await storage.get(key);
      const ext = path.extname(key).toLowerCase();
      const type =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.pdf'
              ? 'application/pdf'
              : 'application/octet-stream';
      res.setHeader('Content-Type', type);
      return res.send(buffer);
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
