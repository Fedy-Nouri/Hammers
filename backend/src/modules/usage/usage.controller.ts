import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { UsageService } from './usage.service';
import { UsageSummaryResponse, PaginatedUsageLogsResponse } from './dto/usage.response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

class UsageLogsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

class SummaryQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days: number = 30;
}

@ApiTags('usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get aggregated usage stats for the current user' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiResponse({ status: 200, type: UsageSummaryResponse })
  getSummary(
    @CurrentUser() user: ActiveUser,
    @Query() query: SummaryQuery,
  ): Promise<UsageSummaryResponse> {
    return this.usageService.getSummary(user.userId, query.days);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get paginated AI execution logs for the current user' })
  @ApiResponse({ status: 200, type: PaginatedUsageLogsResponse })
  getLogs(
    @CurrentUser() user: ActiveUser,
    @Query() query: UsageLogsQuery,
  ): Promise<PaginatedUsageLogsResponse> {
    return this.usageService.getLogs(user.userId, query.page, query.limit);
  }
}
