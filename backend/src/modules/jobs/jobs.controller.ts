import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JobsService } from './jobs.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { IngestJobDto } from './dto/ingest-job.dto';
import { ListApplicationsQuery } from './dto/list-applications.query';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get the current user job profile (resume + preferences)' })
  getProfile(@CurrentUser() user: ActiveUser) {
    return this.jobsService.getProfile(user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update job-search preferences' })
  updateProfile(
    @CurrentUser() user: ActiveUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.jobsService.updatePreferences(user.userId, dto);
  }

  @Post('resume')
  @ApiOperation({ summary: 'Upload a resume PDF (text is extracted for AI scoring)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { resume: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('resume', {
      storage: memoryStorage(),
      fileFilter: (_, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadResume(
    @CurrentUser() user: ActiveUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.jobsService.uploadResume(user.userId, file);
  }

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest a job and score it against the resume' })
  ingest(@CurrentUser() user: ActiveUser, @Body() dto: IngestJobDto) {
    return this.jobsService.ingest(user.userId, dto);
  }

  @Get('applications')
  @ApiOperation({ summary: 'List tracked job applications (optionally by status)' })
  listApplications(
    @CurrentUser() user: ActiveUser,
    @Query() query: ListApplicationsQuery,
  ) {
    return this.jobsService.listApplications(user.userId, query.status);
  }
}
