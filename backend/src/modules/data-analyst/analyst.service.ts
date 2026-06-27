import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ChatOpenAI } from '@langchain/openai';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { computeCostUsd } from '../../common/utils/pricing.util';
import { SchemaService } from './schema.service';
import { SqlExecutorService } from './sql-executor.service';
import { buildAnalystGraph, type AnalystGraph, type AnalystStateType } from './analyst.graph';
import { ANALYST_MAX_OUTPUT_TOKENS, DEFAULT_ANALYST_MODEL } from './data-analyst.constants';

/**
 * Drives the LangGraph analyst: turns a natural-language question into a validated answer
 * (self-correcting failed SQL up to MAX_ATTEMPTS) and streams human-readable progress plus
 * the final SQL/result table. Usage is logged to AiUsageLog manually because the graph calls
 * the LLM directly rather than through AiService.
 */
@Injectable()
export class AnalystService {
  private readonly logger = new Logger(AnalystService.name);
  private readonly graph: AnalystGraph;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    schema: SchemaService,
    executor: SqlExecutorService,
  ) {
    this.model = this.config.get<string>('DATA_ANALYST_MODEL', DEFAULT_ANALYST_MODEL);
    const llm = new ChatOpenAI({
      model: this.model,
      temperature: 0,
      maxTokens: ANALYST_MAX_OUTPUT_TOKENS,
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
      configuration: { baseURL: this.config.get<string>('OPENAI_BASE_URL') || undefined },
    });
    this.graph = buildAnalystGraph({ model: llm, schema, executor });
  }

  async *stream(
    userId: string,
    question: string,
    conversationId?: string,
  ): AsyncGenerator<string> {
    const q = question.trim();
    if (!q) {
      yield 'Ask a question about your data — e.g. "how many job applications do I have by status?"';
      return;
    }

    const config = { configurable: { userId, thread_id: randomUUID() } };
    try {
      const events = await this.graph.stream({ question: q }, { ...config, streamMode: 'updates' });
      for await (const update of events) {
        const entry = Object.entries(update as Record<string, Partial<AnalystStateType>>)[0];
        if (!entry) continue;
        const line = this.narrate(entry[0], entry[1]);
        if (line) yield line;
      }

      const snapshot = await this.graph.getState(config);
      const final = snapshot.values as AnalystStateType;
      yield this.renderAnswer(final);
      await this.logUsage(userId, conversationId, final);
    } catch (err) {
      this.logger.error(
        `analyst stream failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      yield '\n\n⚠ Sorry — I ran into a problem analyzing your data. Please try rephrasing your question.';
    }
  }

  /** Per-node progress line shown live in the chat bubble. */
  private narrate(node: string, patch: Partial<AnalystStateType>): string {
    switch (node) {
      case 'loadSchema':
        return '🔎 Inspecting your data…\n\n';
      case 'writeSql':
        return `📝 Writing SQL (attempt ${patch.attempts ?? 1})…\n\n\`\`\`sql\n${(patch.sql ?? '').trim()}\n\`\`\`\n\n`;
      case 'runQuery':
        return patch.error
          ? `⚠ That query failed: ${patch.error}\n   Fixing and retrying…\n\n`
          : `▶ Ran it — ${patch.rows?.length ?? 0} row(s).\n\n`;
      default:
        return '';
    }
  }

  /** Final settled block: the winning SQL, a result table, then the plain-language answer. */
  private renderAnswer(state: AnalystStateType): string {
    const parts: string[] = ['\n---\n\n'];
    if (state.sql) parts.push(`\`\`\`sql\n${state.sql.trim()}\n\`\`\`\n\n`);
    if (state.rows.length > 0) {
      parts.push(this.renderTable(state.columns, state.rows));
      if (state.truncated) parts.push(`\n_Showing the first ${state.rows.length} rows._\n`);
      parts.push('\n');
    }
    parts.push(state.answer || '_No answer produced._');
    return parts.join('');
  }

  /** Render up to 20 rows as a GFM pipe table (cells escaped). */
  private renderTable(columns: string[], rows: Record<string, unknown>[]): string {
    const cols = columns.length > 0 ? columns : Object.keys(rows[0] ?? {});
    if (cols.length === 0) return '';
    const cell = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    };
    const head = `| ${cols.join(' | ')} |`;
    const sep = `| ${cols.map(() => '---').join(' | ')} |`;
    const body = rows
      .slice(0, 20)
      .map((r) => `| ${cols.map((c) => cell(r[c])).join(' | ')} |`)
      .join('\n');
    return `${head}\n${sep}\n${body}\n`;
  }

  /** One aggregated AiUsageLog row for the whole run (graph bypasses AiService). */
  private async logUsage(
    userId: string,
    conversationId: string | undefined,
    state: AnalystStateType,
  ): Promise<void> {
    const promptTokens = state.tokensIn ?? 0;
    const completionTokens = state.tokensOut ?? 0;
    if (promptTokens === 0 && completionTokens === 0) return;
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          agentId: 'data-analyst',
          conversationId: conversationId ?? null,
          provider: 'openrouter',
          model: this.model,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          costUsd: computeCostUsd(this.model, promptTokens, completionTokens),
        },
      });
    } catch (err) {
      this.logger.warn(
        `failed to log analyst usage: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
