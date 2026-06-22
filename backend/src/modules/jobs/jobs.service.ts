import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { PDFParse } from 'pdf-parse';
import { JobProfile } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

// Cap stored resume text so AI prompts stay within a sane token budget.
const MAX_RESUME_CHARS = 8000;

@Injectable()
export class JobsService {
  private blobService: BlobServiceClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
