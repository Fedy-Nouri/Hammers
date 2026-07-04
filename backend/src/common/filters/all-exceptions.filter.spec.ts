import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AllExceptionsFilter } from './all-exceptions.filter';

function mockHost(headersSent = false) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { headersSent, status } as unknown as Response;
  const request = { method: 'GET', url: '/api/x' } as unknown as Request;
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('formats an HttpException, preserving status/message and adding path + timestamp', () => {
    const { host, status, json } = mockHost();
    filter.catch(new NotFoundException('nope'), host);
    expect(status).toHaveBeenCalledWith(404);
    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({ statusCode: 404, message: 'nope', path: '/api/x' });
    expect(typeof body.timestamp).toBe('string');
  });

  it('maps an unknown error to 500 with a generic message', () => {
    const { host, status, json } = mockHost();
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect((json.mock.calls[0][0] as { message: string }).message).toBe('Internal server error');
  });

  it('does not write a body once headers are sent (SSE-safe)', () => {
    const { host, status, json } = mockHost(true);
    filter.catch(new Error('mid-stream'), host);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});
