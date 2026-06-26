import { BadRequestException } from '@nestjs/common';

/** Hard limits for the read-only analyst executor. */
export const MAX_ROWS = 200;
export const MAX_SQL_LEN = 4000;
export const MAX_ERROR_LEN = 300;

/** Self-correction loop bound for the LangGraph analyst. */
export const MAX_ATTEMPTS = 4;

/** Default OpenRouter model slug for the analyst (overridable via DATA_ANALYST_MODEL). */
export const DEFAULT_ANALYST_MODEL = 'anthropic/claude-sonnet-4';

/** Postgres session GUC that the per-user views filter on. */
export const USER_ID_GUC = 'app.current_user_id';

/**
 * The only relations the analyst is ever allowed to read. Each is a per-user view
 * created in the da001_analyst_views migration; together with the read-only
 * transaction they are the hard wall that keeps the generated SQL scoped + safe.
 */
export const ANALYST_VIEWS = [
  'analyst_job_applications',
  'analyst_job_profiles',
  'analyst_job_scrape_jobs',
  'analyst_meetings',
  'analyst_conversations',
  'analyst_ai_usage_logs',
  'analyst_meeting_reports',
  'analyst_messages',
] as const;

const ANALYST_VIEW_SET = new Set<string>(ANALYST_VIEWS);

/**
 * Write / DDL / privilege / IO keywords. Matched with word boundaries against SQL
 * whose string literals have been stripped, so `"createdAt"`/`"updatedAt"` (no
 * boundary after `create`/`update`) and text searches like `'%update%'` are safe.
 */
const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|merge|into|vacuum|analyze|reindex|cluster|refresh|lock|listen|notify|prepare|deallocate|discard|reset|savepoint|rollback|commit|begin|call|do|set)\b/i;

/** Substrings that expose catalogs, the GUC, or out-of-band IO. */
const FORBIDDEN_SUBSTRINGS = [
  'pg_',
  'information_schema',
  'current_setting',
  'set_config',
  'dblink',
  'lo_import',
  'lo_export',
];

/** Replace single-quoted string literals (handling '' escapes) with an empty literal. */
function stripStringLiterals(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

/**
 * Validate a model-generated query before it ever reaches the database. Throws
 * BadRequestException on anything that is not a single, read-only SELECT/WITH over
 * the analyst_* views. Returns the cleaned single statement (trailing `;` removed).
 *
 * This is defense-in-depth on top of the READ ONLY transaction and statement timeout
 * enforced by SqlExecutorService — not a substitute for them.
 */
export function validateSql(raw: string): string {
  const sql = raw.trim();
  if (!sql) throw new BadRequestException('Empty SQL query.');
  if (sql.length > MAX_SQL_LEN) throw new BadRequestException('SQL query is too long.');
  if (!/^(select|with)\b/i.test(sql)) {
    throw new BadRequestException('Only read-only SELECT/WITH queries are allowed.');
  }

  // Analyse the SQL with string literals removed so user text can't smuggle keywords.
  const scan = stripStringLiterals(sql);

  if (scan.includes('$')) {
    throw new BadRequestException('Dollar-quoting and parameters are not allowed.');
  }
  if (scan.includes('--') || scan.includes('/*')) {
    throw new BadRequestException('SQL comments are not allowed.');
  }

  // Single statement only: tolerate one trailing semicolon, reject any other.
  const body = scan.replace(/;\s*$/, '');
  if (body.includes(';')) {
    throw new BadRequestException('Only a single statement is allowed.');
  }

  if (FORBIDDEN_KEYWORDS.test(scan)) {
    throw new BadRequestException('Query contains a forbidden keyword.');
  }
  const lower = scan.toLowerCase();
  for (const sub of FORBIDDEN_SUBSTRINGS) {
    if (lower.includes(sub)) {
      throw new BadRequestException(`Disallowed reference: ${sub}`);
    }
  }

  // Every FROM/JOIN target must be one of the allow-listed analyst_* views.
  const refs = [...scan.matchAll(/\b(?:from|join)\s+("?)([a-z_][\w]*)\1/gi)];
  if (refs.length === 0) {
    throw new BadRequestException('Query must read from an analyst_* view.');
  }
  for (const m of refs) {
    const ident = m[2].toLowerCase();
    if (!ANALYST_VIEW_SET.has(ident)) {
      throw new BadRequestException(
        `Query may only reference analyst_* views, not "${m[2]}".`,
      );
    }
  }

  return sql.replace(/;\s*$/, '');
}
