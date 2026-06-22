import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { JobScrapeService } from './job-scrape.service';
import { BotJobsController } from './bot-jobs.controller';

@Module({
  imports: [JobsModule],
  controllers: [BotJobsController],
  providers: [JobScrapeService],
  exports: [JobScrapeService],
})
export class JobScrapeModule {}
