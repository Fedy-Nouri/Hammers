import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from './config/env.validation';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { REDIS_CLIENT } from './infrastructure/redis/redis.constants';
import { RedisThrottlerStorage } from './infrastructure/redis/redis-throttler.storage';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AgentsModule } from './modules/agents/agents.module';
import { AiModule } from './modules/ai/ai.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { UsageModule } from './modules/usage/usage.module';
import { GoogleIntegrationModule } from './modules/google-integration/google-integration.module';
import { MeetingSyncModule } from './modules/meeting-sync/meeting-sync.module';
import { BotModule } from './modules/bot/bot.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { JobScrapeModule } from './modules/job-scrape/job-scrape.module';
import { DataAnalystModule } from './modules/data-analyst/data-analyst.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis | null) => ({
        throttlers: [{ name: 'default', ttl: seconds(60), limit: 100 }],
        // Shared across replicas via Redis; falls back to in-memory in dev.
        storage: redis ? new RedisThrottlerStorage(redis) : undefined,
      }),
    }),
    UsersModule,
    AuthModule,
    AgentsModule,
    AiModule,
    ConversationsModule,
    UsageModule,
    GoogleIntegrationModule,
    MeetingSyncModule,
    BotModule,
    TranscriptionModule,
    AnalysisModule,
    ReportingModule,
    JobsModule,
    JobScrapeModule,
    DataAnalystModule,
    BillingModule,
    NotificationsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    // Rate-limit every route by default (100 req / 60s per client). Individual routes
    // override the limit with @Throttle(), or opt out with @SkipThrottle(). Registering
    // the guard here — rather than per-controller @UseGuards — means new controllers are
    // protected automatically and requests are counted exactly once.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
