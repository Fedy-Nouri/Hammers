import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { QuotaService } from '../../modules/billing/quota.service';
import type { ActiveUser } from '../../modules/auth/strategies/jwt.strategy';

/**
 * Blocks a user-initiated AI request (HTTP 402) when they are over their monthly cost cap.
 * Runs after the controller's JwtAuthGuard has populated request.user, so a proper 402 is
 * returned BEFORE the handler streams anything (the streaming response can't change status
 * once headers are flushed).
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(private readonly quota: QuotaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: ActiveUser }>();
    const userId = request.user?.userId;
    if (!userId) return true; // unauthenticated — leave it to the auth guard
    await this.quota.assertWithinQuota(userId); // throws PaymentRequiredException when over cap
    return true;
  }
}
