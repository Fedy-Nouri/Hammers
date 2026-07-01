import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService.getMetrics', () => {
  it('computes active subs, MRR (active x display price), usage, top agents and emails', async () => {
    const prisma = {
      user: {
        count: jest.fn().mockResolvedValue(5),
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([
            { subscriptionPlan: 'free', _count: 3 },
            { subscriptionPlan: 'pro', _count: 2 },
          ])
          .mockResolvedValueOnce([{ subscriptionPlan: 'pro', _count: 2 }]),
      },
      aiUsageLog: { aggregate: jest.fn().mockResolvedValue({ _sum: { costUsd: 1.5 }, _count: 10 }) },
      installedAgent: {
        groupBy: jest.fn().mockResolvedValue([
          { agentId: 'job-agent', _count: 4 },
          { agentId: 'data-analyst', _count: 7 },
        ]),
      },
      agent: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'job-agent', name: 'Job Hunter' },
          { id: 'data-analyst', name: 'Data Analyst' },
        ]),
      },
      emailLog: { count: jest.fn().mockResolvedValueOnce(20).mockResolvedValueOnce(15) },
    } as unknown as PrismaService;

    const m = await new AdminService(prisma).getMetrics();
    expect(m.totalUsers).toBe(5);
    expect(m.activeSubscriptions).toBe(2);
    expect(m.estimatedMrrUsd).toBe(58); // 2 pro × $29 display price
    expect(m.monthToDate).toEqual({ calls: 10, costUsd: 1.5 });
    expect(m.topAgents[0]).toMatchObject({ agentId: 'data-analyst', name: 'Data Analyst', installs: 7 });
    expect(m.emails).toEqual({ total: 20, sent: 15 });
  });
});

describe('AdminService.setRole', () => {
  it('throws 404 for a missing user', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(new AdminService(prisma).setRole('missing', 'admin')).rejects.toBeInstanceOf(NotFoundException);
  });
});
