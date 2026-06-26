import {
  Annotation,
  StateGraph,
  START,
  END,
  MemorySaver,
  type LangGraphRunnableConfig,
} from '@langchain/langgraph';
import { SystemMessage, HumanMessage, type AIMessageChunk } from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import type { SchemaService } from './schema.service';
import type { SqlExecutorService } from './sql-executor.service';
import { MAX_ATTEMPTS, MAX_ERROR_LEN } from './data-analyst.constants';
import { buildWriterPrompt, EXPLAIN_PROMPT } from './prompts';

/** Graph state. `tokensIn/Out` accumulate across every LLM call; the rest are last-write. */
export const AnalystState = Annotation.Root({
  question: Annotation<string>(),
  schema: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  sql: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  error: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
  rows: Annotation<Record<string, unknown>[]>({ reducer: (_p, n) => n, default: () => [] }),
  columns: Annotation<string[]>({ reducer: (_p, n) => n, default: () => [] }),
  truncated: Annotation<boolean>({ reducer: (_p, n) => n, default: () => false }),
  answer: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  tokensIn: Annotation<number>({ reducer: (p, n) => p + n, default: () => 0 }),
  tokensOut: Annotation<number>({ reducer: (p, n) => p + n, default: () => 0 }),
});

export type AnalystStateType = typeof AnalystState.State;

export interface AnalystGraphDeps {
  model: ChatOpenAI;
  schema: SchemaService;
  executor: SqlExecutorService;
}

/** Read prompt/completion token counts off an AIMessageChunk (LangChain-normalized). */
function readUsage(res: AIMessageChunk): { input: number; output: number } {
  const meta = res.usage_metadata;
  return { input: meta?.input_tokens ?? 0, output: meta?.output_tokens ?? 0 };
}

/** Flatten message content to a plain string. */
function messageText(content: AIMessageChunk['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => (typeof part === 'string' ? part : 'text' in part ? part.text : ''))
    .join('');
}

/** Strip an optional ```sql fence the model may wrap the query in. */
function extractSql(content: AIMessageChunk['content']): string {
  const text = messageText(content);
  const fenced = text.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Build the compiled self-correcting analyst graph:
 *   loadSchema -> writeSql -> runQuery -(ok)-> explain
 *                    ^            |
 *                    └─(error / 0 rows, attempts<MAX)┘
 * The caller passes `userId` per run via config.configurable; it is never part of the
 * checkpointed state.
 */
export function buildAnalystGraph({ model, schema, executor }: AnalystGraphDeps) {
  async function loadSchema(): Promise<Partial<AnalystStateType>> {
    return { schema: await schema.describe() };
  }

  async function writeSql(state: AnalystStateType): Promise<Partial<AnalystStateType>> {
    const human = state.error
      ? `Question: ${state.question}\n\nYour previous SQL:\n${state.sql}\n\nIt failed with: ${state.error}\n\nReturn corrected SQL only.`
      : `Question: ${state.question}\n\nReturn one SQL query only.`;
    const res = await model.invoke([
      new SystemMessage(buildWriterPrompt(state.schema)),
      new HumanMessage(human),
    ]);
    const usage = readUsage(res);
    return {
      sql: extractSql(res.content),
      attempts: state.attempts + 1,
      error: null,
      tokensIn: usage.input,
      tokensOut: usage.output,
    };
  }

  async function runQuery(
    state: AnalystStateType,
    config: LangGraphRunnableConfig,
  ): Promise<Partial<AnalystStateType>> {
    const userId = (config.configurable?.userId as string | undefined) ?? '';
    try {
      const { columns, rows, truncated } = await executor.runReadOnly(userId, state.sql);
      return { rows, columns, truncated, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'query failed';
      return { rows: [], columns: [], truncated: false, error: message.slice(0, MAX_ERROR_LEN) };
    }
  }

  async function explain(state: AnalystStateType): Promise<Partial<AnalystStateType>> {
    const sample = state.rows.slice(0, 20);
    const human =
      state.error && state.rows.length === 0
        ? `Question: ${state.question}\n\nI could not retrieve data after ${state.attempts} attempt(s). Last error: ${state.error}. Briefly explain and suggest a rephrasing.`
        : `Question: ${state.question}\n\nColumns: ${state.columns.join(', ')}\nRows (${state.rows.length}): ${JSON.stringify(sample)}\n\nAnswer the question concisely.`;
    const res = await model.invoke([new SystemMessage(EXPLAIN_PROMPT), new HumanMessage(human)]);
    const usage = readUsage(res);
    return { answer: messageText(res.content), tokensIn: usage.input, tokensOut: usage.output };
  }

  const graph = new StateGraph(AnalystState)
    .addNode('loadSchema', loadSchema)
    .addNode('writeSql', writeSql)
    .addNode('runQuery', runQuery)
    .addNode('explain', explain)
    .addEdge(START, 'loadSchema')
    .addEdge('loadSchema', 'writeSql')
    .addEdge('writeSql', 'runQuery')
    .addConditionalEdges(
      'runQuery',
      (state: AnalystStateType) => {
        const failed = state.error !== null || state.rows.length === 0;
        return failed && state.attempts < MAX_ATTEMPTS ? 'writeSql' : 'explain';
      },
      { writeSql: 'writeSql', explain: 'explain' },
    )
    .addEdge('explain', END);

  return graph.compile({ checkpointer: new MemorySaver() });
}

export type AnalystGraph = ReturnType<typeof buildAnalystGraph>;
