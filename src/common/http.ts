import {
  ArgumentsHost, CallHandler, Catch, ExceptionFilter, HttpException,
  Injectable, NestInterceptor, ExecutionContext, ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { map } from 'rxjs';
import { User } from '../database/entities';

export interface Principal { user: User; sessionId: string }
export interface ApiRequest extends Request { requestId: string; principal?: Principal }

export class ApiException extends HttpException {
  constructor(status: number, code: string, message: string, details: { field: string; reason: string }[] = []) {
    super({ code, message, details }, status);
  }
}

export function validationPipe() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => new ApiException(400, 'VALIDATION_ERROR', '请求参数不合法',
      errors.flatMap((error) => Object.values(error.constraints ?? {}).map((reason) => ({ field: error.property, reason })))),
  });
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    return next.handle().pipe(map((data: unknown) => ({
      code: 'OK', message: 'success', data,
      requestId: request.requestId, timestamp: new Date().toISOString(),
    })));
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<ApiRequest>();
    const parserError = error as { type?: string; status?: number } | null;
    const parserStatus = parserError?.type === 'entity.parse.failed' ? 400
      : parserError?.type === 'entity.too.large' ? 413 : undefined;
    const status = error instanceof HttpException ? error.getStatus() : parserStatus ?? 500;
    const body = error instanceof HttpException ? error.getResponse() : null;
    const known = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR', 401: 'TOKEN_INVALID', 403: 'PERMISSION_DENIED', 404: 'RESOURCE_NOT_FOUND',
      413: 'PAYLOAD_TOO_LARGE', 429: 'RATE_LIMITED',
    };
    const messages: Record<number, string> = {
      400: '请求参数不合法', 401: '登录凭证无效', 403: '无权访问', 404: '接口或资源不存在',
      413: '请求内容过大', 429: '请求过于频繁，请稍后重试',
    };
    const retryAfter = status === 429 ? Number(response.getHeader('Retry-After') ?? 60) : undefined;
    if (retryAfter) response.setHeader('Retry-After', retryAfter);
    response.status(status).json({
      code: typeof known.code === 'string' ? known.code : codes[status] ?? 'INTERNAL_ERROR',
      message: typeof known.code === 'string' ? known.message : messages[status] ?? '服务暂时不可用',
      data: null,
      error: { details: known.details ?? [], ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}) },
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
