import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AgentsModule } from './modules/agents/agents.module';
import { AiModule } from './modules/ai/ai.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { UsageModule } from './modules/usage/usage.module';
import { GoogleIntegrationModule } from './modules/google-integration/google-integration.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    AgentsModule,
    AiModule,
    ConversationsModule,
    UsageModule,
    GoogleIntegrationModule,
  ],
})
export class AppModule {}
