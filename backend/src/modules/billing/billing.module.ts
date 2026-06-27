import { Module } from '@nestjs/common';
import { PlanService } from './plan.service';

/**
 * Billing & Plans (BL). PrismaService and ConfigService are global, so no imports here.
 * BL-002 adds QuotaService + the usage endpoint; BL-003/004 add StripeService + the
 * checkout/portal/webhook controller.
 */
@Module({
  providers: [PlanService],
  exports: [PlanService],
})
export class BillingModule {}
