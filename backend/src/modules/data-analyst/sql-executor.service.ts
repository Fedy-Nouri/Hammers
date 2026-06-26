import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MAX_ROWS, USER_ID_GUC, validateSql } from './data-analyst.constants';

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
}

/** Convert a raw-query value into something JSON/markdown-safe (BigInt, Date). */
function normalizeValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  return value;
}

function toJsonSafe(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = normalizeValue(value);
  }
  return out;
}

/**
 * Runs a single, validated, read-only SELECT scoped to one user.
 *
 * Safety is layered: (1) `validateSql` rejects anything but a single analyst_* SELECT;
 * (2) the query runs in a transaction that is forced READ ONLY with a statement timeout,
 * so even a bypass of (1) cannot write or hang; (3) the user id is bound as a parameter
 * into the `app.current_user_id` GUC that every analyst_* view filters on, so a user can
 * only ever see their own rows; (4) results are hard-capped at MAX_ROWS.
 */
@Injectable()
export class SqlExecutorService {
  constructor(private readonly prisma: PrismaService) {}

  async runReadOnly(userId: string, sql: string): Promise<QueryResult> {
    const inner = validateSql(sql);
    const wrapped = `SELECT * FROM (${inner}) AS analyst_result LIMIT ${MAX_ROWS + 1}`;

    const raw = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '5s'`);
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '2s'`);
        // Force read-only: any write/DDL now throws, the ultimate backstop.
        await tx.$executeRawUnsafe(`SET LOCAL transaction_read_only = on`);
        // Bind the user id (never interpolate) into the GUC the views filter on.
        await tx.$executeRawUnsafe(
          `SELECT set_config('${USER_ID_GUC}', $1, true)`,
          userId,
        );
        return tx.$queryRawUnsafe<Record<string, unknown>[]>(wrapped);
      },
      { timeout: 15_000, maxWait: 5_000 },
    );

    const truncated = raw.length > MAX_ROWS;
    const rows = raw.slice(0, MAX_ROWS).map(toJsonSafe);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, truncated };
  }
}
