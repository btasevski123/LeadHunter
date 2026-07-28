import { Module } from '@nestjs/common';
import { ClassificationController } from './classification.controller';
import { LeadClassificationService } from './classification.service';

@Module({
  controllers: [ClassificationController],
  providers: [LeadClassificationService],
  exports: [LeadClassificationService],
})
export class ClassificationModule {}
