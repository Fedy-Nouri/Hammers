import { Global, Logger, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisLockService } from './redis-lock.service';

/**
 * Provides a shared ioredis client (or null when REDIS_URL is unset) plus the
 * distributed lock helper. Global so any module can inject Redis features.
 */
const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis | null => {
    const url = config.get<string>('REDIS_URL');
    if (!url) {
      new Logger('RedisModule').warn(
        'REDIS_URL not set — Redis features disabled (single-instance mode)',
      );
      return null;
    }
    const client = new Redis(url, { maxRetriesPerRequest: null });
    client.on('error', (err) =>
      new Logger('RedisModule').error(`Redis error: ${err.message}`),
    );
    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider, RedisLockService],
  exports: [REDIS_CLIENT, RedisLockService],
})
export class RedisModule {}
