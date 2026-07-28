import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.companies.list(query);
  }

  @Get('top')
  top(@Query('limit') limit?: string) {
    return this.companies.topLeads(Number(limit || 50));
  }

  @Post('dedupe')
  dedupe() {
    return this.companies.dedupeExistingCompanies();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const company = await this.companies.getById(id);
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.companies.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companies.remove(id);
  }

  @Post(':id/audit')
  auditOne(@Param('id') id: string) {
    return this.companies.auditOne(id);
  }

  @Post(':id/classify')
  classify(@Param('id') id: string) {
    return this.companies.classifyOne(id);
  }
}
