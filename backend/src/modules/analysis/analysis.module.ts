import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AnalysisService } from './analysis.service';
import { AnalysisScheduler } from './analysis.scheduler';
import { AnalysisController } from './analysis.controller';

@Module({
  imports: [AiModule],
  providers: [AnalysisService, AnalysisScheduler],
  controllers: [AnalysisController],
})
export class AnalysisModule {}
