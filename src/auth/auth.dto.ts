import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

export class PasswordLoginDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone 必须为 E.164 格式，例如 +8613800000000' })
  phone!: string;

  @IsString()
  @Length(1, 72)
  password!: string;
}

export class RegisterDto extends PasswordLoginDto {
  @IsString()
  @Length(10, 72)
  declare password: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 32)
  @Matches(/\S/, { message: 'nickname 不能仅包含空白' })
  nickname?: string;

  @IsString()
  @Length(1, 64)
  termsVersion!: string;

  @IsString()
  @Length(1, 64)
  privacyVersion!: string;
}

export class RefreshDto {
  @IsString()
  @Length(16, 1024)
  refreshToken!: string;
}

export class PasswordChangeDto {
  @IsString()
  @Length(1, 72)
  currentPassword!: string;

  @IsString()
  @Length(10, 72)
  newPassword!: string;
}

const integerQuery = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;

export class PageDto {
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
