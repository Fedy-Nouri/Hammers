import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StripeService } from './stripe.service';

const ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_ENTERPRISE: 'price_ent',
};

function makeStripe(env: Record<string, string | undefined> = ENV): StripeService {
  const config = {
    get: (k: string) => env[k],
    getOrThrow: (k: string) => {
      const v = env[k];
      if (v === undefined) throw new Error(`missing ${k}`);
      return v;
    },
  } as unknown as ConfigService;
  const prisma = {} as unknown as PrismaService;
  return new StripeService(config, prisma);
}

describe('StripeService mapping', () => {
  const svc = makeStripe();

  it('maps price ids to plan keys', () => {
    expect(svc.planForPriceId('price_pro')).toBe('pro');
    expect(svc.planForPriceId('price_ent')).toBe('enterprise');
    expect(svc.planForPriceId('price_unknown')).toBeNull();
  });

  it('returns the configured price id for a purchasable plan', () => {
    expect(svc.priceIdFor('pro')).toBe('price_pro');
    expect(svc.priceIdFor('enterprise')).toBe('price_ent');
  });

  it('refuses to price the non-purchasable free plan', () => {
    expect(() => svc.priceIdFor('free')).toThrow(BadRequestException);
  });

  it('reports configured when the secret key is present', () => {
    expect(svc.configured).toBe(true);
    expect(makeStripe({}).configured).toBe(false);
  });
});

describe('StripeService webhook verification', () => {
  it('rejects a payload with an invalid signature', () => {
    const svc = makeStripe();
    expect(() => svc.constructWebhookEvent(Buffer.from('{"id":"evt_1"}'), 't=1,v1=deadbeef')).toThrow();
  });
});
