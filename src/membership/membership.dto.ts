import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsISO8601, IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';
import { PageDto } from '../auth/auth.dto';
import { Optional, VersionDto } from '../commerce/commerce.dto';

export class MembershipSaveDto {
  @IsInt() @Min(0) @Max(4294967294) version!: number;
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, { message: 'startsAt 必须包含秒和明确时区' })
  startsAt!: string;
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, { message: 'expiresAt 必须包含秒和明确时区' })
  expiresAt!: string;
  @IsString() @Length(1, 500) @Matches(/\S/) reason!: string;
}

export class MembershipRevokeDto {
  @IsInt() @Min(1) @Max(4294967294) version!: number;
  @IsString() @Length(1, 500) @Matches(/\S/) reason!: string;
}

export class MembershipPlanQueryDto extends PageDto {
  @Optional() @IsString() @Length(1, 64) keyword?: string;
}

export class AdminMembershipPlanQueryDto extends MembershipPlanQueryDto {
  @Optional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean() enabled?: boolean;
}

export class MembershipPlanCreateDto {
  @IsString() @Length(1, 64) @Matches(/\S/) name!: string;
  @IsString() @Length(0, 2000) description!: string;
  @IsInt() @Min(1) @Max(3650) durationDays!: number;
  @IsInt() @Min(1) @Max(100000000) priceCents!: number;
  @Optional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1) @ArrayUnique()
  @IsIn(['MEMBER_CONTENT'], { each: true }) benefitCodes?: string[];
  @Optional() @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
}

export class MembershipPlanPatchDto extends VersionDto {
  @Optional() @IsString() @Length(1, 64) @Matches(/\S/) name?: string;
  @Optional() @IsString() @Length(0, 2000) description?: string;
  @Optional() @IsInt() @Min(1) @Max(3650) durationDays?: number;
  @Optional() @IsInt() @Min(1) @Max(100000000) priceCents?: number;
  @Optional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1) @ArrayUnique()
  @IsIn(['MEMBER_CONTENT'], { each: true }) benefitCodes?: string[];
  @Optional() @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
  @Optional() @IsBoolean() enabled?: boolean;
}
