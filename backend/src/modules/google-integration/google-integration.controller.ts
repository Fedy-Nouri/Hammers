import {
  Controller,
  Get,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { GoogleIntegrationService } from './google-integration.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';
import {
  GoogleConnectResponse,
  GoogleStatusResponse,
} from './dto/google-integration.response';

@ApiTags('google')
@Controller('google')
export class GoogleIntegrationController {
  constructor(private readonly googleService: GoogleIntegrationService) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Google OAuth authorization URL' })
  @ApiResponse({ status: 200, type: GoogleConnectResponse })
  connect(@CurrentUser() user: ActiveUser): GoogleConnectResponse {
    const authUrl = this.googleService.getAuthUrl(user.userId);
    return { authUrl };
  }

  @Get('callback')
  @ApiOperation({ summary: 'Google OAuth callback — called by Google after user consent' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUrl = await this.googleService.handleCallback(code, state);
    res.redirect(redirectUrl);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Google connection status for the current user' })
  @ApiResponse({ status: 200, type: GoogleStatusResponse })
  status(@CurrentUser() user: ActiveUser): Promise<GoogleStatusResponse> {
    return this.googleService.getStatus(user.userId);
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Google account' })
  @ApiResponse({ status: 204 })
  disconnect(@CurrentUser() user: ActiveUser): Promise<void> {
    return this.googleService.disconnect(user.userId);
  }
}
