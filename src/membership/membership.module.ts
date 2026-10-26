import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from '../commerce/admin-auth';
import { CommerceModule } from '../commerce/commerce.module';
import { AdminMembershipController, AdminMembershipPlansController, MembershipController, MembershipPlansController } from './membership.controller';
import { MembershipService } from './membership.service';
import { MembershipPlansService } from './membership-plans.service';

@Module({ imports: [AuthModule, AdminAuthModule, CommerceModule],
  controllers: [MembershipController, AdminMembershipController, MembershipPlansController, AdminMembershipPlansController],
  providers: [MembershipService, MembershipPlansService] })
export class MembershipModule {}
