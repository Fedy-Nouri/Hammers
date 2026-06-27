import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { DataAnalystModule } from '../data-analyst/data-analyst.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [DataAnalystModule, BillingModule],
  controllers: [AiController],
  providers: [AiService, OpenAiProvider, AnthropicProvider],
  exports: [AiService],
})
export class AiModule {}
