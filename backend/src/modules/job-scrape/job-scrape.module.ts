import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JobsModule } from '../jobs/jobs.module';
import { JobScrapeService } from './job-scrape.service';
import { JobBotRegistryService } from './job-bot-registry.service';
import { JobScrapeLauncherService } from './job-scrape-launcher.service';
import { JobScrapeScheduler } from './job-scrape.scheduler';
import { BotJobsController } from './bot-jobs.controller';
import { ScrapeRegistryController } from './scrape-registry.controller';
import { ScrapeCallbackController } from './scrape-callback.controller';
import { JobScrapeUserController } from './job-scrape-user.controller';

@Module({
  imports: [JobsModule, HttpModule],
  controllers: [
    BotJobsController,
    ScrapeRegistryController,
    ScrapeCallbackController,
    JobScrapeUserController,
  ],
  providers: [
    JobScrapeService,
    JobBotRegistryService,
    JobScrapeLauncherService,
    JobScrapeScheduler,
  ],
  exports: [JobScrapeService],
})
export class JobScrapeModule {}
