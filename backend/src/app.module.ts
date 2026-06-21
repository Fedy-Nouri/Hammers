import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
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
  ],
})
export class AppModule {}
