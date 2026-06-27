import { Module } from '@nestjs/common';
import { PlanService } from './plan.service';
import { QuotaService } from './quota.service';
import { StripeService } from './stripe.service';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { QuotaGuard } from '../../common/guards/quota.guard';

/**
 * Billing & Plans (BL). PrismaService and ConfigService are global, so no imports here.
 * Exports QuotaService + QuotaGuard so AiModule/JobsModule can guard their AI routes.
 */
@Module({
  controllers: [BillingController, BillingWebhookController],
  providers: [PlanService, QuotaService, StripeService, QuotaGuard],
  exports: [PlanService, QuotaService, QuotaGuard],
})
export class BillingModule {}
