import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from '../commerce/admin-auth';
import { CommerceModule } from '../commerce/commerce.module';
import { AdminContentController, ContentController, ContentPlaybackController, OptionalUserGuard } from './content.controller';
import { ContentService } from './content.service';
import { ContentMediaService } from './media.service';

@Module({ imports: [AuthModule, AdminAuthModule, CommerceModule, JwtModule.register({})],
  controllers: [ContentController, AdminContentController, ContentPlaybackController],
  providers: [ContentService, ContentMediaService, OptionalUserGuard] })
export class ContentModule {}
