import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const ACTION_ITEM_STATUSES = ['open', 'done', 'dismissed'] as const;

export class UpdateActionItemDto {
  @ApiPropertyOptional({ description: 'Edited task text' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  task?: string;

  @ApiPropertyOptional({ description: 'Owner of the task; null to clear', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  assignee?: string | null;

  @ApiPropertyOptional({ enum: ACTION_ITEM_STATUSES })
  @IsOptional()
  @IsIn(ACTION_ITEM_STATUSES)
  status?: (typeof ACTION_ITEM_STATUSES)[number];
}
