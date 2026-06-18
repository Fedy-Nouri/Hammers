import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActionItem, Decision, Risk, TranscriptSegment } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import type { ChatMessage } from '../ai/providers/ai-provider.interface';
import { UpdateActionItemDto } from './dto/update-action-item.dto';

/** Max transcript segments fed to the model per cycle — bounds prompt size. */
const MAX_SEGMENTS_PER_CYCLE = 400;
/** Existing-item hints passed to the model so it avoids re-emitting duplicates. */
const MAX_EXISTING_HINTS = 40;

const RISK_CATEGORIES = ['risk', 'blocker', 'dependency'] as const;
type RiskCategory = (typeof RISK_CATEGORIES)[number];

interface RawActionItem {
  task?: unknown;
  assignee?: unknown;
  confidence?: unknown;
}
interface RawDecision {
  text?: unknown;
}
interface RawRisk {
  text?: unknown;
  category?: unknown;
  ref?: unknown;
}
interface AnalysisResult {
  summary?: unknown;
  actionItems?: unknown;
  decisions?: unknown;
  risks?: unknown;
}

export interface MeetingAnalysisResponse {
  summary: string;
  updatedAt: string | null;
  actionItems: ActionItem[];
  decisions: Decision[];
  risks: Risk[];
}

/**
 * Incremental meeting-analysis engine (Feature Group 5 — MC-010..MC-013).
 *
 * Each cycle feeds the rolling summary plus only the transcript segments newer
 * than the stored watermark to the model, which returns an updated summary and
 * any newly-detected action items, decisions, and risks. Results are deduped
 * and persisted, so the analysis survives after the meeting ends.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly providerName?: string;
  private readonly model?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly config: ConfigService,
  ) {
    // Fall back to the app-wide default AI provider/model when unset.
    this.providerName = this.config.get<string>('AI_ANALYSIS_PROVIDER') || undefined;
    this.model = this.config.get<string>('AI_ANALYSIS_MODEL') || undefined;
  }

  /** meetingIds that have transcript segments past their analysis watermark. */
  async findMeetingsWithPendingSegments(): Promise<string[]> {
    const groups = await this.prisma.transcriptSegment.groupBy({
      by: ['meetingId'],
      _max: { endMs: true },
    });
    if (groups.length === 0) return [];

    const analyses = await this.prisma.meetingAnalysis.findMany({
      select: { meetingId: true, processedUpToMs: true },
    });
    const watermark = new Map(analyses.map((a) => [a.meetingId, a.processedUpToMs]));

    return groups
      .filter((g) => (g._max.endMs ?? 0) > (watermark.get(g.meetingId) ?? -1))
      .map((g) => g.meetingId);
  }

  /**
   * Run one incremental analysis cycle for a meeting. Safe to call repeatedly;
   * a no-op when there are no new segments past the watermark.
   */
  async processMeeting(meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, userId: true },
    });
    if (!meeting) return;

    const analysis = await this.prisma.meetingAnalysis.upsert({
      where: { meetingId },
      create: { meetingId },
      update: {},
    });

    const newSegments = await this.prisma.transcriptSegment.findMany({
      where: { meetingId, endMs: { gt: analysis.processedUpToMs } },
      orderBy: { startMs: 'asc' },
      take: MAX_SEGMENTS_PER_CYCLE,
    });
    if (newSegments.length === 0) return;

    const [existingActions, existingDecisions, existingRisks] = await Promise.all([
      this.prisma.actionItem.findMany({ where: { meetingId }, select: { task: true } }),
      this.prisma.decision.findMany({ where: { meetingId }, select: { text: true } }),
      this.prisma.risk.findMany({ where: { meetingId }, select: { text: true } }),
    ]);

    const messages = this.buildMessages(analysis.summary, newSegments, {
      actions: existingActions.map((a) => a.task),
      decisions: existingDecisions.map((d) => d.text),
      risks: existingRisks.map((r) => r.text),
    });

    let parsed: AnalysisResult | null = null;
    try {
      const result = await this.ai.chat(messages, {
        providerName: this.providerName,
        model: this.model,
        maxTokens: 2048,
        temperature: 0,
        userId: meeting.userId,
      });
      parsed = this.parseJson(result.content);
    } catch (err) {
      this.logger.error(`Analysis call failed for meeting ${meetingId}: ${String(err)}`);
      return; // leave watermark untouched so the chunk is retried next cycle
    }
    if (!parsed) {
      this.logger.warn(`Unparseable analysis output for meeting ${meetingId}`);
      return;
    }

    const processedUpToMs = newSegments.reduce((max, s) => Math.max(max, s.endMs), analysis.processedUpToMs);
    const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : analysis.summary;

    await this.prisma.meetingAnalysis.update({
      where: { meetingId },
      data: {
        summary,
        processedUpToMs,
        segmentsSeen: analysis.segmentsSeen + newSegments.length,
      },
    });

    await this.persistActionItems(meetingId, parsed.actionItems);
    await this.persistDecisions(meetingId, parsed.decisions);
    await this.persistRisks(meetingId, parsed.risks);
  }

  async getAnalysis(userId: string, meetingId: string): Promise<MeetingAnalysisResponse> {
    await this.assertOwnership(userId, meetingId);

    const [analysis, actionItems, decisions, risks] = await Promise.all([
      this.prisma.meetingAnalysis.findUnique({ where: { meetingId } }),
      this.prisma.actionItem.findMany({ where: { meetingId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.decision.findMany({ where: { meetingId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.risk.findMany({ where: { meetingId }, orderBy: { createdAt: 'asc' } }),
    ]);

    return {
      summary: analysis?.summary ?? '',
      updatedAt: analysis?.updatedAt.toISOString() ?? null,
      actionItems,
      decisions,
      risks,
    };
  }

  async updateActionItem(
    userId: string,
    meetingId: string,
    itemId: string,
    dto: UpdateActionItemDto,
  ): Promise<ActionItem> {
    await this.assertOwnership(userId, meetingId);

    const existing = await this.prisma.actionItem.findFirst({ where: { id: itemId, meetingId } });
    if (!existing) throw new NotFoundException('Action item not found');

    return this.prisma.actionItem.update({
      where: { id: itemId },
      data: {
        task: dto.task ?? undefined,
        assignee: dto.assignee === undefined ? undefined : dto.assignee,
        status: dto.status ?? undefined,
        // Keep dedupeKey aligned with the (possibly edited) task text.
        dedupeKey: dto.task ? this.normalizeKey(dto.task) : undefined,
      },
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

  private buildMessages(
    previousSummary: string,
    segments: TranscriptSegment[],
    existing: { actions: string[]; decisions: string[]; risks: string[] },
  ): ChatMessage[] {
    const excerpt = segments.map((s) => this.formatSegment(s)).join('\n');

    const system = [
      'You are a meeting-analysis assistant. You are given the rolling summary so',
      'far and a NEW excerpt of the live transcript. Update the analysis incrementally.',
      '',
      'Respond with STRICT JSON ONLY (no markdown, no prose) matching this shape:',
      '{',
      '  "summary": string,            // concise cumulative summary of the WHOLE meeting so far (a few sentences)',
      '  "actionItems": [ { "task": string, "assignee": string|null, "confidence": number } ],',
      '  "decisions": [ { "text": string } ],',
      '  "risks": [ { "text": string, "category": "risk"|"blocker"|"dependency", "ref": string|null } ]',
      '}',
      '',
      'Rules:',
      '- "summary" must reflect the entire meeting (merge the previous summary with the new excerpt), not just the excerpt.',
      '- actionItems/decisions/risks must contain ONLY items newly evidenced in the NEW excerpt.',
      '- Do NOT repeat anything already present in the EXISTING lists provided below.',
      '- "assignee" is the owner if one is clearly named, otherwise null.',
      '- "confidence" is 0..1 for how clearly the task and owner were stated.',
      '- "ref" is the [m:ss] timestamp of the supporting transcript line, or null.',
      '- If nothing new of a kind was found, return an empty array for it.',
    ].join('\n');

    const user = [
      'PREVIOUS SUMMARY:',
      previousSummary.trim() || '(none yet)',
      '',
      'EXISTING ACTION ITEMS:',
      this.formatHints(existing.actions),
      '',
      'EXISTING DECISIONS:',
      this.formatHints(existing.decisions),
      '',
      'EXISTING RISKS:',
      this.formatHints(existing.risks),
      '',
      'NEW TRANSCRIPT EXCERPT:',
      excerpt,
    ].join('\n');

    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
  }

  private formatSegment(s: TranscriptSegment): string {
    const speaker = s.speaker === null ? '?' : String(s.speaker + 1);
    return `[${this.formatMs(s.startMs)}] S${speaker}: ${s.text}`;
  }

  private formatHints(items: string[]): string {
    if (items.length === 0) return '(none)';
    return items.slice(-MAX_EXISTING_HINTS).map((t) => `- ${t}`).join('\n');
  }

  private formatMs(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  private parseMsRef(ref: unknown): number | null {
    if (typeof ref !== 'string') return null;
    const match = ref.match(/(\d+):(\d{1,2})/);
    if (!match) return null;
    return (Number(match[1]) * 60 + Number(match[2])) * 1000;
  }

  /** Lower-cased, punctuation-stripped key used to dedupe near-identical items. */
  private normalizeKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
  }

  /** Tolerant JSON extraction — strips code fences and isolates the JSON object. */
  private parseJson(content: string): AnalysisResult | null {
    const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as AnalysisResult;
    } catch {
      return null;
    }
  }

  private async persistActionItems(meetingId: string, raw: unknown): Promise<void> {
    if (!Array.isArray(raw)) return;

    const existing = await this.prisma.actionItem.findMany({
      where: { meetingId },
      select: { dedupeKey: true },
    });
    const seen = new Set(existing.map((a) => a.dedupeKey));

    const rows: { meetingId: string; task: string; assignee: string | null; confidence: number; dedupeKey: string }[] = [];
    for (const item of raw as RawActionItem[]) {
      const task = typeof item.task === 'string' ? item.task.trim() : '';
      if (!task) continue;
      const key = this.normalizeKey(task);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        meetingId,
        task,
        assignee: typeof item.assignee === 'string' && item.assignee.trim() ? item.assignee.trim() : null,
        confidence: this.clampConfidence(item.confidence),
        dedupeKey: key,
      });
    }
    if (rows.length > 0) {
      await this.prisma.actionItem.createMany({ data: rows, skipDuplicates: true });
    }
  }

  private async persistDecisions(meetingId: string, raw: unknown): Promise<void> {
    if (!Array.isArray(raw)) return;

    const rows: { meetingId: string; text: string; dedupeKey: string }[] = [];
    const seen = new Set<string>();
    for (const item of raw as RawDecision[]) {
      const text = typeof item.text === 'string' ? item.text.trim() : '';
      if (!text) continue;
      const key = this.normalizeKey(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({ meetingId, text, dedupeKey: key });
    }
    if (rows.length > 0) {
      await this.prisma.decision.createMany({ data: rows, skipDuplicates: true });
    }
  }

  private async persistRisks(meetingId: string, raw: unknown): Promise<void> {
    if (!Array.isArray(raw)) return;

    const rows: { meetingId: string; text: string; category: RiskCategory; transcriptRefMs: number | null; dedupeKey: string }[] = [];
    const seen = new Set<string>();
    for (const item of raw as RawRisk[]) {
      const text = typeof item.text === 'string' ? item.text.trim() : '';
      if (!text) continue;
      const key = this.normalizeKey(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        meetingId,
        text,
        category: this.normalizeCategory(item.category),
        transcriptRefMs: this.parseMsRef(item.ref),
        dedupeKey: key,
      });
    }
    if (rows.length > 0) {
      await this.prisma.risk.createMany({ data: rows, skipDuplicates: true });
    }
  }

  private clampConfidence(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  private normalizeCategory(value: unknown): RiskCategory {
    const v = typeof value === 'string' ? value.toLowerCase().trim() : '';
    return (RISK_CATEGORIES as readonly string[]).includes(v) ? (v as RiskCategory) : 'risk';
  }
}
