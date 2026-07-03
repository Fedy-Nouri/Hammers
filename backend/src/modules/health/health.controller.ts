import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface LivenessResult {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

interface ReadinessResult {
  status: 'ok';
  db: 'up';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe — the process is up (no dependencies checked)' })
  liveness(): LivenessResult {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — verifies the database is reachable (503 if not)' })
  async readiness(): Promise<ReadinessResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // Signals orchestrators (compose/k8s) to hold traffic until the DB is back.
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return { status: 'ok', db: 'up' };
  }
}
