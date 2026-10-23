import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiRequest } from '../common/http';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    request.principal = await this.auth.authenticate(request.headers.authorization);
    return true;
  }
}
