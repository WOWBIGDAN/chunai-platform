import { IsISO8601, IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

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
