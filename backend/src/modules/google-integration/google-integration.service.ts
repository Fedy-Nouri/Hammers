import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import axios from 'axios';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { GoogleStatusResponse } from './dto/google-integration.response';

const ALGORITHM = 'aes-256-gcm';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface GoogleRefreshResponse {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class GoogleIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): Buffer {
    const hex = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    return Buffer.from(hex, 'hex');
  }

  private encrypt(text: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(ciphertext: string): string {
    const [ivHex, tagHex, encHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  getAuthUrl(userId: string): string {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');
    const state = Buffer.from(userId).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.readonly',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(code: string | undefined, state: string | undefined): Promise<string> {
    const frontendUrl = this.config.getOrThrow<string>('GOOGLE_FRONTEND_URL');

    if (!code || !state) {
      return `${frontendUrl}/profile?google=error`;
    }

    let userId: string;
    try {
      userId = Buffer.from(state, 'base64url').toString('utf8');
    } catch {
      return `${frontendUrl}/profile?google=error`;
    }

    try {
      const tokens = await this.exchangeCode(code);
      const userInfo = await this.getGoogleUserInfo(tokens.access_token);

      await this.prisma.googleIntegration.upsert({
        where: { userId },
        create: {
          userId,
          googleEmail: userInfo.email,
          encryptedAccessToken: this.encrypt(tokens.access_token),
          encryptedRefreshToken: this.encrypt(tokens.refresh_token),
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
        update: {
          googleEmail: userInfo.email,
          encryptedAccessToken: this.encrypt(tokens.access_token),
          encryptedRefreshToken: this.encrypt(tokens.refresh_token),
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });

      return `${frontendUrl}/profile?google=connected`;
    } catch {
      return `${frontendUrl}/profile?google=error`;
    }
  }

  async getStatus(userId: string): Promise<GoogleStatusResponse> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });

    if (!integration) return { connected: false };
    return { connected: true, email: integration.googleEmail };
  }

  async disconnect(userId: string): Promise<void> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });

    if (!integration) throw new NotFoundException('Google account not connected');

    try {
      const accessToken = this.decrypt(integration.encryptedAccessToken);
      await axios.post('https://oauth2.googleapis.com/revoke', null, {
        params: { token: accessToken },
      });
    } catch {
      // best effort — delete the record regardless
    }

    await this.prisma.googleIntegration.delete({ where: { userId } });
  }

  async getValidAccessToken(userId: string): Promise<string> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });

    if (!integration) throw new NotFoundException('Google account not connected');

    if (integration.tokenExpiresAt > new Date()) {
      return this.decrypt(integration.encryptedAccessToken);
    }

    const refreshToken = this.decrypt(integration.encryptedRefreshToken);
    const fresh = await this.refreshAccessToken(refreshToken);

    await this.prisma.googleIntegration.update({
      where: { userId },
      data: {
        encryptedAccessToken: this.encrypt(fresh.access_token),
        tokenExpiresAt: new Date(Date.now() + fresh.expires_in * 1000),
      },
    });

    return fresh.access_token;
  }

  private async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const { data } = await axios.post<GoogleTokenResponse>(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
        redirect_uri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
        grant_type: 'authorization_code',
      },
    );
    return data;
  }

  private async refreshAccessToken(refreshToken: string): Promise<GoogleRefreshResponse> {
    const { data } = await axios.post<GoogleRefreshResponse>(
      'https://oauth2.googleapis.com/token',
      {
        refresh_token: refreshToken,
        client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
        grant_type: 'refresh_token',
      },
    );
    return data;
  }

  private async getGoogleUserInfo(accessToken: string): Promise<{ email: string }> {
    const { data } = await axios.get<{ email: string }>(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return data;
  }
}
