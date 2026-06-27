import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';
import { QuotaService, type QuotaUsage } from './quota.service';
import { StripeService } from './stripe.service';
import { PLANS } from './plans';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

interface PlanInfo {
  key: string;
  displayName: string;
  monthlyUsdCap: number;
  purchasable: boolean;
}

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly quota: QuotaService,
    private readonly stripe: StripeService,
  ) {}

  @Get('usage')
  @ApiOperation({ summary: 'Current plan, monthly AI-cost cap, and month-to-date usage' })
  getUsage(@CurrentUser() user: ActiveUser): Promise<QuotaUsage> {
    return this.quota.getUsage(user.userId);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Available plans with caps' })
  getPlans(): PlanInfo[] {
    return Object.values(PLANS).map((p) => ({
      key: p.key,
      displayName: p.displayName,
      monthlyUsdCap: p.monthlyUsdCap,
      purchasable: Boolean(p.priceEnv),
    }));
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a Stripe Checkout session for a plan' })
  async createCheckout(
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateCheckoutDto,
  ): Promise<{ url: string }> {
    return { url: await this.stripe.createCheckoutSession(user.userId, dto.plan) };
  }

  @Post('portal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a Stripe Customer Portal session' })
  async createPortal(@CurrentUser() user: ActiveUser): Promise<{ url: string }> {
    return { url: await this.stripe.createPortalSession(user.userId) };
  }
}
