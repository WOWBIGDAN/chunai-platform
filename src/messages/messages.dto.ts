import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional,
  IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

const cursor = /^(0|[1-9]\d{0,18})$/;
export class MessagePollDto {
  @IsString() @Matches(cursor) revision = '0';
}
export class MessageListDto {
  @IsOptional() @IsString() @Matches(cursor) afterSequence?: string;
  @IsOptional() @IsString() @Matches(cursor) beforeSequence?: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value)
  @IsInt() @Min(1) @Max(50) limit = 20;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean() unreadOnly?: boolean;
}
export class MessagesReadDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsUUID('4', { each: true }) ids!: string[];
}
export class MessagesReadAllDto {
  @IsString() @Matches(cursor) throughSequence!: string;
}
export class AdminMessageDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsUUID('4', { each: true }) userIds!: string[];
  @IsString() @Length(1, 120) @Matches(/\S/u) title!: string;
  @IsString() @Length(1, 2000) @Matches(/\S/u) body!: string;
}
