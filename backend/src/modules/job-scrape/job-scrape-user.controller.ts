import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JobScrapeLauncherService } from './job-scrape-launcher.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('jobs/scrape')
export class JobScrapeUserController {
  constructor(
    private readonly launcher: JobScrapeLauncherService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Trigger an on-demand job scrape ("Find jobs")' })
  async trigger(@CurrentUser() user: ActiveUser) {
    const job = await this.launcher.enqueue(user.userId, 'manual');
    await this.launcher.launch(job.id);
    return this.prisma.jobScrapeJob.findUnique({ where: { id: job.id } });
  }

  @Get('status')
  @ApiOperation({ summary: 'Latest scrape job status for the current user' })
  status(@CurrentUser() user: ActiveUser) {
    return this.prisma.jobScrapeJob.findFirst({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
