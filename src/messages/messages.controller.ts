import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiRequest } from '../common/http';
import { AdminGuard, AdminRequest, RequirePermission } from '../commerce/admin-auth';
import { Actor } from '../commerce/transaction';
import { AdminMessageDto, MessageListDto, MessagePollDto, MessagesReadAllDto, MessagesReadDto } from './messages.dto';
import { MessagesService } from './messages.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const user = (r: ApiRequest): Actor => ({ kind: 'user', principal: r.principal! });

@Controller('me/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}
  @Get('poll') @SetMetadata('auth:skip-activity', true)
  poll(@Req() r: ApiRequest, @Query() q: MessagePollDto) { return this.messages.poll(r.principal!.user.id, q.revision); }
  @Get() list(@Req() r: ApiRequest, @Query() q: MessageListDto) { return this.messages.list(r.principal!.user.id, q); }
  @Post('read') @HttpCode(200)
  read(@Req() r: ApiRequest, @Body() d: MessagesReadDto) { return this.messages.read(user(r), d.ids); }
  @Post('read-all') @HttpCode(200)
  readAll(@Req() r: ApiRequest, @Body() d: MessagesReadAllDto) { return this.messages.readAll(user(r), d.throughSequence); }
  @Get(':id') get(@Req() r: ApiRequest, @Param('id', uuid) id: string) { return this.messages.get(r.principal!.user.id, id); }
  @Delete(':id') remove(@Req() r: ApiRequest, @Param('id', uuid) id: string) { return this.messages.remove(user(r), id); }
}

@Controller('admin/messages')
@UseGuards(AdminGuard)
@RequirePermission('messages:write')
export class AdminMessagesController {
  constructor(private readonly messages: MessagesService) {}
  @Post()
  send(@Req() r: AdminRequest, @Body() d: AdminMessageDto, @Headers('idempotency-key') key?: string) {
    return this.messages.send({ kind: 'admin', principal: r.admin, permission: 'messages:write' }, d, key);
  }
}
