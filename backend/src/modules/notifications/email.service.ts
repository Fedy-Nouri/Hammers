import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface SendParams {
  to: string;
  subject: string;
  html: string;
  type: string;
  userId?: string | null;
  period?: string | null;
}

/** Mask a recipient address for logs: jo***@example.com. */
function redact(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}***@${domain}`;
}

/**
 * Sends email via Resend, tolerant of missing config (mirrors StripeService): with no
 * RESEND_API_KEY it logs the email via a console driver instead of sending. Every attempt
 * (sent | failed | logged) is recorded in EmailLog. `send()` never throws, so notification
 * callers can fire-and-forget without risking the triggering request.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
    this.from = this.config.get<string>('EMAIL_FROM', 'Hammers <onboarding@resend.dev>');
  }

  get configured(): boolean {
    return this.resend !== null;
  }

  async send(params: SendParams): Promise<void> {
    const { to, subject, html, type, userId, period } = params;
    let status: 'sent' | 'failed' | 'logged' = 'logged';
    let error: string | null = null;

    if (!this.resend) {
      this.logger.log(`[email:logged] to=${redact(to)} type=${type} subject="${subject}" (no RESEND_API_KEY)`);
    } else {
      try {
        await this.resend.emails.send({ from: this.from, to, subject, html });
        status = 'sent';
        this.logger.log(`[email:sent] to=${redact(to)} type=${type}`);
      } catch (e) {
        status = 'failed';
        error = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[email:failed] to=${redact(to)} type=${type}: ${error}`);
      }
    }

    try {
      await this.prisma.emailLog.create({
        data: { userId: userId ?? null, to, type, period: period ?? null, status, error },
      });
    } catch (e) {
      this.logger.warn(`failed to write EmailLog: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
