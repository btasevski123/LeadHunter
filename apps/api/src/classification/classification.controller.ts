import { Controller, Get, Param, Post } from '@nestjs/common';
import { LeadClassificationService } from './classification.service';

@Controller('classification')
export class ClassificationController {
  constructor(private readonly classification: LeadClassificationService) {}

  @Get('companies/:companyId')
  get(@Param('companyId') companyId: string) {
    return this.classification.getByCompanyId(companyId);
  }

  @Post('companies/:companyId')
  classify(@Param('companyId') companyId: string) {
    return this.classification.classifyAndStore(companyId);
  }
}
