import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { extname } from 'path';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  subscriptionPlan: string;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  private blobService: BlobServiceClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private toProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      subscriptionPlan: user.subscriptionPlan,
      createdAt: user.createdAt,
    };
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async getProfile(id: string): Promise<UserProfile> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toProfile(user);
  }

  async update(
    id: string,
    data: Partial<{ firstName: string; lastName: string; email: string; avatarUrl: string }>,
  ): Promise<UserProfile> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return this.toProfile(user);
  }

  async uploadAvatar(id: string, file: Express.Multer.File): Promise<UserProfile> {
    const container = this.getAvatarContainer();
    await container.createIfNotExists({ access: 'blob' });
    const blobName = `${id}/${Date.now()}${extname(file.originalname)}`;
    const blob = container.getBlockBlobClient(blobName);
    await blob.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });
    return this.update(id, { avatarUrl: blob.url });
  }

  private getAvatarContainer(): ContainerClient {
    const connectionString = this.config.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    if (!connectionString) {
      throw new ServiceUnavailableException('Avatar storage is not configured');
    }
    if (!this.blobService) {
      this.blobService = BlobServiceClient.fromConnectionString(connectionString);
    }
    const containerName = this.config.get<string>('AZURE_AVATAR_CONTAINER') ?? 'avatars';
    return this.blobService.getContainerClient(containerName);
  }

  async deleteAccount(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { message: 'Password changed successfully' };
  }
}
