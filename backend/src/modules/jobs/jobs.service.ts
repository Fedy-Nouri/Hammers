import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { PDFParse } from 'pdf-parse';
import { JobApplication, JobProfile } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { IngestJobDto } from './dto/ingest-job.dto';
import { JOB_AGENT_ID, JobStatus } from './jobs.constants';

// Cap stored resume text so AI prompts stay within a sane token budget.
const MAX_RESUME_CHARS = 8000;

interface ScoreResult {
  score: number | null;
  summary: string;
  strengths: string[];
  gaps: string[];
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private blobService: BlobServiceClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ai: AiService,
  ) {}

  getProfile(userId: string): Promise<JobProfile | null> {
    return this.prisma.jobProfile.findUnique({ where: { userId } });
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<JobProfile> {
    return this.prisma.jobProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  async uploadResume(
    userId: string,
    file: Express.Multer.File,
  ): Promise<JobProfile> {
    const resumeText = await this.extractText(file.buffer);
    const resumeUrl = await this.storeResume(userId, file);
    return this.prisma.jobProfile.upsert({
      where: { userId },
      create: { userId, resumeUrl, resumeText },
      update: { resumeUrl, resumeText },
    });
  }

  listApplications(userId: string, status?: JobStatus): Promise<JobApplication[]> {
    return this.prisma.jobApplication.findMany({
      where: { userId, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Create a tracked job and score it against the user's resume on the spot. */
  async ingest(userId: string, dto: IngestJobDto): Promise<JobApplication> {
    const profile = await this.prisma.jobProfile.findUnique({ where: { userId } });
    if (!profile?.resumeText) {
      throw new BadRequestException('Upload a resume before ingesting jobs');
    }

    const application = await this.prisma.jobApplication.create({
      data: {
        userId,
        source: 'manual',
        url: dto.url,
        title: dto.title,
        company: dto.company,
        location: dto.location,
        description: dto.description,
      },
    });

    const score = await this.scoreApplication(application, profile.resumeText, userId);
    return this.prisma.jobApplication.update({
      where: { id: application.id },
      data: {
        matchScore: score.score,
        matchSummary: score.summary,
        strengths: score.strengths,
        gaps: score.gaps,
      },
    });
  }

  /** Ask the AI to rate resume↔job fit. Failures degrade to an unscored row. */
  private async scoreApplication(
    job: JobApplication,
    resumeText: string,
    userId: string,
  ): Promise<ScoreResult> {
    const system =
      'You are an expert technical recruiter. Compare a candidate resume to a job. ' +
      'Respond with ONLY minified JSON of the form ' +
      '{"score": <integer 0-100>, "summary": "<2-3 sentence fit assessment>", ' +
      '"strengths": ["..."], "gaps": ["..."]}. No markdown, no text outside the JSON.';
    const user =
      `RESUME:\n${resumeText}\n\n` +
      `JOB:\nTitle: ${job.title}\nCompany: ${job.company}\n` +
      `Location: ${job.location ?? 'n/a'}\n\nDescription:\n${job.description}`;

    try {
      const result = await this.ai.chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        { temperature: 0, maxTokens: 700, userId, agentId: JOB_AGENT_ID },
      );
      return this.parseScore(result.content);
    } catch (err) {
      this.logger.error(`Scoring failed for job ${job.id}: ${String(err)}`);
      return { score: null, summary: 'Automatic scoring failed.', strengths: [], gaps: [] };
    }
  }

  private parseScore(content: string): ScoreResult {
    try {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('no JSON object found');
      const parsed = JSON.parse(content.slice(start, end + 1)) as {
        score?: unknown;
        summary?: unknown;
        strengths?: unknown;
        gaps?: unknown;
      };
      const rawScore = Number(parsed.score);
      return {
        score: Number.isFinite(rawScore)
          ? Math.min(100, Math.max(0, Math.round(rawScore)))
          : null,
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        strengths: this.toStringArray(parsed.strengths),
        gaps: this.toStringArray(parsed.gaps),
      };
    } catch (err) {
      this.logger.warn(`Could not parse AI score response: ${String(err)}`);
      return { score: null, summary: 'Could not parse the scoring response.', strengths: [], gaps: [] };
    }
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  }

  private async extractText(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text.trim().slice(0, MAX_RESUME_CHARS);
    } finally {
      await parser.destroy();
    }
  }

  private async storeResume(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const container = this.getResumeContainer();
    await container.createIfNotExists({ access: 'blob' });
    const blobName = `${userId}/${Date.now()}.pdf`;
    const blob = container.getBlockBlobClient(blobName);
    await blob.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });
    return blob.url;
  }

  private getResumeContainer(): ContainerClient {
    const connectionString = this.config.get<string>(
      'AZURE_STORAGE_CONNECTION_STRING',
    );
    if (!connectionString) {
      throw new ServiceUnavailableException('Resume storage is not configured');
    }
    if (!this.blobService) {
      this.blobService = BlobServiceClient.fromConnectionString(connectionString);
    }
    const containerName =
      this.config.get<string>('AZURE_RESUME_CONTAINER') ?? 'resumes';
    return this.blobService.getContainerClient(containerName);
  }
}
