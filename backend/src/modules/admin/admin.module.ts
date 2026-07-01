import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Operator console (AD). PrismaService is global; RolesGuard needs only Reflector. */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
