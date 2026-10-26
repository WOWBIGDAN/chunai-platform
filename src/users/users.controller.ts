import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiRequest } from '../common/http';
import { AdminGuard, AdminRequest, RequirePermission } from '../commerce/admin-auth';
import { Actor } from '../commerce/transaction';
import { AdminUserQueryDto, UserModerationDto, UserPatchDto } from './users.dto';
import { UsersService } from './users.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const admin = (r: AdminRequest, permission: 'users:read' | 'users:ban'): Actor => ({ kind: 'admin', principal: r.admin, permission });

@Controller('me')
@UseGuards(AuthGuard)
export class UserProfileController {
  constructor(private readonly users: UsersService) {}
  @Patch()
  patch(@Req() r: ApiRequest, @Body() dto: UserPatchDto) { return this.users.patch({ kind: 'user', principal: r.principal! }, dto); }
}

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}
  @Get() @RequirePermission('users:read')
  list(@Req() r: AdminRequest, @Query() q: AdminUserQueryDto) { return this.users.list(admin(r, 'users:read'), q); }
  @Get(':id') @RequirePermission('users:read')
  detail(@Req() r: AdminRequest, @Param('id', uuid) id: string) { return this.users.get(admin(r, 'users:read'), id); }
  @Post(':id/ban') @HttpCode(200) @RequirePermission('users:ban')
  ban(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() dto: UserModerationDto, @Headers('idempotency-key') key?: string) {
    return this.users.moderate(admin(r, 'users:ban'), id, true, dto, key);
  }
  @Post(':id/unban') @HttpCode(200) @RequirePermission('users:ban')
  unban(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() dto: UserModerationDto, @Headers('idempotency-key') key?: string) {
    return this.users.moderate(admin(r, 'users:ban'), id, false, dto, key);
  }
}
