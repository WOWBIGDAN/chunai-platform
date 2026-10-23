import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { json, NextFunction, Response } from 'express';
import helmet from 'helmet';
import { ApiExceptionFilter, ApiRequest, ResponseInterceptor, validationPipe } from './common/http';

export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use((request: ApiRequest, response: Response, next: NextFunction) => {
    const supplied = request.get('X-Request-ID');
    request.requestId = supplied && /^[A-Za-z0-9_-]{1,64}$/.test(supplied) ? supplied : randomUUID();
    response.setHeader('X-Request-ID', request.requestId);
    response.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  app.use(json({ limit: '16kb' }));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((value) => value.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'Retry-After'],
  });
  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();
}
