import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Optional, VersionDto } from './commerce.dto';

export class CartItemPutDto {
  @IsInt() @Min(0) @Max(2147483647) version!: number;
  @IsInt() @Min(1) @Max(999) quantity!: number;
  @Optional() @IsBoolean() selected?: boolean;
}
export class CartQuoteLineDto extends VersionDto { @IsUUID('4') skuId!: string; }
export class CartQuoteDto {
  @IsUUID('4') addressId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ArrayUnique((line: CartQuoteLineDto | null) => line?.skuId)
  @ValidateNested({ each: true }) @Type(() => CartQuoteLineDto) items!: CartQuoteLineDto[];
}
