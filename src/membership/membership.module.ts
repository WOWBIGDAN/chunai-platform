import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from '../commerce/admin-auth';
import { CommerceModule } from '../commerce/commerce.module';
import { AdminMembershipController, MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';

@Module({ imports: [AuthModule, AdminAuthModule, CommerceModule],
  controllers: [MembershipController, AdminMembershipController], providers: [MembershipService] })
export class MembershipModule {}
