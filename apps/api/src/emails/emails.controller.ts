import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EmailsService } from './emails.service';

@Controller('emails')
export class EmailsController {
  constructor(private readonly emails: EmailsService) {}

  @Get()
  list(@Query('companyId') companyId?: string) {
    return this.emails.list(companyId);
  }

  @Get('status')
  status() {
    return this.emails.status();
  }

  @Post('generate')
  generate(
    @Body()
    body: {
      companyId: string;
      kind?: 'OUTREACH' | 'FOLLOW_UP';
      language?: 'en' | 'mk';
    },
  ) {
    return this.emails.generate(
      body.companyId,
      body.kind || 'OUTREACH',
      body.language === 'mk' ? 'mk' : 'en',
    );
  }

  @Post(':id/send')
  send(@Param('id') id: string, @Body() body: { toEmail?: string } = {}) {
    return this.emails.send(id, body.toEmail);
  }
}
