import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  UsageSummaryResponse,
  PaginatedUsageLogsResponse,
} from './dto/usage.response';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, days = 30): Promise<UsageSummaryResponse> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.aiUsageLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const totalCalls = logs.length;
    const totalPromptTokens = logs.reduce((s, l) => s + l.promptTokens, 0);
    const totalCompletionTokens = logs.reduce((s, l) => s + l.completionTokens, 0);
    const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
    const totalCostUsd = round6(logs.reduce((s, l) => s + l.costUsd, 0));

    const agentMap = new Map<string | null, { calls: number; totalTokens: number; costUsd: number }>();
    const providerMap = new Map<string, { calls: number; totalTokens: number; costUsd: number }>();
    const dayMap = new Map<string, { calls: number; totalTokens: number; costUsd: number }>();

    for (const log of logs) {
      const agentKey = log.agentId ?? null;
      const ag = agentMap.get(agentKey) ?? { calls: 0, totalTokens: 0, costUsd: 0 };
      agentMap.set(agentKey, { calls: ag.calls + 1, totalTokens: ag.totalTokens + log.totalTokens, costUsd: ag.costUsd + log.costUsd });

      const pr = providerMap.get(log.provider) ?? { calls: 0, totalTokens: 0, costUsd: 0 };
      providerMap.set(log.provider, { calls: pr.calls + 1, totalTokens: pr.totalTokens + log.totalTokens, costUsd: pr.costUsd + log.costUsd });

      const date = log.createdAt.toISOString().slice(0, 10);
      const dy = dayMap.get(date) ?? { calls: 0, totalTokens: 0, costUsd: 0 };
      dayMap.set(date, { calls: dy.calls + 1, totalTokens: dy.totalTokens + log.totalTokens, costUsd: dy.costUsd + log.costUsd });
    }

    const byAgent = Array.from(agentMap.entries()).map(([agentId, s]) => ({
      agentId,
      calls: s.calls,
      totalTokens: s.totalTokens,
      costUsd: round6(s.costUsd),
    }));

    const byProvider = Array.from(providerMap.entries()).map(([provider, s]) => ({
      provider,
      calls: s.calls,
      totalTokens: s.totalTokens,
      costUsd: round6(s.costUsd),
    }));

    const dailyStats = Array.from(dayMap.entries())
      .map(([date, s]) => ({ date, calls: s.calls, totalTokens: s.totalTokens, costUsd: round6(s.costUsd) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalCalls,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCostUsd,
      byAgent,
      byProvider,
      dailyStats,
      period: `${days}d`,
    };
  }

  async getLogs(userId: string, page: number, limit: number): Promise<PaginatedUsageLogsResponse> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.aiUsageLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          agentId: true,
          conversationId: true,
          provider: true,
          model: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          costUsd: true,
          createdAt: true,
        },
      }),
      this.prisma.aiUsageLog.count({ where: { userId } }),
    ]);
    return { data, total, page, limit };
  }
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
