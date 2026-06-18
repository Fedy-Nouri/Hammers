import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AnalysisService } from './analysis.service';

/** How often the rolling analysis runs (MC-010: "updates every few minutes"). */
const ANALYSIS_INTERVAL_MS = 120_000;

/**
 * Drives the incremental analysis on a fixed cadence. Cycles never overlap:
 * if a run is still in flight when the next tick fires, the tick is skipped.
 */
@Injectable()
export class AnalysisScheduler {
  private readonly logger = new Logger(AnalysisScheduler.name);
  private running = false;

  constructor(private readonly analysis: AnalysisService) {}

  @Interval(ANALYSIS_INTERVAL_MS)
  async runCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const meetingIds = await this.analysis.findMeetingsWithPendingSegments();
      for (const meetingId of meetingIds) {
        try {
          await this.analysis.processMeeting(meetingId);
        } catch (err) {
          this.logger.error(`Failed to analyze meeting ${meetingId}: ${String(err)}`);
        }
      }
    } catch (err) {
      this.logger.error(`Analysis cycle failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
