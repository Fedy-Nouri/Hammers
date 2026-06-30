import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { EntitlementService } from './entitlement.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [AgentsController],
  providers: [AgentsService, EntitlementService],
  exports: [AgentsService, EntitlementService],
})
export class AgentsModule {}
