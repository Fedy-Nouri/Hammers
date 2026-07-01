import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function context(user: { role?: string } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardRequiring(required: string[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('passes when no @Roles metadata is present', () => {
    expect(guardRequiring(undefined).canActivate(context({ role: 'user' }))).toBe(true);
  });

  it('passes for a user with the required role', () => {
    expect(guardRequiring(['admin']).canActivate(context({ role: 'admin' }))).toBe(true);
  });

  it('rejects a user without the required role', () => {
    expect(() => guardRequiring(['admin']).canActivate(context({ role: 'user' }))).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user', () => {
    expect(() => guardRequiring(['admin']).canActivate(context(undefined))).toThrow(ForbiddenException);
  });
});
