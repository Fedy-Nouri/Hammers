import { ApiProperty } from '@nestjs/swagger';

export class GoogleConnectResponse {
  @ApiProperty()
  authUrl: string;
}

export class GoogleStatusResponse {
  @ApiProperty()
  connected: boolean;

  @ApiProperty({ required: false })
  email?: string;
}