import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateEmailDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  body?: string;
}
