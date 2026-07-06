import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from './auth.service';
import { User } from '@prisma/client';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'PLACEHOLDER',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'user',
    refreshTokenHash: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as User;
}

function setup() {
  const userCreate = jest.fn();
  const userUpdate = jest.fn().mockResolvedValue(undefined);
  const userFindMany = jest.fn();
  const prisma = {
    user: { create: userCreate, update: userUpdate, findMany: userFindMany },
  } as unknown as PrismaService;

  const findByEmail = jest.fn();
  const findById = jest.fn();
  const usersService = { findByEmail, findById } as unknown as UsersService;

  const signAsync = jest
    .fn()
    .mockResolvedValueOnce('access-token')
    .mockResolvedValueOnce('refresh-token');
  const jwtService = { signAsync } as unknown as JwtService;

  const configService = {
    get: jest.fn((key: string, def?: unknown) =>
      key === 'NODE_ENV' ? 'test' : def,
    ),
    getOrThrow: jest.fn(() => 'test-secret'),
  } as unknown as ConfigService;

  const sendWelcome = jest.fn().mockResolvedValue(undefined);
  const sendPasswordReset = jest.fn().mockResolvedValue(undefined);
  const notifications = {
    sendWelcome,
    sendPasswordReset,
  } as unknown as NotificationsService;

  const service = new AuthService(
    prisma,
    usersService,
    jwtService,
    configService,
    notifications,
  );

  return {
    service,
    userCreate,
    userUpdate,
    userFindMany,
    findByEmail,
    findById,
    signAsync,
    sendWelcome,
    sendPasswordReset,
    configService,
  };
}

describe('AuthService', () => {
  describe('register', () => {
    it('rejects a duplicate email', async () => {
      const t = setup();
      t.findByEmail.mockResolvedValue(makeUser());
      await expect(
        t.service.register({ email: 'jane@example.com', password: 'pw', firstName: 'J', lastName: 'D' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(t.userCreate).not.toHaveBeenCalled();
    });

    it('hashes the password, saves a refresh token, sends welcome, and returns tokens + safe user', async () => {
      const t = setup();
      t.findByEmail.mockResolvedValue(null);
      t.userCreate.mockImplementation(({ data }: { data: { passwordHash: string } }) =>
        Promise.resolve(makeUser({ passwordHash: data.passwordHash })),
      );

      const res = await t.service.register({
        email: 'jane@example.com',
        password: 's3cret',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      // Password is bcrypt-hashed, never stored in the clear.
      const created = t.userCreate.mock.calls[0][0].data;
      expect(created.passwordHash).not.toBe('s3cret');
      await expect(bcrypt.compare('s3cret', created.passwordHash)).resolves.toBe(true);

      expect(t.sendWelcome).toHaveBeenCalledWith('jane@example.com', 'Jane', 'user-1');
      expect(res.accessToken).toBe('access-token');
      expect(res.refreshToken).toBe('refresh-token');
      // The response must not leak the password hash.
      expect(res.user).toEqual(
        expect.objectContaining({ id: 'user-1', email: 'jane@example.com', role: 'user' }),
      );
      expect((res.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();

      // A hashed refresh token is persisted.
      const lastUpdate = t.userUpdate.mock.calls.at(-1)![0];
      expect(lastUpdate.data.refreshTokenHash).toEqual(expect.any(String));
    });
  });

  describe('login', () => {
    it('rejects an unknown email with a generic error (no enumeration)', async () => {
      const t = setup();
      t.findByEmail.mockResolvedValue(null);
      await expect(
        t.service.login({ email: 'nope@example.com', password: 'pw' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('rejects a wrong password with the same generic error', async () => {
      const t = setup();
      const passwordHash = await bcrypt.hash('correct', 12);
      t.findByEmail.mockResolvedValue(makeUser({ passwordHash }));
      await expect(
        t.service.login({ email: 'jane@example.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('returns tokens on valid credentials', async () => {
      const t = setup();
      const passwordHash = await bcrypt.hash('correct', 12);
      t.findByEmail.mockResolvedValue(makeUser({ passwordHash }));
      const res = await t.service.login({ email: 'jane@example.com', password: 'correct' });
      expect(res).toMatchObject({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });
  });

  describe('refresh', () => {
    it('rejects when the user has no stored refresh token', async () => {
      const t = setup();
      t.findById.mockResolvedValue(makeUser({ refreshTokenHash: null }));
      await expect(t.service.refresh('user-1', 'whatever')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the presented token does not match the stored hash', async () => {
      const t = setup();
      const refreshTokenHash = await bcrypt.hash('the-real-token', 10);
      t.findById.mockResolvedValue(makeUser({ refreshTokenHash }));
      await expect(t.service.refresh('user-1', 'a-forged-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('issues new tokens when the refresh token matches', async () => {
      const t = setup();
      const refreshTokenHash = await bcrypt.hash('the-real-token', 10);
      t.findById.mockResolvedValue(makeUser({ refreshTokenHash }));
      const res = await t.service.refresh('user-1', 'the-real-token');
      expect(res).toMatchObject({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token', async () => {
      const t = setup();
      const res = await t.service.logout('user-1');
      expect(t.userUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshTokenHash: null },
      });
      expect(res.message).toMatch(/logged out/i);
    });
  });

  describe('forgotPassword', () => {
    it('does not reveal that an email is unknown and performs no writes', async () => {
      const t = setup();
      t.findByEmail.mockResolvedValue(null);
      const res = await t.service.forgotPassword('ghost@example.com');
      expect(res.message).toMatch(/if that email exists/i);
      expect(res).not.toHaveProperty('resetToken');
      expect(t.userUpdate).not.toHaveBeenCalled();
      expect(t.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('stores a hashed reset token and emails the raw token to a known user', async () => {
      const t = setup();
      t.findByEmail.mockResolvedValue(makeUser());
      const res = await t.service.forgotPassword('jane@example.com');

      const update = t.userUpdate.mock.calls[0][0];
      expect(update.data.passwordResetToken).toEqual(expect.any(String));
      expect(update.data.passwordResetExpiresAt.getTime()).toBeGreaterThan(Date.now());

      // The emailed token is the raw one; what we persist is only its hash.
      const rawToken = t.sendPasswordReset.mock.calls[0][1];
      await expect(bcrypt.compare(rawToken, update.data.passwordResetToken)).resolves.toBe(true);
      // Dev/test convenience: the raw token is echoed back when NODE_ENV != production.
      expect(res.resetToken).toBe(rawToken);
    });
  });

  describe('resetPassword', () => {
    it('rejects an invalid / expired token', async () => {
      const t = setup();
      t.userFindMany.mockResolvedValue([]);
      await expect(t.service.resetPassword('bad-token', 'newpw')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(t.userUpdate).not.toHaveBeenCalled();
    });

    it('sets a new password hash and clears reset + refresh state on a matching token', async () => {
      const t = setup();
      const rawToken = 'valid-reset-token';
      const passwordResetToken = await bcrypt.hash(rawToken, 10);
      t.userFindMany.mockResolvedValue([makeUser({ passwordResetToken })]);

      const res = await t.service.resetPassword(rawToken, 'brand-new-pw');

      const update = t.userUpdate.mock.calls[0][0];
      await expect(bcrypt.compare('brand-new-pw', update.data.passwordHash)).resolves.toBe(true);
      expect(update.data.passwordResetToken).toBeNull();
      expect(update.data.passwordResetExpiresAt).toBeNull();
      expect(update.data.refreshTokenHash).toBeNull();
      expect(res.message).toMatch(/reset/i);
    });
  });
});
