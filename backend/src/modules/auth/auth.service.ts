import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponse,
  TokensResponse,
  MessageResponse,
  UserResponse,
} from './dto/auth.response';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    void this.notifications.sendWelcome(user.email, user.firstName, user.id).catch(() => undefined);

    const tokens = await this.generateAndSaveTokens(user);
    return { ...tokens, user: this.toUserResponse(user) };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateAndSaveTokens(user);
    return { ...tokens, user: this.toUserResponse(user) };
  }

  async refresh(userId: string, rawRefreshToken: string): Promise<TokensResponse> {
    const user = await this.usersService.findById(userId);
    if (!user?.refreshTokenHash) throw new UnauthorizedException();

    const valid = await bcrypt.compare(rawRefreshToken, user.refreshTokenHash);
    if (!valid) throw new UnauthorizedException();

    return this.generateAndSaveTokens(user);
  }

  async logout(userId: string): Promise<MessageResponse> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string): Promise<MessageResponse & { resetToken?: string }> {
    const user = await this.usersService.findByEmail(email);

    // Always return the same message to prevent email enumeration
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: tokenHash, passwordResetExpiresAt: expiresAt },
    });

    // Email the reset link (console-logged in dev when no provider is configured).
    await this.notifications.sendPasswordReset(user.email, token, user.id);

    // Dev convenience: also return the raw token so the flow is testable without a provider.
    const isDev = this.configService.get<string>('NODE_ENV') !== 'production';
    return {
      message: 'If that email exists, a reset link has been sent.',
      ...(isDev && { resetToken: token }),
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
    const users = await this.prisma.user.findMany({
      where: { passwordResetToken: { not: null }, passwordResetExpiresAt: { gt: new Date() } },
    });

    const matchingUser = await this.findUserByResetToken(users, token);
    if (!matchingUser) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: matchingUser.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null, refreshTokenHash: null },
    });

    return { message: 'Password reset successfully' };
  }

  private async findUserByResetToken(users: User[], rawToken: string): Promise<User | null> {
    for (const user of users) {
      if (!user.passwordResetToken) continue;
      const match = await bcrypt.compare(rawToken, user.passwordResetToken);
      if (match) return user;
    }
    return null;
  }

  private async generateAndSaveTokens(user: User): Promise<TokensResponse> {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m') as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue,
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }

  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
