import { Body, CanActivate, Controller, Delete, ExecutionContext, Get, HttpCode, Injectable, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AuthGuard } from '../auth/auth.guard';
import { PageDto } from '../auth/auth.dto';
import { ApiRequest } from '../common/http';
import { AdminGuard, AdminRequest, RequirePermission } from '../commerce/admin-auth';
import { Actor } from '../commerce/transaction';
import { VersionDto, VersionQueryDto } from '../commerce/commerce.dto';
import { ContentService } from './content.service';
import { ContentMediaService } from './media.service';
import * as D from './content.dto';

const uuid = new ParseUUIDPipe({ version: '4' });
const admin = (r: AdminRequest): Actor => ({ kind: 'admin', principal: r.admin, permission: 'content:write' });
@Injectable()
export class OptionalUserGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<ApiRequest>();
    if (req.headers.authorization !== undefined) req.principal = await this.auth.authenticate(req.headers.authorization);
    return true;
  }
}
@Controller()
@UseGuards(OptionalUserGuard)
export class ContentController {
  constructor(private readonly content: ContentService, private readonly media: ContentMediaService) {}
  @Get('articles') articles(@Query() q: D.ContentQueryDto) { return this.content.list(q, ['SCIENCE_ARTICLE', 'ARTICLE_COURSE']); }
  @Get('videos') videos(@Query() q: D.ContentQueryDto) { return this.content.list(q, ['SCIENCE_VIDEO', 'VIDEO_COURSE']); }
  @Get('articles/:id') article(@Param('id', uuid) id: string, @Req() r: ApiRequest) { return this.content.get(id, ['SCIENCE_ARTICLE', 'ARTICLE_COURSE'], r.principal); }
  @Get('videos/:id') video(@Param('id', uuid) id: string, @Req() r: ApiRequest) { return this.content.get(id, ['SCIENCE_VIDEO', 'VIDEO_COURSE'], r.principal); }
  @Get('articles/:id/body') body(@Param('id', uuid) id: string, @Req() r: ApiRequest) { return this.content.body(id, false, r.principal); }
  @Get('videos/:id/playback') playback(@Param('id', uuid) id: string, @Req() r: ApiRequest) { return this.media.grant(id, false, r.principal); }
  @Get('courses/:id/chapters') chapters(@Param('id', uuid) id: string, @Query() q: PageDto, @Req() r: ApiRequest) { return this.content.chapters(id, q, r.principal); }
  @Get('chapters/:id/body') chapterBody(@Param('id', uuid) id: string, @Req() r: ApiRequest) { return this.content.body(id, true, r.principal); }
  @Get('chapters/:id/playback') chapterPlayback(@Param('id', uuid) id: string, @Req() r: ApiRequest) { return this.media.grant(id, true, r.principal); }
  @Get('columns') columns(@Query() q: D.ColumnQueryDto) { return this.content.columns(q); }
  @Get('columns/:id') column(@Param('id', uuid) id: string) { return this.content.column(id); }
  @Get('columns/:id/contents') columnContents(@Param('id', uuid) id: string, @Query() q: D.ContentQueryDto) { return this.content.list(q, undefined, false, id); }
  @Get('me/courses') @UseGuards(AuthGuard) purchased(@Req() r: ApiRequest, @Query() q: D.PurchasedQueryDto) { return this.content.purchasedCourses(r.principal!.user.id, q); }
}
@Controller('content-playback')
export class ContentPlaybackController {
  constructor(private readonly media: ContentMediaService) {}
  @Get(':id') stream(@Param('id', uuid) id: string, @Query() q: D.PlaybackQueryDto, @Req() r: ApiRequest, @Res() res: Response) { return this.media.stream(id, q.token, r, res); }
}
@Controller('admin')
@UseGuards(AdminGuard)
@RequirePermission('content:write')
export class AdminContentController {
  constructor(private readonly content: ContentService, private readonly media: ContentMediaService) {}
  @Post('content-media/images') image(@Req() r: AdminRequest, @Body() d: D.ContentImageDto) { return this.media.image(admin(r), d); }
  @Post('content-media/videos') upload(@Req() r: AdminRequest, @Query() q: D.VideoUploadQueryDto) { return this.media.upload(admin(r), r, q.durationSeconds); }
  @Post('content-media/external-videos') external(@Req() r: AdminRequest, @Body() d: D.ExternalVideoDto) { return this.media.externalVideo(admin(r), d); }
  @Get('contents') list(@Query() q: D.AdminContentQueryDto) { return this.content.list(q, undefined, true); }
  @Post('contents') create(@Req() r: AdminRequest, @Body() d: D.ContentCreateDto) { return this.content.create(admin(r), d); }
  @Get('contents/:id') get(@Param('id', uuid) id: string) { return this.content.get(id, undefined, undefined, true); }
  @Patch('contents/:id') patch(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.ContentPatchDto) { return this.content.patch(admin(r), id, d); }
  @Delete('contents/:id') delete(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Query() q: VersionQueryDto) { return this.content.delete(admin(r), id, q.version); }
  @Post('contents/:id/publish') @HttpCode(200) publish(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: VersionDto) { return this.content.publish(admin(r), id, d.version, 'PUBLISHED'); }
  @Post('contents/:id/unpublish') @HttpCode(200) unpublish(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: VersionDto) { return this.content.publish(admin(r), id, d.version, 'OFFLINE'); }
  @Get('contents/:id/body') body(@Param('id', uuid) id: string) { return this.content.adminBody(id, false); }
  @Put('contents/:id/body') saveBody(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.BodyDto) { return this.content.saveBody(admin(r), id, d, false); }
  @Get('contents/:id/playback') preview(@Req() r: AdminRequest, @Param('id', uuid) id: string) { return this.media.grant(id, false, undefined, admin(r)); }
  @Get('courses/:id/chapters') chapters(@Param('id', uuid) id: string, @Query() q: D.ChapterQueryDto) { return this.content.chapters(id, q, undefined, true); }
  @Post('courses/:id/chapters') createChapter(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.ChapterCreateDto) { return this.content.createChapter(admin(r), id, d); }
  @Get('chapters/:id') chapter(@Param('id', uuid) id: string) { return this.content.chapter(id); }
  @Patch('chapters/:id') patchChapter(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.ChapterPatchDto) { return this.content.patchChapter(admin(r), id, d); }
  @Delete('chapters/:id') deleteChapter(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Query() q: VersionQueryDto) { return this.content.deleteChapter(admin(r), id, q.version); }
  @Post('chapters/:id/publish') @HttpCode(200) publishChapter(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: VersionDto) { return this.content.publishChapter(admin(r), id, d.version, 'PUBLISHED'); }
  @Post('chapters/:id/unpublish') @HttpCode(200) unpublishChapter(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: VersionDto) { return this.content.publishChapter(admin(r), id, d.version, 'OFFLINE'); }
  @Get('chapters/:id/body') chapterBody(@Param('id', uuid) id: string) { return this.content.adminBody(id, true); }
  @Put('chapters/:id/body') saveChapterBody(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.BodyDto) { return this.content.saveBody(admin(r), id, d, true); }
  @Get('chapters/:id/playback') previewChapter(@Req() r: AdminRequest, @Param('id', uuid) id: string) { return this.media.grant(id, true, undefined, admin(r)); }
  @Get('columns') columns(@Query() q: D.AdminColumnQueryDto) { return this.content.columns(q, true); }
  @Get('columns/:id') column(@Param('id', uuid) id: string) { return this.content.column(id, true); }
  @Post('columns') createColumn(@Req() r: AdminRequest, @Body() d: D.ColumnCreateDto) { return this.content.saveColumn(admin(r), d); }
  @Patch('columns/:id') patchColumn(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: D.ColumnPatchDto) { return this.content.saveColumn(admin(r), d, id); }
  @Delete('columns/:id') deleteColumn(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Query() q: VersionQueryDto) { return this.content.deleteColumn(admin(r), id, q.version); }
  @Post('columns/:id/publish') @HttpCode(200) publishColumn(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: VersionDto) { return this.content.publishColumn(admin(r), id, d.version, 'PUBLISHED'); }
  @Post('columns/:id/unpublish') @HttpCode(200) unpublishColumn(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Body() d: VersionDto) { return this.content.publishColumn(admin(r), id, d.version, 'OFFLINE'); }
  @Get('columns/:id/contents') columnContents(@Param('id', uuid) id: string, @Query() q: D.AdminContentQueryDto) { return this.content.list(q, undefined, true, id); }
  @Put('columns/:id/contents/:contentId') link(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Param('contentId', uuid) cid: string, @Body() d: D.ColumnLinkDto) { return this.content.link(admin(r), id, cid, d); }
  @Delete('columns/:id/contents/:contentId') unlink(@Req() r: AdminRequest, @Param('id', uuid) id: string, @Param('contentId', uuid) cid: string) { return this.content.link(admin(r), id, cid); }
}
