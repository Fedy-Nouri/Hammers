import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ enum: ['pro', 'enterprise'], description: 'Plan to subscribe to' })
  @IsIn(['pro', 'enterprise'])
  plan: 'pro' | 'enterprise';
}
