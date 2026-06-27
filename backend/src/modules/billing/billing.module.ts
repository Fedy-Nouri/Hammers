import { Module } from '@nestjs/common';
import { PlanService } from './plan.service';
import { QuotaService } from './quota.service';
import { BillingController } from './billing.controller';
import { QuotaGuard } from '../../common/guards/quota.guard';

/**
 * Billing & Plans (BL). PrismaService and ConfigService are global, so no imports here.
 * Exports QuotaService + QuotaGuard so AiModule/JobsModule can guard their AI routes.
 * BL-003/004 add StripeService + the checkout/portal/webhook routes.
 */
@Module({
  controllers: [BillingController],
  providers: [PlanService, QuotaService, QuotaGuard],
  exports: [PlanService, QuotaService, QuotaGuard],
})
export class BillingModule {}
