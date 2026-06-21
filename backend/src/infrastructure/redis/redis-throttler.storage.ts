import { Redis } from 'ioredis';
import { ThrottlerStorage } from '@nestjs/throttler';

interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Atomically register a hit, set the window TTL on the first hit, and apply a
 * block window once the limit is exceeded.
 * Returns [totalHits, windowTtlMs, isBlocked(0|1), blockTtlMs].
 */
const INCREMENT_SCRIPT = `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', hitKey)) or limit
  local hitTtl = redis.call('PTTL', hitKey)
  if hitTtl < 0 then hitTtl = 0 end
  return { hits, hitTtl, 1, blockTtl }
end

local totalHits = redis.call('INCR', hitKey)
local timeToExpire = redis.call('PTTL', hitKey)
if timeToExpire < 0 then
  redis.call('PEXPIRE', hitKey, ttl)
  timeToExpire = ttl
end

local isBlocked = 0
local timeToBlockExpire = 0
if totalHits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  isBlocked = 1
  timeToBlockExpire = blockDuration
end

return { totalHits, timeToExpire, isBlocked, timeToBlockExpire }
`;

/**
 * Redis-backed ThrottlerStorage (SC-008) so rate limits are shared across all
 * backend replicas. Returns expiry values in seconds to match the contract of
 * the framework's default in-memory storage.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'throttle',
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    const hitKey = `${this.prefix}:${throttlerName}:${key}`;
    const blockKey = `${hitKey}:block`;

    const [totalHits, ttlMs, blocked, blockTtlMs] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      hitKey,
      blockKey,
      ttl.toString(),
      limit.toString(),
      blockDuration.toString(),
    )) as [number, number, number, number];

    return {
      totalHits: Number(totalHits),
      timeToExpire: Math.ceil(Number(ttlMs) / 1000),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.ceil(Number(blockTtlMs) / 1000),
    };
  }
}
