import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiRequest } from '../common/http';
import { AuthGuard } from './auth.guard';
import { PageDto, PasswordChangeDto, PasswordLoginDto, RefreshDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto, @Req() request: ApiRequest) {
    return this.auth.register(dto, request.get('user-agent') ?? '');
  }

  @Post('login/password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: PasswordLoginDto, @Req() request: ApiRequest) {
    return this.auth.login(dto, request.get('user-agent') ?? '');
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  logout(@Req() request: ApiRequest) {
    return this.auth.revokeSession(request.principal!, request.principal!.sessionId);
  }
}

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  me(@Req() request: ApiRequest) { return this.auth.userSummary(request.principal!.user); }

  @Put('password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  password(@Body() dto: PasswordChangeDto, @Req() request: ApiRequest) {
    return this.auth.changePassword(request.principal!, dto);
  }

  @Get('sessions')
  sessions(@Query() query: PageDto, @Req() request: ApiRequest) {
    return this.auth.sessions(request.principal!, query);
  }

  @Delete('sessions/:id')
  revoke(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: ApiRequest) {
    return this.auth.revokeSession(request.principal!, id);
  }
}

@Controller('public/legal-documents')
export class LegalController {
  constructor(private readonly auth: AuthService) {}

  @Get(':type')
  get(@Param('type') type: string) { return this.auth.legalDocument(type); }
}
