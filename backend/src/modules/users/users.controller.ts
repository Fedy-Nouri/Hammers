import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: ActiveUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile info' })
  updateMe(@CurrentUser() user: ActiveUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.update(user.userId, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload profile avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      fileFilter: (_, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: ActiveUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.usersService.uploadAvatar(user.userId, file);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  deleteAccount(@CurrentUser() user: ActiveUser): Promise<void> {
    return this.usersService.deleteAccount(user.userId);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  changePassword(
    @CurrentUser() user: ActiveUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
