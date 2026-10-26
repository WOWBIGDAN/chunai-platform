import { IsIn, IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';
import { Optional } from '../commerce/commerce.dto';
import { UPLOAD_PURPOSES, UploadPurpose } from './entities';
import { PipeTransform } from '@nestjs/common';
import { ApiException } from '../common/http';
export class UploadCreateDto {
  @IsIn(UPLOAD_PURPOSES) purpose!: UploadPurpose;
  @IsString() @Length(1, 200) @Matches(/^[^\u0000-\u001f\u007f/\\]+$/) fileName!: string;
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']) mimeType!: string;
  @IsInt() @Min(1) @Max(104857600) sizeBytes!: number;
  @Optional() @IsInt() @Min(0) @Max(86400) durationSeconds?: number;
}
export class EmptyUploadBody implements PipeTransform {
  transform(value: unknown) {
    if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length)) {
      throw new ApiException(400, 'VALIDATION_ERROR', '此接口不接受请求字段');
    }
    return value;
  }
}
