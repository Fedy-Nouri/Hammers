import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// PrismaService is provided by the @Global() PrismaModule, so no imports are needed.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
