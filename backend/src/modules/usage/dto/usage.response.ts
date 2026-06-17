import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentUsageDto {
  @ApiPropertyOptional()
  agentId: string | null;

  @ApiProperty()
  calls: number;

  @ApiProperty()
  totalTokens: number;

  @ApiProperty()
  costUsd: number;
}

export class ProviderUsageDto {
  @ApiProperty()
  provider: string;

  @ApiProperty()
  calls: number;

  @ApiProperty()
  totalTokens: number;

  @ApiProperty()
  costUsd: number;
}

export class DailyStatDto {
  @ApiProperty({ example: '2026-06-17' })
  date: string;

  @ApiProperty()
  calls: number;

  @ApiProperty()
  totalTokens: number;

  @ApiProperty()
  costUsd: number;
}

export class UsageSummaryResponse {
  @ApiProperty()
  totalCalls: number;

  @ApiProperty()
  totalPromptTokens: number;

  @ApiProperty()
  totalCompletionTokens: number;

  @ApiProperty()
  totalTokens: number;

  @ApiProperty()
  totalCostUsd: number;

  @ApiProperty({ type: [AgentUsageDto] })
  byAgent: AgentUsageDto[];

  @ApiProperty({ type: [ProviderUsageDto] })
  byProvider: ProviderUsageDto[];

  @ApiProperty({ type: [DailyStatDto] })
  dailyStats: DailyStatDto[];

  @ApiProperty({ example: '30d' })
  period: string;
}

export class UsageLogResponse {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  agentId: string | null;

  @ApiPropertyOptional()
  conversationId: string | null;

  @ApiProperty()
  provider: string;

  @ApiProperty()
  model: string;

  @ApiProperty()
  promptTokens: number;

  @ApiProperty()
  completionTokens: number;

  @ApiProperty()
  totalTokens: number;

  @ApiProperty()
  costUsd: number;

  @ApiProperty()
  createdAt: Date;
}

export class PaginatedUsageLogsResponse {
  @ApiProperty({ type: [UsageLogResponse] })
  data: UsageLogResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
