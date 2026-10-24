import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { json, NextFunction, Response } from 'express';
import helmet from 'helmet';
import { ApiExceptionFilter, ApiRequest, ResponseInterceptor, validationPipe } from './common/http';

export function setupApp(app: INestApplication) {
  if (process.env.TRUST_PROXY === 'loopback') {
    app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
  }
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use((request: ApiRequest, response: Response, next: NextFunction) => {
    const supplied = request.get('X-Request-ID');
    request.requestId = supplied && /^[A-Za-z0-9_-]{1,64}$/.test(supplied) ? supplied : randomUUID();
    response.setHeader('X-Request-ID', request.requestId);
    response.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  // Rich product descriptions need a larger, still bounded body than auth inputs.
  app.use('/api/v1/admin/products', json({ limit: '256kb' }));
  app.use(json({ limit: '16kb' }));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((value) => value.trim()),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-ID', 'Retry-After'],
  });
  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();
}
