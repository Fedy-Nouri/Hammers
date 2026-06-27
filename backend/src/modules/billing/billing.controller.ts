import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';
import { QuotaService, type QuotaUsage } from './quota.service';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly quota: QuotaService) {}

  @Get('usage')
  @ApiOperation({ summary: 'Current plan, monthly AI-cost cap, and month-to-date usage' })
  getUsage(@CurrentUser() user: ActiveUser): Promise<QuotaUsage> {
    return this.quota.getUsage(user.userId);
  }
}
