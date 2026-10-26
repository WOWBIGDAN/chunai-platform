import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from '../commerce/admin-auth';
import { CommerceModule } from '../commerce/commerce.module';
import { AdminUsersController, UserProfileController } from './users.controller';
import { UsersService } from './users.service';

@Module({ imports: [AuthModule, AdminAuthModule, CommerceModule], controllers: [UserProfileController, AdminUsersController],
  providers: [UsersService] })
export class UsersModule {}
