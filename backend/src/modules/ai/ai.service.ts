import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import type { AiProvider, ChatMessage, ChatOptions, ChatResult, StreamComplete } from './providers/ai-provider.interface';
import { computeCostUsd } from '../../common/utils/pricing.util';

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

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions & { providerName?: string; userId?: string; agentId?: string; conversationId?: string },
  ): AsyncGenerator<string> {
    const providerName = options?.providerName ?? this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new BadRequestException(`Unknown AI provider: "${providerName}"`);
    }

    // yield* captures the generator's TReturn (StreamComplete | null) as the expression value
    const done = yield* provider.chatStream(messages, options);

    if (done) {
      await this.prisma.aiUsageLog.create({
        data: {
          userId: options?.userId ?? null,
          agentId: options?.agentId ?? null,
          conversationId: options?.conversationId ?? null,
          provider: done.provider,
          model: done.model,
          promptTokens: done.usage.promptTokens,
          completionTokens: done.usage.completionTokens,
          totalTokens: done.usage.totalTokens,
          costUsd: computeCostUsd(done.model, done.usage.promptTokens, done.usage.completionTokens),
        },
      });
    }
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions & { providerName?: string; userId?: string; agentId?: string; conversationId?: string },
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
        conversationId: options?.conversationId ?? null,
        provider: result.provider,
        model: result.model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        costUsd: computeCostUsd(result.model, result.usage.promptTokens, result.usage.completionTokens),
      },
    });

    return result;
  }
}
