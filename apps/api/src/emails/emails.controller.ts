import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EmailsService } from './emails.service';

@Controller('emails')
export class EmailsController {
  constructor(private readonly emails: EmailsService) {}

  @Get()
  list(@Query('companyId') companyId?: string) {
    return this.emails.list(companyId);
  }

  @Post('generate')
  generate(@Body() body: { companyId: string; kind?: 'OUTREACH' | 'FOLLOW_UP' }) {
    return this.emails.generate(body.companyId, body.kind || 'OUTREACH');
  }
}
