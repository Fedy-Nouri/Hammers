import type { ChatOpenAI } from '@langchain/openai';
import type { SchemaService } from './schema.service';
import type { SqlExecutorService } from './sql-executor.service';
import { buildAnalystGraph } from './analyst.graph';
import { MAX_ATTEMPTS } from './data-analyst.constants';

const schema = {
  describe: async () => 'analyst_meetings(id text, title text)',
} as unknown as SchemaService;

describe('buildAnalystGraph (self-correction loop)', () => {
  it('repairs a failed query, then answers; tokens accumulate across calls', async () => {
    let llmCalls = 0;
    const model = {
      invoke: async (messages: { content: unknown }[]) => {
        llmCalls += 1;
        const sys = String(messages[0]?.content ?? '');
        if (sys.startsWith('You are a data analyst')) {
          return { content: 'You have 3 meetings.', usage_metadata: { input_tokens: 50, output_tokens: 10 } };
        }
        return {
          content: '```sql\nSELECT count(*) AS n FROM analyst_meetings\n```',
          usage_metadata: { input_tokens: 100, output_tokens: 20 },
        };
      },
    } as unknown as ChatOpenAI;

    let runCalls = 0;
    const executor = {
      runReadOnly: async (userId: string) => {
        runCalls += 1;
        expect(userId).toBe('u1');
        if (runCalls === 1) throw new Error('relation does not exist');
        return { columns: ['n'], rows: [{ n: 3 }], truncated: false };
      },
    } as unknown as SqlExecutorService;

    const graph = buildAnalystGraph({ model, schema, executor });
    const final = await graph.invoke(
      { question: 'how many meetings?' },
      { configurable: { userId: 'u1', thread_id: 't1' } },
    );

    expect(runCalls).toBe(2); // one failure forces exactly one repair
    expect(llmCalls).toBe(3); // writeSql x2 + explain x1
    expect(final.attempts).toBe(2);
    expect(final.answer).toBe('You have 3 meetings.');
    expect(final.rows).toEqual([{ n: 3 }]);
    expect(final.tokensIn).toBe(250); // 100 + 100 + 50
    expect(final.tokensOut).toBe(50); // 20 + 20 + 10
  });

  it('stops after MAX_ATTEMPTS and still explains the failure', async () => {
    const model = {
      invoke: async (messages: { content: unknown }[]) => {
        const sys = String(messages[0]?.content ?? '');
        return sys.startsWith('You are a data analyst')
          ? { content: 'No matching data; try rephrasing.', usage_metadata: { input_tokens: 5, output_tokens: 5 } }
          : { content: 'SELECT 1 AS n FROM analyst_meetings', usage_metadata: { input_tokens: 5, output_tokens: 5 } };
      },
    } as unknown as ChatOpenAI;

    let runCalls = 0;
    const executor = {
      runReadOnly: async () => {
        runCalls += 1;
        throw new Error('always fails');
      },
    } as unknown as SqlExecutorService;

    const graph = buildAnalystGraph({ model, schema, executor });
    const final = await graph.invoke(
      { question: 'x' },
      { configurable: { userId: 'u1', thread_id: 't2' } },
    );

    expect(final.attempts).toBe(MAX_ATTEMPTS);
    expect(runCalls).toBe(MAX_ATTEMPTS);
    expect(final.error).not.toBeNull();
    expect(final.answer).toBe('No matching data; try rephrasing.');
  });
});
