import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from '../commerce/admin-auth';
import { CommerceModule } from '../commerce/commerce.module';
import { AdminMessagesController, MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({ imports: [AuthModule, AdminAuthModule, CommerceModule],
  controllers: [MessagesController, AdminMessagesController], providers: [MessagesService] })
export class MessagesModule {}
