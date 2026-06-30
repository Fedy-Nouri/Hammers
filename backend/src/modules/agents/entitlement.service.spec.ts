import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PlanService } from '../billing/plan.service';
import { EntitlementService } from './entitlement.service';
import { meetsPlan, planRank } from '../billing/plans';

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  minPlan: string;
}

function make(opts: {
  agent?: AgentRow | null;
  agents?: AgentRow[];
  installed?: boolean;
  installedIds?: string[];
  userPlan?: string;
}) {
  const upsert = jest.fn().mockResolvedValue({});
  const prisma = {
    agent: {
      findUnique: jest.fn().mockResolvedValue(opts.agent ?? null),
      findMany: jest.fn().mockResolvedValue(opts.agents ?? []),
    },
    installedAgent: {
      findUnique: jest.fn().mockResolvedValue(opts.installed ? { id: 'i' } : null),
      findMany: jest.fn().mockResolvedValue((opts.installedIds ?? []).map((agentId) => ({ agentId }))),
      upsert,
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
  const plans = {
    getPlan: jest.fn().mockResolvedValue({ plan: opts.userPlan ?? 'free', cap: 1, status: null, currentPeriodEnd: null }),
  } as unknown as PlanService;
  return { svc: new EntitlementService(prisma, plans), upsert };
}

const freeAgent: AgentRow = { id: 'a', name: 'A', description: null, enabled: true, minPlan: 'free' };
const proAgent: AgentRow = { id: 'b', name: 'B', description: null, enabled: true, minPlan: 'pro' };

describe('plan ranking', () => {
  it('orders free < pro < enterprise and unknown coerces to free', () => {
    expect(planRank('free')).toBeLessThan(planRank('pro'));
    expect(planRank('pro')).toBeLessThan(planRank('enterprise'));
    expect(meetsPlan('pro', 'free')).toBe(true);
    expect(meetsPlan('free', 'pro')).toBe(false);
    expect(meetsPlan('enterprise', 'pro')).toBe(true);
    expect(meetsPlan('weird', 'free')).toBe(true);
  });
});

describe('EntitlementService.assertCanUse', () => {
  it('404 when the agent is missing', async () => {
    const { svc } = make({ agent: null });
    await expect(svc.assertCanUse('u', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('404 when the agent is disabled', async () => {
    const { svc } = make({ agent: { ...freeAgent, enabled: false } });
    await expect(svc.assertCanUse('u', 'a')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('403 when the plan is too low', async () => {
    const { svc } = make({ agent: proAgent, userPlan: 'free', installed: true });
    await expect(svc.assertCanUse('u', 'b')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('403 when not installed', async () => {
    const { svc } = make({ agent: freeAgent, userPlan: 'free', installed: false });
    await expect(svc.assertCanUse('u', 'a')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('passes when allowed and installed', async () => {
    const { svc } = make({ agent: freeAgent, userPlan: 'free', installed: true });
    await expect(svc.assertCanUse('u', 'a')).resolves.toBeUndefined();
  });
});

describe('EntitlementService.install', () => {
  it('rejects installing an agent above the plan (403) and does not write', async () => {
    const { svc, upsert } = make({ agent: proAgent, userPlan: 'free' });
    await expect(svc.install('u', 'b')).rejects.toBeInstanceOf(ForbiddenException);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('installs an allowed agent', async () => {
    const { svc, upsert } = make({ agent: proAgent, userPlan: 'pro' });
    await expect(svc.install('u', 'b')).resolves.toMatchObject({ id: 'b', installed: true, allowed: true });
    expect(upsert).toHaveBeenCalled();
  });
});

describe('EntitlementService.listForUser', () => {
  it('flags installed + allowed per plan', async () => {
    const { svc } = make({ agents: [freeAgent, proAgent], installedIds: ['a'], userPlan: 'free' });
    const list = await svc.listForUser('u');
    expect(list.find((a) => a.id === 'a')).toMatchObject({ installed: true, allowed: true });
    expect(list.find((a) => a.id === 'b')).toMatchObject({ installed: false, allowed: false });
  });
  it('anonymous sees the free-plan view (nothing installed)', async () => {
    const { svc } = make({ agents: [freeAgent, proAgent] });
    const list = await svc.listForUser(undefined);
    expect(list.every((a) => a.installed === false)).toBe(true);
    expect(list.find((a) => a.id === 'a')?.allowed).toBe(true);
    expect(list.find((a) => a.id === 'b')?.allowed).toBe(false);
  });
});
