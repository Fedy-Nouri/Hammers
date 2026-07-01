import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PLANS, resolvePlanKey } from '../billing/plans';

export interface AdminMetrics {
  totalUsers: number;
  usersByPlan: { plan: string; count: number }[];
  activeSubscriptions: number;
  estimatedMrrUsd: number;
  monthToDate: { calls: number; costUsd: number };
  topAgents: { agentId: string; name: string; installs: number }[];
  emails: { total: number; sent: number };
}

export interface EmailLogRow {
  id: string;
  to: string;
  type: string;
  status: string;
  createdAt: Date;
}

export interface PaginatedEmails {
  data: EmailLogRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  subscriptionPlan: string;
  subscriptionStatus: string | null;
  monthToDateCostUsd: number;
  createdAt: Date;
}

export interface PaginatedUsers {
  data: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
}

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  createdAt: true,
} as const;

function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(page: number, limit: number): Promise<PaginatedUsers> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit, select: USER_SELECT }),
      this.prisma.user.count(),
    ]);

    // One grouped query for month-to-date AI cost across the page (avoids N+1).
    const costs = users.length
      ? await this.prisma.aiUsageLog.groupBy({
          by: ['userId'],
          _sum: { costUsd: true },
          where: { createdAt: { gte: startOfMonthUtc() }, userId: { in: users.map((u) => u.id) } },
        })
      : [];
    const costByUser = new Map(costs.map((c) => [c.userId, c._sum.costUsd ?? 0]));

    return {
      data: users.map((u) => ({ ...u, monthToDateCostUsd: round6(costByUser.get(u.id) ?? 0) })),
      total,
      page,
      limit,
    };
  }

  /** Admins may change a user's role only — plan/status stay Stripe-driven. */
  async setRole(id: string, role: string): Promise<AdminUserRow> {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('User not found');

    const user = await this.prisma.user.update({ where: { id }, data: { role }, select: USER_SELECT });
    const agg = await this.prisma.aiUsageLog.aggregate({
      _sum: { costUsd: true },
      where: { userId: id, createdAt: { gte: startOfMonthUtc() } },
    });
    return { ...user, monthToDateCostUsd: round6(agg._sum.costUsd ?? 0) };
  }

  async getMetrics(): Promise<AdminMetrics> {
    const since = startOfMonthUtc();
    const [totalUsers, planGroups, activeGroups, usage, installGroups, agents, emailTotal, emailSent] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.groupBy({ by: ['subscriptionPlan'], _count: true }),
        this.prisma.user.groupBy({
          by: ['subscriptionPlan'],
          _count: true,
          where: { subscriptionStatus: { in: ['active', 'trialing'] } },
        }),
        this.prisma.aiUsageLog.aggregate({ _sum: { costUsd: true }, _count: true, where: { createdAt: { gte: since } } }),
        this.prisma.installedAgent.groupBy({ by: ['agentId'], _count: true }),
        this.prisma.agent.findMany({ select: { id: true, name: true } }),
        this.prisma.emailLog.count(),
        this.prisma.emailLog.count({ where: { status: 'sent' } }),
      ]);

    const estimatedMrrUsd = round6(
      activeGroups.reduce((sum, g) => sum + g._count * PLANS[resolvePlanKey(g.subscriptionPlan)].displayPriceUsd, 0),
    );
    const nameById = new Map(agents.map((a) => [a.id, a.name]));
    const topAgents = installGroups
      .map((g) => ({ agentId: g.agentId, name: nameById.get(g.agentId) ?? g.agentId, installs: g._count }))
      .sort((a, b) => b.installs - a.installs)
      .slice(0, 5);

    return {
      totalUsers,
      usersByPlan: planGroups.map((g) => ({ plan: g.subscriptionPlan, count: g._count })),
      activeSubscriptions: activeGroups.reduce((s, g) => s + g._count, 0),
      estimatedMrrUsd,
      monthToDate: { calls: usage._count, costUsd: round6(usage._sum.costUsd ?? 0) },
      topAgents,
      emails: { total: emailTotal, sent: emailSent },
    };
  }

  async listEmails(page: number, limit: number): Promise<PaginatedEmails> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, to: true, type: true, status: true, createdAt: true },
      }),
      this.prisma.emailLog.count(),
    ]);
    return { data, total, page, limit };
  }
}
