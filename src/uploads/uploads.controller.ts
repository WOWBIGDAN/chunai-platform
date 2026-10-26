import { Body, CanActivate, Controller, Delete, ExecutionContext, Get, HttpCode, Injectable, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AdminAuthService } from '../commerce/admin-auth';
import { ApiException, ApiRequest } from '../common/http';
import { EmptyUploadBody, UploadCreateDto } from './uploads.dto';
import { UploadPrincipal, UploadsService } from './uploads.service';
interface UploadRequest extends ApiRequest { uploadPrincipal: UploadPrincipal }
@Injectable()
export class UploadAuthGuard implements CanActivate {
  constructor(private readonly user: AuthService, private readonly admin: AdminAuthService, private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const r = context.switchToHttp().getRequest<UploadRequest>();
    const token = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(r.headers.authorization ?? '')?.[1];
    // The untrusted audience only selects the verifier; both paths validate signature, audience and live session.
    const audience = token ? this.jwt.decode(token)?.aud : undefined;
    if (audience === 'client') r.uploadPrincipal = { kind: 'user', principal: await this.user.authenticate(r.headers.authorization) };
    else if (audience === 'admin') r.uploadPrincipal = { kind: 'admin', principal: await this.admin.authenticate(r.headers.authorization) };
    else throw new ApiException(401, 'TOKEN_INVALID', '登录凭证无效');
    return true;
  }
}
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller()
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}
  @Post('uploads') @UseGuards(UploadAuthGuard) @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@Req() r: UploadRequest, @Body() dto: UploadCreateDto) { return this.uploads.create(r.uploadPrincipal, dto); }
  @Post('uploads/:id/complete') @HttpCode(200) @UseGuards(UploadAuthGuard)
  complete(@Req() r: UploadRequest, @Param('id', uuid) id: string, @Body(new EmptyUploadBody()) _body: unknown) { return this.uploads.complete(r.uploadPrincipal, id); }
  @Get('media/:id') @UseGuards(UploadAuthGuard)
  get(@Req() r: UploadRequest, @Param('id', uuid) id: string) { return this.uploads.get(r.uploadPrincipal, id); }
  @Delete('media/:id') @UseGuards(UploadAuthGuard)
  remove(@Req() r: UploadRequest, @Param('id', uuid) id: string) { return this.uploads.remove(r.uploadPrincipal, id); }
  @Post('media/:id/read-grant') @HttpCode(200) @UseGuards(UploadAuthGuard)
  readGrant(@Req() r: UploadRequest, @Param('id', uuid) id: string, @Body(new EmptyUploadBody()) _body: unknown) { return this.uploads.readGrant(r.uploadPrincipal, id); }
  @Get('media/:id/file')
  file(@Param('id', uuid) id: string, @Query('token') token: string, @Res() res: Response) { return this.uploads.file(id, token, res); }
}
