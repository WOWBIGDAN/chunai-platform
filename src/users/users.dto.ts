import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsString, IsUUID, Length, Matches, ValidateIf } from 'class-validator';
import { DateQueryDto, Optional, VersionDto } from '../commerce/commerce.dto';
import { UserStatus } from '../database/entities';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class UserPatchDto extends VersionDto {
  @Optional() @Transform(trim) @IsString() @Length(1, 32) @Matches(/^[^\u0000-\u001f\u007f]+$/) nickname?: string;
  @ValidateIf((_o, value) => value !== undefined && value !== null) @IsString() @Length(1, 2048) avatarUrl?: string | null;
  @ValidateIf((_o, value) => value !== undefined && value !== null) @IsUUID('4') avatarMediaId?: string | null;
}

export class AdminUserQueryDto extends DateQueryDto {
  @Optional() @Transform(trim) @IsString() @Length(1, 64) keyword?: string;
  @Optional() @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string;
  @Optional() @IsIn(['ACTIVE', 'BANNED', 'DEACTIVATED']) status?: UserStatus;
  @Optional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() hasMembership?: boolean;
}

export class UserModerationDto extends VersionDto {
  @Transform(trim) @IsString() @Length(1, 500) @Matches(/\S/) reason!: string;
}
