import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiRequest } from '../common/http';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const skipActivity = this.reflector.getAllAndOverride<boolean>('auth:skip-activity', [context.getHandler(), context.getClass()]);
    request.principal = await this.auth.authenticate(request.headers.authorization, !skipActivity);
    return true;
  }
}
