import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/** Lua: delete the key only if this caller still owns it (token matches). */
const RELEASE_IF_OWNER =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/**
 * Distributed lock helper (SC-006). Ensures a scheduled job runs on at most one
 * backend replica per cycle. When REDIS_URL is unset, falls back to running
 * unconditionally (single-instance dev mode).
 */
@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  private warnedNoRedis = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  /**
   * Run `fn` only if this process wins the named lock; otherwise skip (another
   * replica is handling it). Returns true if `fn` ran.
   */
  async withLock(key: string, ttlMs: number, fn: () => Promise<void>): Promise<boolean> {
    if (!this.redis) {
      if (!this.warnedNoRedis) {
        this.logger.warn('REDIS_URL not set — running scheduled jobs without a distributed lock');
        this.warnedNoRedis = true;
      }
      await fn();
      return true;
    }

    const token = randomUUID();
    const acquired = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') return false;

    try {
      await fn();
      return true;
    } finally {
      await this.redis.eval(RELEASE_IF_OWNER, 1, key, token).catch(() => undefined);
    }
  }
}
