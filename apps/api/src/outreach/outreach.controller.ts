import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OutreachService } from './outreach.service';

@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreach: OutreachService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.outreach.list(status);
  }

  @Get('board')
  board() {
    return this.outreach.board();
  }

  @Post()
  create(@Body() body: { companyId: string }) {
    return this.outreach.ensure(body.companyId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.outreach.update(id, body);
  }
}
