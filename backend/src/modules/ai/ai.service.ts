import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import type { AiProvider, ChatMessage, ChatOptions, ChatResult } from './providers/ai-provider.interface';

@Injectable()
export class AiService {
  private readonly providers: Map<string, AiProvider>;
  private readonly defaultProvider: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiProvider,
    private readonly anthropic: AnthropicProvider,
  ) {
    this.providers = new Map<string, AiProvider>([
      ['openai', this.openAi],
      ['anthropic', this.anthropic],
    ]);
    this.defaultProvider = this.config.get<string>('AI_PROVIDER', 'openai');
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions & { providerName?: string; userId?: string; agentId?: string },
  ): Promise<ChatResult> {
    const providerName = options?.providerName ?? this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new BadRequestException(`Unknown AI provider: "${providerName}"`);
    }

    const result = await provider.chat(messages, options);

    await this.prisma.aiUsageLog.create({
      data: {
        userId: options?.userId ?? null,
        agentId: options?.agentId ?? null,
        provider: result.provider,
        model: result.model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
    });

    return result;
  }
}
