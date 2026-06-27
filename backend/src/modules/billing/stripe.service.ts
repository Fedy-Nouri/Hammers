import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PLANS, type PlanKey } from './plans';

/**
 * Thin wrapper over the Stripe SDK. Tolerant of missing config: if STRIPE_SECRET_KEY is unset
 * the service still constructs (so the app boots and BL-001/002 keep working) and only the
 * billing endpoints return 503 until Stripe is configured.
 */
@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
  }

  get configured(): boolean {
    return this.stripe !== null;
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Billing is not configured (STRIPE_SECRET_KEY missing).');
    }
    return this.stripe;
  }

  /** Resolve (creating + persisting if needed) the Stripe customer id for a user. */
  async ensureCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.client().customers.create({
      email: user.email,
      metadata: { userId },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  /** Stripe price id configured for a purchasable plan. */
  priceIdFor(plan: PlanKey): string {
    const def = PLANS[plan];
    if (!def.priceEnv) throw new BadRequestException(`Plan "${plan}" is not purchasable.`);
    const priceId = this.config.get<string>(def.priceEnv);
    if (!priceId) throw new InternalServerErrorException(`Missing Stripe price env ${def.priceEnv}.`);
    return priceId;
  }

  /** Reverse-map a Stripe price id back to a plan key (used by the webhook). */
  planForPriceId(priceId: string): PlanKey | null {
    for (const def of Object.values(PLANS)) {
      if (def.priceEnv && this.config.get<string>(def.priceEnv) === priceId) return def.key;
    }
    return null;
  }

  async createCheckoutSession(userId: string, plan: PlanKey): Promise<string> {
    const customer = await this.ensureCustomer(userId);
    const session = await this.client().checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: this.priceIdFor(plan), quantity: 1 }],
      success_url: this.config.getOrThrow<string>('STRIPE_SUCCESS_URL'),
      cancel_url: this.config.getOrThrow<string>('STRIPE_CANCEL_URL'),
      metadata: { userId, plan },
    });
    if (!session.url) throw new InternalServerErrorException('Stripe did not return a checkout URL.');
    return session.url;
  }

  async createPortalSession(userId: string): Promise<string> {
    const customer = await this.ensureCustomer(userId);
    const session = await this.client().billingPortal.sessions.create({
      customer,
      return_url: this.config.getOrThrow<string>('STRIPE_PORTAL_RETURN_URL'),
    });
    return session.url;
  }

  /** Verify a webhook payload signature and return the parsed event. */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new ServiceUnavailableException('Webhook secret not configured.');
    return this.client().webhooks.constructEvent(rawBody, signature, secret);
  }
}
