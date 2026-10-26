import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PageDto } from '../auth/auth.dto';
import { ApiRequest } from '../common/http';
import { AdminGuard, AdminRequest, RequirePermission } from '../commerce/admin-auth';
import { Actor } from '../commerce/transaction';
import { AdminMembershipPlanQueryDto, MembershipPlanCreateDto, MembershipPlanPatchDto, MembershipPlanQueryDto, MembershipRevokeDto, MembershipSaveDto } from './membership.dto';
import { MembershipService } from './membership.service';
import { MembershipPlansService } from './membership-plans.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const admin = (r: AdminRequest): Actor => ({ kind: 'admin', principal: r.admin, permission: 'membership:write' });

@Controller('me/membership')
@UseGuards(AuthGuard)
export class MembershipController {
  constructor(private readonly membership: MembershipService) {}
  @Get() get(@Req() r: ApiRequest) { return this.membership.mine(r.principal!.user.id); }
  @Get('periods') periods(@Req() r: ApiRequest, @Query() q: PageDto) { return this.membership.myPeriods(r.principal!.user.id, q); }
}

@Controller('admin/users')
@UseGuards(AdminGuard)
@RequirePermission('membership:write')
export class AdminMembershipController {
  constructor(private readonly membership: MembershipService) {}
  @Get(':id/membership') get(@Req() r: AdminRequest, @Param('id', uuid) id: string) { return this.membership.get(admin(r), id); }
  @Get(':id/membership/periods') periods(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Query() q: PageDto) { return this.membership.periods(admin(r), id, q); }
  @Put(':id/membership') save(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() dto: MembershipSaveDto) { return this.membership.save(admin(r), id, dto); }
  @Post(':id/membership/revoke') @HttpCode(200)
  revoke(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() dto: MembershipRevokeDto) { return this.membership.revoke(admin(r), id, dto); }
}

@Controller('membership-plans')
export class MembershipPlansController {
  constructor(private readonly plans: MembershipPlansService) {}
  @Get() list(@Query() q: MembershipPlanQueryDto) { return this.plans.list(q); }
  @Get(':id') get(@Param('id', uuid) id: string) { return this.plans.get(id); }
}

@Controller('admin/membership-plans')
@UseGuards(AdminGuard)
@RequirePermission('membership:write')
export class AdminMembershipPlansController {
  constructor(private readonly plans: MembershipPlansService) {}
  @Get() list(@Req() r: AdminRequest, @Query() q: AdminMembershipPlanQueryDto) { return this.plans.adminList(admin(r), q); }
  @Post() create(@Req() r: AdminRequest, @Body() dto: MembershipPlanCreateDto) { return this.plans.create(admin(r), dto); }
  @Get(':id') get(@Req() r: AdminRequest, @Param('id', uuid) id: string) { return this.plans.adminGet(admin(r), id); }
  @Patch(':id') patch(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() dto: MembershipPlanPatchDto) { return this.plans.patch(admin(r), id, dto); }
}
