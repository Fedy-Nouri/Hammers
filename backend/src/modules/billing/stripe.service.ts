import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DEFAULT_PLAN, PLANS, type PlanKey } from './plans';

/** Read the subscription's period-end timestamp defensively across Stripe API versions. */
function periodEndOf(sub: Stripe.Subscription): Date | null {
  const ts = (sub as unknown as { current_period_end?: number }).current_period_end;
  return typeof ts === 'number' ? new Date(ts * 1000) : null;
}

/**
 * Thin wrapper over the Stripe SDK. Tolerant of missing config: if STRIPE_SECRET_KEY is unset
 * the service still constructs (so the app boots and BL-001/002 keep working) and only the
 * billing endpoints return 503 until Stripe is configured.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
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

  /**
   * Apply a verified webhook event to our DB. Stripe is the source of truth, so we re-derive the
   * plan from the subscription's price (never trust client input). Idempotent: the same event can
   * be delivered more than once and the writes converge.
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          const sub = await this.client().subscriptions.retrieve(subId);
          await this.applySubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await this.applySubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.downgradeToFree(typeof sub.customer === 'string' ? sub.customer : sub.customer.id);
        break;
      }
      default:
        break; // ignore unrelated events
    }
  }

  private async applySubscription(sub: Stripe.Subscription): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const priceId = sub.items.data[0]?.price.id;
    const plan = (priceId ? this.planForPriceId(priceId) : null) ?? DEFAULT_PLAN;
    const result = await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { subscriptionPlan: plan, subscriptionStatus: sub.status, currentPeriodEnd: periodEndOf(sub) },
    });
    this.logger.log(`subscription ${sub.status} -> plan ${plan} for customer ${customerId} (${result.count} user)`);
  }

  private async downgradeToFree(customerId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { subscriptionPlan: DEFAULT_PLAN, subscriptionStatus: 'canceled', currentPeriodEnd: null },
    });
    this.logger.log(`subscription canceled -> free for customer ${customerId}`);
  }
}
