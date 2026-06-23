import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { BotIngestJobsDto } from './dto/bot-ingest-jobs.dto';

@Injectable()
export class JobScrapeService {
  private readonly logger = new Logger(JobScrapeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  /**
   * Ingest scraped listings for a user: dedupe by (userId, url), score each against
   * the resume, and report how many new applications were created.
   */
  async ingestScraped(dto: BotIngestJobsDto): Promise<{ created: number }> {
    const profile = await this.prisma.jobProfile.findUnique({
      where: { userId: dto.userId },
    });
    const resumeText = profile?.resumeText ?? null;

    let created = 0;
    for (const job of dto.jobs) {
      if (job.url) {
        const dupe = await this.prisma.jobApplication.findFirst({
          where: { userId: dto.userId, url: job.url },
          select: { id: true },
        });
        if (dupe) continue;
      }
      await this.jobs.createAndScore(dto.userId, job, 'linkedin', resumeText);
      created++;
    }

    if (dto.scrapeJobId) {
      await this.prisma.jobScrapeJob
        .update({
          where: { id: dto.scrapeJobId },
          data: { found: { increment: created } },
        })
        .catch(() => undefined);
    }

    this.logger.log(`Ingested ${created} scraped job(s) for user ${dto.userId}`);
    return { created };
  }
}
