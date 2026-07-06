import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestLogger } from './request-logger.middleware';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/api/users/me',
    headers: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response & { headers: Record<string, string>; emitFinish: () => void } {
  const emitter = new EventEmitter();
  const headers: Record<string, string> = {};
  const res = emitter as unknown as Response & {
    headers: Record<string, string>;
    emitFinish: () => void;
  };
  res.statusCode = 200;
  res.setHeader = ((name: string, value: string) => {
    headers[name.toLowerCase()] = value;
    return res;
  }) as Response['setHeader'];
  res.headers = headers;
  res.emitFinish = () => emitter.emit('finish');
  return res;
}

describe('requestLogger', () => {
  it('generates a request id, exposes it on req + response header, and calls next', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requestLogger(req, res, next);

    expect(req.requestId).toEqual(expect.any(String));
    expect(res.headers['x-request-id']).toBe(req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('honours an inbound x-request-id from an upstream proxy', () => {
    const req = mockReq({ headers: { 'x-request-id': 'trace-abc' } });
    const res = mockRes();

    requestLogger(req, res, jest.fn() as NextFunction);

    expect(req.requestId).toBe('trace-abc');
    expect(res.headers['x-request-id']).toBe('trace-abc');
  });

  it('logs an access line at info for a 2xx response on finish', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const req = mockReq();
    const res = mockRes();

    requestLogger(req, res, jest.fn() as NextFunction);
    res.statusCode = 200;
    res.emitFinish();

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('GET /api/users/me 200');
    logSpy.mockRestore();
  });

  it('logs 5xx at error level and 4xx at warn level', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const res500 = mockRes();
    requestLogger(mockReq(), res500, jest.fn() as NextFunction);
    res500.statusCode = 500;
    res500.emitFinish();

    const res404 = mockRes();
    requestLogger(mockReq(), res404, jest.fn() as NextFunction);
    res404.statusCode = 404;
    res404.emitFinish();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('skips access logging for health probes but still assigns an id', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const req = mockReq({ originalUrl: '/api/health' });
    const res = mockRes();

    requestLogger(req, res, jest.fn() as NextFunction);
    res.emitFinish();

    expect(req.requestId).toEqual(expect.any(String));
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
