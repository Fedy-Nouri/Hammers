import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Catches every unhandled exception, returns a consistent JSON body, and logs the
 * unexpected ones (non-HttpException or 5xx) with their stack + method/path. It is
 * additive over Nest's default: the existing `statusCode`/`message`/`error` fields are
 * preserved (so ValidationPipe 400 details and clients that read `.message` keep working),
 * with `path` + `timestamp` added.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log unexpected errors (anything that isn't a deliberate HttpException, or any 5xx).
    if (!isHttp || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Once an SSE/streaming response has flushed headers we can't send a JSON body — the
    // error is logged above; just bail out to avoid an "ERR_HTTP_HEADERS_SENT" crash.
    if (response.headersSent) return;

    const { message, error } = describe(exception, isHttp, status);
    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }
}

function describe(
  exception: unknown,
  isHttp: boolean,
  status: number,
): { message: string | string[]; error: string } {
  const fallbackError = HttpStatus[status] ?? 'Error';
  if (isHttp) {
    const payload = (exception as HttpException).getResponse();
    if (typeof payload === 'string') {
      return { message: payload, error: fallbackError };
    }
    if (payload && typeof payload === 'object') {
      const p = payload as { message?: string | string[]; error?: string };
      return {
        message: p.message ?? (exception as HttpException).message,
        error: p.error ?? fallbackError,
      };
    }
  }
  return { message: 'Internal server error', error: 'Internal Server Error' };
}
