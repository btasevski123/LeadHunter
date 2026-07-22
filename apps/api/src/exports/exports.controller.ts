import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get()
  list() {
    return this.exports.list();
  }

  @Post()
  create(
    @Body()
    body: {
      format: 'CSV' | 'XLSX' | 'PDF';
      companyIds?: string[];
    },
  ) {
    return this.exports.createExport(body.format, body.companyIds);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const file = await this.exports.getFile(id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return res.send(file.buffer);
  }
}
