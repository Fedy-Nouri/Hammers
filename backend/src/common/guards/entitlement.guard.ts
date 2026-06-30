import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { EntitlementService } from '../../modules/agents/entitlement.service';
import { REQUIRES_AGENT } from '../decorators/requires-agent.decorator';
import type { ActiveUser } from '../../modules/auth/strategies/jwt.strategy';

/**
 * Blocks a request unless the caller has the `@RequiresAgent(id)` agent installed and allowed by
 * plan. Runs after JwtAuthGuard (which populates request.user); routes without the decorator pass.
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlement: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const agentId = this.reflector.getAllAndOverride<string | undefined>(REQUIRES_AGENT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!agentId) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: ActiveUser }>();
    const userId = request.user?.userId;
    if (!userId) return true; // unauthenticated — leave it to the auth guard
    await this.entitlement.assertCanUse(userId, agentId); // throws 403/404
    return true;
  }
}
