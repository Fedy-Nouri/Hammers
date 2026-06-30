import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { EntitlementService } from './entitlement.service';
import { EntitlementGuard } from '../../common/guards/entitlement.guard';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [AgentsController],
  providers: [AgentsService, EntitlementService, EntitlementGuard],
  exports: [AgentsService, EntitlementService, EntitlementGuard],
})
export class AgentsModule {}
