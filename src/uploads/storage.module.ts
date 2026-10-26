import { Module } from '@nestjs/common';
import { OssStorage } from './oss-storage';
@Module({ providers: [OssStorage], exports: [OssStorage] })
export class UploadStorageModule {}
