import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { StripeService } from './stripe.service';

/**
 * Public Stripe webhook (no JwtAuthGuard — Stripe calls it). Kept on its own controller so the
 * authenticated BillingController stays guarded. Verifies the signature against the RAW body
 * (enabled via `rawBody: true` in main.ts), then syncs the subscription into our DB.
 */
@Controller('billing')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(private readonly stripe: StripeService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!req.rawBody) throw new BadRequestException('Missing raw request body.');
    if (!signature) throw new BadRequestException('Missing stripe-signature header.');

    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    } catch (err) {
      this.logger.warn(`webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('Webhook signature verification failed.');
    }

    await this.stripe.handleEvent(event);
    return { received: true };
  }
}
