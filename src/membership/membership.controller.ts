import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiRequest } from '../common/http';
import { AdminGuard, AdminRequest, RequirePermission } from '../commerce/admin-auth';
import { Actor } from '../commerce/transaction';
import { MembershipRevokeDto, MembershipSaveDto } from './membership.dto';
import { MembershipService } from './membership.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const admin = (r: AdminRequest): Actor => ({ kind: 'admin', principal: r.admin, permission: 'membership:write' });

@Controller('me/membership')
@UseGuards(AuthGuard)
export class MembershipController {
  constructor(private readonly membership: MembershipService) {}
  @Get() get(@Req() r: ApiRequest) { return this.membership.mine(r.principal!.user.id); }
}

@Controller('admin/users')
@UseGuards(AdminGuard)
@RequirePermission('membership:write')
export class AdminMembershipController {
  constructor(private readonly membership: MembershipService) {}
  @Get(':id/membership') get(@Req() r: AdminRequest, @Param('id', uuid) id: string) { return this.membership.get(admin(r), id); }
  @Put(':id/membership') save(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() dto: MembershipSaveDto) { return this.membership.save(admin(r), id, dto); }
  @Post(':id/membership/revoke') @HttpCode(200)
  revoke(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() dto: MembershipRevokeDto) { return this.membership.revoke(admin(r), id, dto); }
}
