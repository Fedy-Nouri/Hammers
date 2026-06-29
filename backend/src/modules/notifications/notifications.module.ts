import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';

/**
 * Notifications & Email (NT). PrismaService and ConfigService are global, so no imports.
 * Exports NotificationsService so AuthModule/BillingModule/ReportingModule can send emails.
 */
@Module({
  providers: [EmailService, NotificationsService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
