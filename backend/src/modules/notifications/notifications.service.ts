import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EmailService } from './email.service';
import {
  meetingFollowUpEmail,
  passwordResetEmail,
  quotaBlockedEmail,
  quotaWarnEmail,
  welcomeEmail,
} from './templates';

/** Minimal shape of QuotaService usage — declared locally to avoid a billing import cycle. */
export interface QuotaUsageLike {
  cap: number;
  usedUsd: number;
  percent: number;
  exceeded: boolean;
}

/** High-level notification API the rest of the app calls. All sends are non-throwing. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly email: EmailService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async sendPasswordReset(to: string, rawToken: string, userId?: string): Promise<void> {
    const base = this.config.get<string>('APP_FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, '');
    const link = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const { subject, html } = passwordResetEmail(link);
    await this.email.send({ to, subject, html, type: 'password_reset', userId });
  }

  async sendWelcome(to: string, firstName?: string | null, userId?: string): Promise<void> {
    const { subject, html } = welcomeEmail(firstName);
    await this.email.send({ to, subject, html, type: 'welcome', userId });
  }

  async sendMeetingFollowUp(to: string, draftSubject: string, body: string, userId?: string): Promise<void> {
    const { subject, html } = meetingFollowUpEmail(draftSubject, body);
    await this.email.send({ to, subject, html, type: 'meeting_followup', userId });
  }

  /**
   * Once-per-month quota warning / blocked email, deduped via EmailLog (best-effort: a tiny
   * race between concurrent over-80% requests could double-send). Looks up the user's email.
   */
  async maybeSendQuotaEmail(userId: string, usage: QuotaUsageLike): Promise<void> {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
    const type = usage.exceeded ? 'quota_blocked' : 'quota_warn';

    const already = await this.prisma.emailLog.findFirst({ where: { userId, type, period } });
    if (already) return;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;

    const { subject, html } = usage.exceeded
      ? quotaBlockedEmail(usage.cap)
      : quotaWarnEmail(usage.usedUsd, usage.cap, usage.percent);
    await this.email.send({ to: user.email, subject, html, type, userId, period });
  }
}
