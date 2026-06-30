import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentResponse {
  @ApiProperty({ example: 'travel-agent' })
  id: string;

  @ApiProperty({ example: 'Travel Planner' })
  name: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ enum: ['free', 'pro', 'enterprise'], example: 'free' })
  minPlan: string;

  @ApiProperty({ example: {} })
  configuration: unknown;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
