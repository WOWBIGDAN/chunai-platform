import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthModule } from '../commerce/admin-auth';
import { CommerceModule } from '../commerce/commerce.module';
import { UploadStorageModule } from './storage.module';
import { UploadAuthGuard, UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { UploadMaintenance } from './uploads.maintenance';
@Module({ imports: [AuthModule, AdminAuthModule, CommerceModule, UploadStorageModule, JwtModule.register({})],
  controllers: [UploadsController], providers: [UploadAuthGuard, UploadsService, UploadMaintenance] })
export class UploadsModule {}
