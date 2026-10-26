import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { databaseOptions } from './database/data-source';
import { HealthController } from './health.controller';
import { CommerceModule } from './commerce/commerce.module';
import { ContentModule } from './content/content.module';
import { MembershipModule } from './membership/membership.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...databaseOptions(), retryAttempts: 2 }) }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 120 }]),
    AuthModule,
    CommerceModule,
    ContentModule,
    MembershipModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [ThrottlerGuard, { provide: APP_GUARD, useExisting: ThrottlerGuard }],
})
export class AppModule {}
