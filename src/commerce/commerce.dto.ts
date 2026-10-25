import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601,
  IsString, IsUrl, IsUUID, Length, Matches, Max, Min, NotEquals, ValidateIf, ValidateNested } from 'class-validator';
import { PageDto } from '../auth/auth.dto';
import { AFTERSALE_STATUSES, ORDER_STATUSES } from './entities';

export const Optional = () => ValidateIf((_o, value) => value !== undefined);
const queryInt = ({ value }: { value: unknown }) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
export class VersionDto { @IsInt() @Min(1) @Max(2147483647) version!: number; }
export class VersionQueryDto { @Transform(queryInt) @IsInt() @Min(1) @Max(2147483647) version!: number; }
export class AdminLoginDto {
  @IsString() @Matches(/^[A-Za-z0-9_.-]{1,64}$/) username!: string;
  @IsString() @Length(1, 72) password!: string;
}
export class CategoryCreateDto {
  @IsString() @Length(1, 32) @Matches(/\S/) name!: string;
  @IsIn(['PRODUCT', 'CONTENT']) scope!: 'PRODUCT' | 'CONTENT';
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsUUID('4') parentId?: string | null;
  @Optional() @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
  @Optional() @IsBoolean() enabled?: boolean;
}
export class CategoryPatchDto extends VersionDto {
  @Optional() @IsString() @Length(1, 32) @Matches(/\S/) name?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsUUID('4') parentId?: string | null;
  @Optional() @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
  @Optional() @IsBoolean() enabled?: boolean;
}
export class CategoryQueryDto extends PageDto {
  @Optional() @IsIn(['PRODUCT', 'CONTENT']) scope?: 'PRODUCT' | 'CONTENT';
  @Optional() @IsString() @Length(1, 120) keyword?: string;
  @Optional() @IsUUID('4') parentId?: string;
}
export class ImageCreateDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, allow_protocol_relative_urls: false }) @Length(1, 2048) publicUrl!: string;
  @IsIn(['image/jpeg', 'image/png', 'image/webp']) mimeType!: string;
  @IsInt() @Min(1) @Max(20971520) sizeBytes!: number;
}
export class ProductCreateDto {
  @IsString() @Length(1, 120) @Matches(/\S/) name!: string;
  @IsString() @Length(1, 2000) summary!: string;
  @IsUUID('4') coverMediaId!: string;
  @IsUUID('4') categoryId!: string;
  @IsString() @Length(0, 100000) detailHtml!: string;
  @Optional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsUUID('4', { each: true }) galleryMediaIds?: string[];
  @IsString() @Length(1, 2000) afterSalePolicy!: string;
}
export class ProductPatchDto extends VersionDto {
  @Optional() @IsString() @Length(1, 120) @Matches(/\S/) name?: string;
  @Optional() @IsString() @Length(1, 2000) summary?: string;
  @Optional() @IsUUID('4') coverMediaId?: string;
  @Optional() @IsUUID('4') categoryId?: string;
  @Optional() @IsString() @Length(0, 100000) detailHtml?: string;
  @Optional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsUUID('4', { each: true }) galleryMediaIds?: string[];
  @Optional() @IsString() @Length(1, 2000) afterSalePolicy?: string;
}
export class ProductQueryDto extends PageDto {
  @Optional() @IsUUID('4') categoryId?: string;
  @Optional() @IsString() @Length(1, 120) keyword?: string;
  @Optional() @IsIn(['priceCents:asc', 'priceCents:desc', 'createdAt:desc']) sort?: string;
  @Optional() @Transform(queryInt) @IsInt() @Min(0) @Max(100000000) minPriceCents?: number;
  @Optional() @Transform(queryInt) @IsInt() @Min(0) @Max(100000000) maxPriceCents?: number;
  @Optional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() inStock?: boolean;
}
export class AdminProductQueryDto extends ProductQueryDto {
  @Optional() @IsIn(['DRAFT', 'PUBLISHED', 'OFFLINE']) status?: string;
}
export class AttributeDto {
  @IsString() @Length(1, 32) @Matches(/\S/) name!: string;
  @IsString() @Length(1, 64) @Matches(/\S/) value!: string;
}
export class SkuCreateDto {
  @IsString() @Matches(/^[A-Za-z0-9_.-]{1,64}$/) skuCode!: string;
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => AttributeDto) attributes!: AttributeDto[];
  @IsInt() @Min(1) @Max(100000000) priceCents!: number;
  @Optional() @IsBoolean() enabled?: boolean;
}
export class SkuPatchDto extends VersionDto {
  @Optional() @IsString() @Matches(/^[A-Za-z0-9_.-]{1,64}$/) skuCode?: string;
  @Optional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => AttributeDto) attributes?: AttributeDto[];
  @Optional() @IsInt() @Min(1) @Max(100000000) priceCents?: number;
  @Optional() @IsBoolean() enabled?: boolean;
}
export class StockDto extends VersionDto {
  @IsInt() @Min(-100000000) @Max(100000000) @NotEquals(0) delta!: number;
  @IsString() @Length(1, 200) @Matches(/\S/) reason!: string;
}
export class AddressSnapshotDto {
  @IsString() @Length(1, 32) @Matches(/\S/) recipient!: string;
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @IsString() @Matches(/^\d{6}$/) provinceCode!: string;
  @IsString() @Length(1, 32) province!: string;
  @IsString() @Matches(/^\d{6}$/) cityCode!: string;
  @IsString() @Length(1, 32) city!: string;
  @IsString() @Matches(/^\d{6}$/) districtCode!: string;
  @IsString() @Length(1, 32) district!: string;
  @IsString() @Length(1, 200) @Matches(/\S/) detail!: string;
}
export class AddressCreateDto extends AddressSnapshotDto { @Optional() @IsBoolean() isDefault?: boolean; }
export class AddressReplaceDto extends AddressSnapshotDto {
  @IsBoolean() isDefault!: boolean;
  @IsInt() @Min(1) @Max(2147483647) version!: number;
}
export class PurchaseLineDto {
  @IsUUID('4') skuId!: string;
  @IsInt() @Min(1) @Max(999) quantity!: number;
}
export class QuoteDto {
  @IsIn(['PRODUCT', 'COURSE']) type!: 'PRODUCT' | 'COURSE';
  @ValidateIf(o => o.type === 'PRODUCT' || o.addressId !== undefined) @IsUUID('4') addressId?: string;
  @ValidateIf(o => o.type === 'PRODUCT' || o.items !== undefined) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => PurchaseLineDto) items?: PurchaseLineDto[];
  @ValidateIf(o => o.type === 'COURSE' || o.courseId !== undefined) @IsUUID('4') courseId?: string;
}
export class CreateOrderDto { @IsUUID('4') quoteId!: string; }
export class CancelOrderDto extends VersionDto { @IsString() @Length(1, 200) @Matches(/\S/) reason!: string; }
export class DateQueryDto extends PageDto {
  @Optional() @IsISO8601({ strict: true }) createdFrom?: string;
  @Optional() @IsISO8601({ strict: true }) createdTo?: string;
}
export class OrderQueryDto extends DateQueryDto {
  @Optional() @IsIn(['PRODUCT', 'COURSE']) type?: string;
  @Optional() @IsIn(ORDER_STATUSES) status?: typeof ORDER_STATUSES[number];
  @Optional() @IsIn(['UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']) paymentStatus?: string;
  @Optional() @IsIn(['NONE', 'PROCESSING', 'PARTIALLY_COMPLETED', 'COMPLETED']) afterSaleStatus?: string;
  @Optional() @IsIn(['createdAt:asc', 'createdAt:desc']) sort?: string;
}
export class AdminOrderQueryDto extends OrderQueryDto {
  @Optional() @IsUUID('4') userId?: string;
  @Optional() @IsString() @Length(1, 40) orderNo?: string;
}
export class ShipmentDto {
  @IsString() @Matches(/^[A-Z0-9_]{1,32}$/) carrierCode!: string;
  @IsString() @Matches(/^[A-Za-z0-9-]{1,64}$/) trackingNo!: string;
  @IsInt() @Min(1) @Max(2147483647) orderVersion!: number;
}
export class ReturnShipmentDto extends VersionDto {
  @IsString() @Matches(/^[A-Z0-9_]{1,32}$/) carrierCode!: string;
  @IsString() @Matches(/^[A-Za-z0-9-]{1,64}$/) trackingNo!: string;
}
export class ShipmentPatchDto extends ReturnShipmentDto {
  @IsString() @Length(1, 200) @Matches(/\S/) reason!: string;
}
export class LogisticsEventDto extends VersionDto {
  @IsIn(['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION']) status!: string;
  @IsISO8601({ strict: true }) time!: string;
  @IsString() @Length(1, 500) @Matches(/\S/) description!: string;
  @Optional() @IsString() @Length(1, 100) location?: string;
}
export class AfterSaleLineDto {
  @IsUUID('4') orderItemId!: string;
  @IsInt() @Min(1) @Max(999) quantity!: number;
}
export class AfterSaleCreateDto {
  @IsUUID('4') orderId!: string;
  @IsIn(['REFUND_ONLY', 'RETURN_REFUND']) type!: 'REFUND_ONLY' | 'RETURN_REFUND';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => AfterSaleLineDto) items!: AfterSaleLineDto[];
  @IsIn(['NOT_NEEDED', 'QUALITY_ISSUE', 'WRONG_ITEM', 'OTHER']) reasonCode!: string;
  @IsString() @Length(1, 2000) @Matches(/\S/) description!: string;
  @Optional() @IsArray() @ArrayMaxSize(9) @ArrayUnique() @IsUUID('4', { each: true }) evidenceMediaIds?: string[];
}
export class AfterSaleQueryDto extends DateQueryDto {
  @Optional() @IsIn(AFTERSALE_STATUSES) status?: string;
  @Optional() @IsUUID('4') orderId?: string;
}
export class AdminAfterSaleQueryDto extends AfterSaleQueryDto { @Optional() @IsUUID('4') userId?: string; }
export class ReviewDto extends VersionDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @IsString() @Length(1, 1000) @Matches(/\S/) note!: string;
  @Optional() @ValidateNested() @Type(() => AddressSnapshotDto) returnAddress?: AddressSnapshotDto;
}
export class ReturnReceiptDto extends VersionDto { @IsString() @Length(1, 1000) @Matches(/\S/) note!: string; }
export class TestPaymentDto extends VersionDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,64}$/) transactionNo!: string;
}
export class TestRefundDto extends VersionDto { @IsIn(['SUCCEEDED', 'FAILED']) result!: 'SUCCEEDED' | 'FAILED'; }
export class DigitalRefundDto {
  @IsInt() @Min(1) @Max(2147483647) orderVersion!: number;
  @IsString() @Length(1, 1000) @Matches(/\S/) reason!: string;
}
export class RefundQueryDto extends DateQueryDto {
  @Optional() @IsUUID('4') orderId?: string;
  @Optional() @IsIn(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED']) status?: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
}
