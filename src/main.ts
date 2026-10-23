import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { authConfig, integerEnv } from './config';
import { setupApp } from './setup-app';

async function bootstrap() {
  authConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  setupApp(app);
  await app.listen(integerEnv('PORT', 3000, 1, 65535), process.env.HOST ?? '0.0.0.0');
}

void bootstrap().catch(() => {
  // Do not print connection credentials, SQL parameters or tokens on bootstrap failure.
  console.error('API 启动失败，请检查环境配置、MySQL 连接和数据库迁移。');
  process.exitCode = 1;
});
