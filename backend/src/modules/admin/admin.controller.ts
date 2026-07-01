import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService, type AdminUserRow, type PaginatedUsers } from './admin.service';
import { ListUsersQuery } from './dto/list-users.query';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users with plan/status/usage (admin only)' })
  listUsers(@Query() query: ListUsersQuery): Promise<PaginatedUsers> {
    return this.admin.listUsers(query.page, query.limit);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: "Change a user's role (admin only)" })
  setRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto): Promise<AdminUserRow> {
    return this.admin.setRole(id, dto.role);
  }
}
