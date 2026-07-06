import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-request-id';
const logger = new Logger('HTTP');

/**
 * Assigns every request a correlation id (honouring an inbound `x-request-id` from an upstream
 * proxy, otherwise generating one), echoes it back on the response header, and logs a single
 * structured line when the response finishes: `[id] METHOD url status durationms`. The id is
 * stashed on `req.requestId` so the exception filter can tie a failure back to its access-log
 * line. Registered via `app.use()` so it also covers 404s and errors that never reach a handler.
 *
 * Health/readiness probes are skipped to keep the access log signal-rich (they still get an id).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[HEADER];
  const provided = (Array.isArray(incoming) ? incoming[0] : incoming)?.trim();
  const requestId = provided || randomUUID();

  req.requestId = requestId;
  res.setHeader(HEADER, requestId);

  if (req.originalUrl.startsWith('/api/health')) {
    next();
    return;
  }

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const line = `[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });

  next();
}
