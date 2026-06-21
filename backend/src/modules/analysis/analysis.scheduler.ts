import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AnalysisService } from './analysis.service';
import { RedisLockService } from '../../infrastructure/redis/redis-lock.service';

/** How often the rolling analysis runs (MC-010: "updates every few minutes"). */
const ANALYSIS_INTERVAL_MS = 120_000;
const LOCK_KEY = 'lock:analysis-cycle';
const LOCK_TTL_MS = 110_000; // shorter than the interval

/**
 * Drives the incremental analysis on a fixed cadence. Cycles never overlap
 * in-process (the `running` flag); across replicas only the lock holder runs.
 */
@Injectable()
export class AnalysisScheduler {
  private readonly logger = new Logger(AnalysisScheduler.name);
  private running = false;

  constructor(
    private readonly analysis: AnalysisService,
    private readonly lock: RedisLockService,
  ) {}

  @Interval(ANALYSIS_INTERVAL_MS)
  async runCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.lock.withLock(LOCK_KEY, LOCK_TTL_MS, async () => {
        const meetingIds = await this.analysis.findMeetingsWithPendingSegments();
        for (const meetingId of meetingIds) {
          try {
            await this.analysis.processMeeting(meetingId);
          } catch (err) {
            this.logger.error(`Failed to analyze meeting ${meetingId}: ${String(err)}`);
          }
        }
      });
    } catch (err) {
      this.logger.error(`Analysis cycle failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
