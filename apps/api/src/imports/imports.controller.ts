import { Controller, Get, Param, Query } from '@nestjs/common';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.imports.list(limit ? Number(limit) : 50);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.imports.get(id);
  }
}
