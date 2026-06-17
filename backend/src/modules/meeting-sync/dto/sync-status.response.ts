import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncStatusResponse {
  @ApiProperty() syncing: boolean;
  @ApiPropertyOptional({ nullable: true }) lastSyncedAt: Date | null;
}
