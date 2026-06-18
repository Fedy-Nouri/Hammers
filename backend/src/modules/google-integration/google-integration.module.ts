import { Module } from '@nestjs/common';
import { GoogleIntegrationService } from './google-integration.service';
import { GoogleIntegrationController } from './google-integration.controller';

@Module({
  providers: [GoogleIntegrationService],
  controllers: [GoogleIntegrationController],
  exports: [GoogleIntegrationService],
})
export class GoogleIntegrationModule {}