import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PlanService } from '../billing/plan.service';
import { meetsPlan } from '../billing/plans';

export interface AgentWithEntitlement {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  minPlan: string;
  /** The caller has an install row for this agent. */
  installed: boolean;
  /** The caller's plan permits this agent (independent of install). */
  allowed: boolean;
}

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  minPlan: string;
}

/**
 * Agent entitlements: a user may use an agent only when they have installed it AND their plan
 * rank >= the agent's minPlan rank. The server is the source of truth; the UI flags are advisory.
 */
@Injectable()
export class EntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanService,
  ) {}

  /** Catalog with per-caller install/allowed flags. Anonymous callers see the free-plan view. */
  async listForUser(userId?: string): Promise<AgentWithEntitlement[]> {
    const agents = await this.prisma.agent.findMany({ orderBy: { createdAt: 'asc' } });

    if (!userId) {
      return agents.map((a) => ({ ...this.shape(a), installed: false, allowed: meetsPlan('free', a.minPlan) }));
    }

    const { plan } = await this.plans.getPlan(userId);
    const installs = await this.prisma.installedAgent.findMany({
      where: { userId },
      select: { agentId: true },
    });
    const installed = new Set(installs.map((i) => i.agentId));

    return agents.map((a) => ({
      ...this.shape(a),
      installed: installed.has(a.id),
      allowed: meetsPlan(plan, a.minPlan),
    }));
  }

  /** Throws unless the agent exists, is enabled, allowed by plan, and installed by the user. */
  async assertCanUse(userId: string, agentId: string): Promise<void> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || !agent.enabled) throw new NotFoundException(`Agent "${agentId}" not found`);

    const { plan } = await this.plans.getPlan(userId);
    if (!meetsPlan(plan, agent.minPlan)) {
      throw new ForbiddenException(`The ${agent.name} agent requires the ${agent.minPlan} plan.`);
    }

    const install = await this.prisma.installedAgent.findUnique({
      where: { userId_agentId: { userId, agentId } },
    });
    if (!install) throw new ForbiddenException(`Install the ${agent.name} agent to use it.`);
  }

  async install(userId: string, agentId: string): Promise<AgentWithEntitlement> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || !agent.enabled) throw new NotFoundException(`Agent "${agentId}" not found`);

    const { plan } = await this.plans.getPlan(userId);
    if (!meetsPlan(plan, agent.minPlan)) {
      throw new ForbiddenException(`The ${agent.name} agent requires the ${agent.minPlan} plan.`);
    }

    await this.prisma.installedAgent.upsert({
      where: { userId_agentId: { userId, agentId } },
      create: { userId, agentId },
      update: {},
    });
    return { ...this.shape(agent), installed: true, allowed: true };
  }

  /** Remove access. Conversations/history are intentionally left intact. */
  async uninstall(userId: string, agentId: string): Promise<void> {
    await this.prisma.installedAgent.deleteMany({ where: { userId, agentId } });
  }

  private shape(a: AgentRow) {
    return { id: a.id, name: a.name, description: a.description, enabled: a.enabled, minPlan: a.minPlan };
  }
}
