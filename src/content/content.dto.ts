import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { PageDto } from '../auth/auth.dto';
import { ImageCreateDto, Optional, VersionDto } from '../commerce/commerce.dto';
import { CONTENT_KINDS, ContentKind, PublishStatus } from './entities';

export class ContentCreateDto {
  @IsIn(CONTENT_KINDS) kind!: ContentKind;
  @IsString() @Length(1, 120) @Matches(/\S/) title!: string;
  @IsString() @Length(0, 2000) summary!: string;
  @Optional() @IsString() @Length(0, 100000) descriptionHtml?: string;
  @IsUUID('4') coverMediaId!: string;
  @IsUUID('4') categoryId!: string;
  @Optional() @IsString() @Length(0, 64) authorName?: string;
  @Optional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsString({ each: true }) @Length(1, 20, { each: true }) tags?: string[];
  @IsIn(['FREE', 'PURCHASE']) accessPolicy!: 'FREE' | 'PURCHASE';
  @IsInt() @Min(0) @Max(100000000) priceCents!: number;
}
export class ContentPatchDto extends VersionDto {
  @Optional() @IsString() @Length(1, 120) @Matches(/\S/) title?: string;
  @Optional() @IsString() @Length(0, 2000) summary?: string;
  @Optional() @IsString() @Length(0, 100000) descriptionHtml?: string;
  @Optional() @IsUUID('4') coverMediaId?: string;
  @Optional() @IsUUID('4') categoryId?: string;
  @Optional() @IsString() @Length(0, 64) authorName?: string;
  @Optional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsString({ each: true }) @Length(1, 20, { each: true }) tags?: string[];
  @Optional() @IsIn(['FREE', 'PURCHASE']) accessPolicy?: 'FREE' | 'PURCHASE';
  @Optional() @IsInt() @Min(0) @Max(100000000) priceCents?: number;
}
export class BodyDto extends VersionDto {
  @Optional() @IsString() @Length(1, 500000) bodyHtml?: string;
  @Optional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsUUID('4', { each: true }) imageMediaIds?: string[];
  @Optional() @IsUUID('4') videoMediaId?: string;
}
export class ChapterCreateDto {
  @IsString() @Length(1, 120) @Matches(/\S/) title!: string;
  @IsInt() @Min(0) @Max(1000000) sortOrder!: number;
  @Optional() @IsBoolean() isPreview?: boolean;
}
export class ChapterPatchDto extends VersionDto {
  @Optional() @IsString() @Length(1, 120) @Matches(/\S/) title?: string;
  @Optional() @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
  @Optional() @IsBoolean() isPreview?: boolean;
}
export class ContentQueryDto extends PageDto {
  @Optional() @IsIn(CONTENT_KINDS) kind?: ContentKind;
  @Optional() @IsUUID('4') categoryId?: string;
  @Optional() @IsUUID('4') columnId?: string;
  @Optional() @IsString() @Length(1, 120) keyword?: string;
  @Optional() @IsString() @Length(1, 20) tag?: string;
  @Optional() @IsIn(['FREE', 'PURCHASE']) accessPolicy?: 'FREE' | 'PURCHASE';
  @Optional() @IsIn(['publishedAt:desc', 'publishedAt:asc', 'createdAt:desc', 'createdAt:asc', 'priceCents:asc', 'priceCents:desc']) sort?: string;
}
export class AdminContentQueryDto extends ContentQueryDto { @Optional() @IsIn(['DRAFT', 'PUBLISHED', 'OFFLINE']) status?: PublishStatus; }
export class ChapterQueryDto extends PageDto { @Optional() @IsIn(['DRAFT', 'PUBLISHED', 'OFFLINE']) status?: PublishStatus; }
export class ColumnQueryDto extends PageDto { @Optional() @IsString() @Length(1, 120) keyword?: string; }
export class AdminColumnQueryDto extends ColumnQueryDto { @Optional() @IsIn(['DRAFT', 'PUBLISHED', 'OFFLINE']) status?: PublishStatus; }
export class ColumnCreateDto {
  @IsString() @Length(1, 64) @Matches(/\S/) name!: string;
  @Optional() @IsString() @Length(0, 2000) description?: string;
  @IsUUID('4') coverMediaId!: string;
  @Optional() @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
}
export class ColumnPatchDto extends VersionDto {
  @Optional() @IsString() @Length(1, 64) @Matches(/\S/) name?: string;
  @Optional() @IsString() @Length(0, 2000) description?: string;
  @Optional() @IsUUID('4') coverMediaId?: string;
  @Optional() @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
}
export class ColumnLinkDto { @IsInt() @Min(0) @Max(1000000) sortOrder!: number; }
export class ContentImageDto extends ImageCreateDto { @IsIn(['CONTENT_COVER', 'COLUMN_COVER', 'CONTENT_BODY_IMAGE']) purpose!: 'CONTENT_COVER' | 'COLUMN_COVER' | 'CONTENT_BODY_IMAGE'; }
export class VideoUploadQueryDto {
  @Transform(({ value }) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value)
  @IsInt() @Min(1) @Max(86400) durationSeconds!: number;
}
export class PlaybackQueryDto { @IsString() @Length(1, 4096) token!: string; }
export class PurchasedQueryDto extends PageDto { @Optional() @IsIn(['ACTIVE', 'REVOKED']) status?: 'ACTIVE' | 'REVOKED'; }
