import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MeetingResponse {
  @ApiProperty() id: string;
  @ApiProperty() googleEventId: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description: string | null;
  @ApiPropertyOptional() location: string | null;
  @ApiProperty() startTime: Date;
  @ApiProperty() endTime: Date;
  @ApiPropertyOptional() meetLink: string | null;
  @ApiProperty({ type: [String] }) attendees: string[];
  @ApiPropertyOptional() htmlLink: string | null;
  @ApiProperty() status: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
