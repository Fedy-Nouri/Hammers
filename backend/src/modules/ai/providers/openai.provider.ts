import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AiProvider, ChatMessage, ChatOptions, ChatResult } from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({ apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY') });
    this.defaultModel = this.config.get<string>('AI_DEFAULT_MODEL', 'gpt-4o-mini');
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string> {
    const model = options?.model ?? this.defaultModel;
    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const model = options?.model ?? this.defaultModel;

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    const choice = response.choices[0];
    const usage = response.usage;

    return {
      content: choice.message.content ?? '',
      provider: this.name,
      model,
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
    };
  }
}
