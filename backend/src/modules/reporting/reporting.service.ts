import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActionItem, Decision, FollowUpEmail, Risk, TranscriptSegment } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ChatMessage } from '../ai/providers/ai-provider.interface';
import { UpdateEmailDto } from './dto/update-email.dto';

/** Cap transcript segments fed to the report prompt; the rolling summary covers the rest. */
const MAX_REPORT_SEGMENTS = 1500;

interface RawReport {
  executive?: unknown;
  followUps?: unknown;
  emailSubject?: unknown;
  emailBody?: unknown;
}

export interface MeetingReportResponse {
  report: {
    id: string;
    executive: string;
    followUps: string[];
    status: string;
    updatedAt: string;
  } | null;
  email: {
    id: string;
    subject: string;
    body: string;
    status: string;
    updatedAt: string;
  } | null;
  transcript: TranscriptSegment[];
  actionItems: ActionItem[];
  decisions: Decision[];
  risks: Risk[];
}

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly providerName?: string;
  private readonly model?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.providerName = this.config.get<string>('AI_ANALYSIS_PROVIDER') || undefined;
    this.model = this.config.get<string>('AI_ANALYSIS_MODEL') || undefined;
  }

  async generateForMeeting(meetingId: string): Promise<void> {
    const existing = await this.prisma.meetingReport.findUnique({ where: { meetingId } });
    if (existing && existing.status !== 'failed' && existing.status !== 'pending') return;

    await Promise.all([
      this.prisma.meetingReport.upsert({
        where: { meetingId },
        create: { meetingId, status: 'generating' },
        update: { status: 'generating' },
      }),
      this.prisma.followUpEmail.upsert({
        where: { meetingId },
        create: { meetingId, status: 'generating' },
        update: { status: 'generating' },
      }),
    ]);

    try {
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { id: true, userId: true, title: true, attendees: true },
      });
      if (!meeting) return;

      const [segments, analysis, actionItems, decisions, risks] = await Promise.all([
        this.prisma.transcriptSegment.findMany({
          where: { meetingId },
          orderBy: { startMs: 'asc' },
          take: MAX_REPORT_SEGMENTS,
        }),
        this.prisma.meetingAnalysis.findUnique({ where: { meetingId } }),
        this.prisma.actionItem.findMany({ where: { meetingId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.decision.findMany({ where: { meetingId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.risk.findMany({ where: { meetingId }, orderBy: { createdAt: 'asc' } }),
      ]);

      const messages = this.buildMessages({
        title: meeting.title,
        attendees: Array.isArray(meeting.attendees) ? (meeting.attendees as string[]) : [],
        summary: analysis?.summary ?? '',
        segments,
        actionItems: actionItems.map((a) => `${a.task}${a.assignee ? ` (${a.assignee})` : ''}`),
        decisions: decisions.map((d) => d.text),
        risks: risks.map((r) => `[${r.category}] ${r.text}`),
      });

      const result = await this.ai.chat(messages, {
        providerName: this.providerName,
        model: this.model,
        maxTokens: 3000,
        temperature: 0,
        userId: meeting.userId,
      });

      const parsed = this.parseJson(result.content);
      if (!parsed) {
        this.logger.warn(`Unparseable report output for meeting ${meetingId}`);
        await this.markFailed(meetingId);
        return;
      }

      const executive = typeof parsed.executive === 'string' ? parsed.executive.trim() : '';
      const followUps = Array.isArray(parsed.followUps)
        ? (parsed.followUps as unknown[]).filter((s): s is string => typeof s === 'string')
        : [];
      const emailSubject =
        typeof parsed.emailSubject === 'string' ? parsed.emailSubject.trim() : '';
      const emailBody = typeof parsed.emailBody === 'string' ? parsed.emailBody.trim() : '';

      await Promise.all([
        this.prisma.meetingReport.update({
          where: { meetingId },
          data: { executive, followUps, status: 'ready' },
        }),
        this.prisma.followUpEmail.update({
          where: { meetingId },
          data: { subject: emailSubject, body: emailBody, status: 'ready' },
        }),
      ]);

      this.logger.log(`Report + email generated for meeting ${meetingId}`);
    } catch (err) {
      this.logger.error(`Report generation failed for meeting ${meetingId}: ${String(err)}`);
      await this.markFailed(meetingId);
    }
  }

  async getReport(userId: string, meetingId: string): Promise<MeetingReportResponse> {
    await this.assertOwnership(userId, meetingId);

    const [report, email, transcript, actionItems, decisions, risks] = await Promise.all([
      this.prisma.meetingReport.findUnique({ where: { meetingId } }),
      this.prisma.followUpEmail.findUnique({ where: { meetingId } }),
      this.prisma.transcriptSegment.findMany({
        where: { meetingId },
        orderBy: { startMs: 'asc' },
      }),
      this.prisma.actionItem.findMany({ where: { meetingId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.decision.findMany({ where: { meetingId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.risk.findMany({ where: { meetingId }, orderBy: { createdAt: 'asc' } }),
    ]);

    return {
      report: report
        ? {
            id: report.id,
            executive: report.executive,
            followUps: report.followUps as string[],
            status: report.status,
            updatedAt: report.updatedAt.toISOString(),
          }
        : null,
      email: email
        ? {
            id: email.id,
            subject: email.subject,
            body: email.body,
            status: email.status,
            updatedAt: email.updatedAt.toISOString(),
          }
        : null,
      transcript,
      actionItems,
      decisions,
      risks,
    };
  }

  async updateEmail(
    userId: string,
    meetingId: string,
    dto: UpdateEmailDto,
  ): Promise<FollowUpEmail> {
    await this.assertOwnership(userId, meetingId);
    const existing = await this.prisma.followUpEmail.findUnique({ where: { meetingId } });
    if (!existing) throw new NotFoundException('Follow-up email not found');
    return this.prisma.followUpEmail.update({
      where: { meetingId },
      data: {
        subject: dto.subject ?? undefined,
        body: dto.body ?? undefined,
      },
    });
  }

  /** Send the (drafted, possibly edited) follow-up email to the meeting owner. */
  async sendFollowUp(userId: string, meetingId: string): Promise<FollowUpEmail> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      select: { id: true, user: { select: { email: true } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const email = await this.prisma.followUpEmail.findUnique({ where: { meetingId } });
    if (!email || !email.subject || !email.body) {
      throw new BadRequestException('Follow-up email is not ready to send');
    }

    await this.notifications.sendMeetingFollowUp(meeting.user.email, email.subject, email.body, userId);

    return this.prisma.followUpEmail.update({
      where: { meetingId },
      data: { status: 'sent' },
    });
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async assertOwnership(userId: string, meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      select: { id: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
  }

  private async markFailed(meetingId: string): Promise<void> {
    await Promise.all([
      this.prisma.meetingReport
        .update({ where: { meetingId }, data: { status: 'failed' } })
        .catch(() => {}),
      this.prisma.followUpEmail
        .update({ where: { meetingId }, data: { status: 'failed' } })
        .catch(() => {}),
    ]);
  }

  private buildMessages(ctx: {
    title: string;
    attendees: string[];
    summary: string;
    segments: TranscriptSegment[];
    actionItems: string[];
    decisions: string[];
    risks: string[];
  }): ChatMessage[] {
    const transcript = ctx.segments
      .map((s) => {
        const ts = this.fmtMs(s.startMs);
        const speaker = s.speaker != null ? `Speaker ${s.speaker}` : 'Unknown';
        return `[${ts}] ${speaker}: ${s.text}`;
      })
      .join('\n');

    const system = [
      'You are a professional meeting assistant generating a post-meeting report and follow-up email.',
      '',
      'Respond with STRICT JSON ONLY (no markdown fences, no prose outside the JSON):',
      '{',
      '  "executive": string,    // polished 3-5 sentence executive summary of the entire meeting',
      '  "followUps": string[],  // 3-6 concrete next-step recommendations beyond the listed action items',
      '  "emailSubject": string, // short professional subject line (e.g. "Meeting Recap: <title>")',
      '  "emailBody": string     // professional plain-text recap email ready to send',
      '}',
      '',
      'Rules:',
      '- Write in a professional but warm tone.',
      '- followUps must NOT repeat action items verbatim — they are higher-level next steps.',
      '- emailBody should be plain text with \\n newlines (not HTML or markdown).',
      '- emailBody should reference the key decisions, action items, and follow-ups.',
    ].join('\n');

    const lines: string[] = [
      `MEETING TITLE: ${ctx.title}`,
    ];
    if (ctx.attendees.length > 0) lines.push(`ATTENDEES: ${ctx.attendees.join(', ')}`);
    lines.push(
      '',
      'ROLLING SUMMARY:',
      ctx.summary.trim() || '(not available)',
      '',
      'ACTION ITEMS:',
      ctx.actionItems.length > 0 ? ctx.actionItems.map((a) => `- ${a}`).join('\n') : '(none)',
      '',
      'DECISIONS:',
      ctx.decisions.length > 0 ? ctx.decisions.map((d) => `- ${d}`).join('\n') : '(none)',
      '',
      'RISKS:',
      ctx.risks.length > 0 ? ctx.risks.map((r) => `- ${r}`).join('\n') : '(none)',
      '',
      'FULL TRANSCRIPT:',
      transcript || '(no transcript available)',
    );

    return [
      { role: 'system', content: system },
      { role: 'user', content: lines.join('\n') },
    ];
  }

  private fmtMs(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  private parseJson(raw: string): RawReport | null {
    const stripped = raw.replace(/```(?:json)?/g, '').trim();
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(stripped.slice(start, end + 1)) as RawReport;
    } catch {
      return null;
    }
  }
}
