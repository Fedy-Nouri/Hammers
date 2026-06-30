import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { AgentsModule } from '../agents/agents.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [AiModule, BillingModule, AgentsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
