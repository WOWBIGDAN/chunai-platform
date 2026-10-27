import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export abstract class RecordBase {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id!: string;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3, default: () => '(UTC_TIMESTAMP(3))' }) createdAt!: Date;
}
export abstract class Versioned extends RecordBase {
  @Column({ type: 'int', unsigned: true, default: 1 }) version!: number;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3, default: () => '(UTC_TIMESTAMP(3))' }) updatedAt!: Date;
}
@Entity('admin_accounts')
export class AdminAccount extends Versioned {
  @Column({ type: 'varchar', length: 64 }) username!: string;
  @Column({ name: 'display_name', type: 'varchar', length: 64 }) displayName!: string;
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false }) passwordHash!: string;
  @Column({ type: 'boolean', default: true }) enabled!: boolean;
  @Column({ type: 'json' }) permissions!: string[];
}
@Entity('admin_sessions')
export class AdminSession extends RecordBase {
  @Column({ name: 'admin_id', type: 'varchar', length: 36 }) adminId!: string;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt!: Date | null;
}
@Entity('admin_refresh_tokens')
export class AdminRefreshToken extends RecordBase {
  @Column({ name: 'session_id', type: 'varchar', length: 36 }) sessionId!: string;
  @Column({ name: 'token_hash', type: 'char', length: 64, select: false }) tokenHash!: string;
  @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true }) usedAt!: Date | null;
}
@Entity('product_categories')
export class Category extends Versioned {
  @Column({ type: 'varchar', length: 32 }) name!: string;
  @Column({ type: 'varchar', length: 16, default: 'PRODUCT' }) scope!: 'PRODUCT' | 'CONTENT';
  @Column({ name: 'parent_id', type: 'varchar', length: 36, nullable: true }) parentId!: string | null;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder!: number;
  @Column({ type: 'boolean', default: true }) enabled!: boolean;
}
@Entity('product_images')
export class ProductImage extends RecordBase {
  @Column({ name: 'public_url', type: 'varchar', length: 2048 }) publicUrl!: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 32 }) mimeType!: string;
  @Column({ name: 'size_bytes', type: 'int', unsigned: true }) sizeBytes!: number;
  @Column({ name: 'operator_id', type: 'varchar', length: 36 }) operatorId!: string;
}
@Entity('products')
export class Product extends Versioned {
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 2000 }) summary!: string;
  @Column({ name: 'category_id', type: 'varchar', length: 36 }) categoryId!: string;
  @Column({ name: 'cover_media_id', type: 'varchar', length: 36 }) coverMediaId!: string;
  @Column({ name: 'gallery_media_ids', type: 'json' }) galleryMediaIds!: string[];
  @Column({ name: 'detail_html', type: 'mediumtext' }) detailHtml!: string;
  @Column({ name: 'after_sale_policy', type: 'varchar', length: 2000 }) afterSalePolicy!: string;
  @Column({ type: 'varchar', length: 16, default: 'DRAFT' }) status!: 'DRAFT' | 'PUBLISHED' | 'OFFLINE';
}
export interface Attribute { name: string; value: string }
@Entity('product_skus')
export class Sku extends Versioned {
  @Column({ name: 'product_id', type: 'varchar', length: 36 }) productId!: string;
  @Column({ name: 'sku_code', type: 'varchar', length: 64 }) skuCode!: string;
  @Column({ type: 'json' }) attributes!: Attribute[];
  @Column({ name: 'attributes_hash', type: 'char', length: 64 }) attributesHash!: string;
  @Column({ name: 'price_cents', type: 'int', unsigned: true }) priceCents!: number;
  @Column({ type: 'boolean', default: true }) enabled!: boolean;
  @Column({ name: 'on_hand_stock', type: 'int', unsigned: true, default: 0 }) onHandStock!: number;
  @Column({ name: 'reserved_stock', type: 'int', unsigned: true, default: 0 }) reservedStock!: number;
}
@Entity('stock_movements')
export class StockMovement extends RecordBase {
  @Column({ name: 'sku_id', type: 'varchar', length: 36 }) skuId!: string;
  @Column({ type: 'int' }) delta!: number;
  @Column({ name: 'reserved_delta', type: 'int' }) reservedDelta!: number;
  @Column({ name: 'on_hand_stock_after', type: 'int', unsigned: true }) onHandStockAfter!: number;
  @Column({ name: 'reserved_stock_after', type: 'int', unsigned: true }) reservedStockAfter!: number;
  @Column({ type: 'varchar', length: 200 }) reason!: string;
  @Column({ name: 'operator_id', type: 'varchar', length: 36 }) operatorId!: string;
  @Column({ name: 'order_id', type: 'varchar', length: 36, nullable: true }) orderId!: string | null;
}
export interface AddressSnapshot {
  recipient: string; phone: string; provinceCode: string; province: string;
  cityCode: string; city: string; districtCode: string; district: string; detail: string;
}
@Entity('user_addresses')
export class Address extends Versioned {
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ type: 'json' }) snapshot!: AddressSnapshot;
  @Column({ name: 'is_default', type: 'boolean', default: false }) isDefault!: boolean;
}
export interface ItemSnapshot {
  id: string; resourceId: string; resourceType: 'SKU' | 'COURSE' | 'MEMBERSHIP_PLAN'; productId: string | null; title: string;
  skuAttributes: Attribute[]; coverUrl: string | null; quantity: number; unitPriceCents: number;
  subtotalCents: number; refundedQuantity: number; refundedAmountCents: number;
  membershipSnapshot?: { planId: string; name: string; durationDays: number; priceCents: number; benefitCodes: string[] };
}
@Entity('cart_items')
export class CartItem extends Versioned {
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'sku_id', type: 'varchar', length: 36 }) skuId!: string;
  @Column({ type: 'int', unsigned: true }) quantity!: number;
  @Column({ type: 'boolean', default: true }) selected!: boolean;
}
export interface CartSnapshot { id: string; skuId: string; quantity: number; version: number }
@Entity('order_quotes')
export class Quote extends RecordBase {
  @Column({ name: 'cart_items', type: 'json', nullable: true }) cartItems!: CartSnapshot[] | null;
  @Column({ type: 'varchar', length: 16, default: 'PRODUCT' }) type!: 'PRODUCT' | 'COURSE' | 'MEMBERSHIP';
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ type: 'json', nullable: true }) address!: AddressSnapshot | null;
  @Column({ type: 'json' }) items!: ItemSnapshot[];
  @Column({ name: 'shipping_fee_cents', type: 'int', unsigned: true }) shippingFeeCents!: number;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt!: Date;
}
export const ORDER_STATUSES = ['PENDING_PAYMENT', 'PENDING_SHIPMENT', 'PENDING_RECEIPT', 'COMPLETED', 'CANCELLED', 'CLOSED'] as const;
@Entity('commerce_orders')
export class Order extends Versioned {
  @Column({ type: 'varchar', length: 16, default: 'PRODUCT' }) type!: 'PRODUCT' | 'COURSE' | 'MEMBERSHIP';
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'quote_id', type: 'varchar', length: 36 }) quoteId!: string;
  @Column({ name: 'order_no', type: 'varchar', length: 40 }) orderNo!: string;
  @Column({ type: 'varchar', length: 24 }) status!: typeof ORDER_STATUSES[number];
  @Column({ name: 'payment_status', type: 'varchar', length: 24, default: 'UNPAID' }) paymentStatus!: string;
  @Column({ name: 'after_sale_status', type: 'varchar', length: 24, default: 'NONE' }) afterSaleStatus!: string;
  @Column({ type: 'json', nullable: true }) address!: AddressSnapshot | null;
  @Column({ name: 'items_amount_cents', type: 'int', unsigned: true }) itemsAmountCents!: number;
  @Column({ name: 'shipping_fee_cents', type: 'int', unsigned: true }) shippingFeeCents!: number;
  @Column({ name: 'payable_amount_cents', type: 'int', unsigned: true }) payableAmountCents!: number;
  @Column({ name: 'paid_amount_cents', type: 'int', unsigned: true, default: 0 }) paidAmountCents!: number;
  @Column({ name: 'refunded_amount_cents', type: 'int', unsigned: true, default: 0 }) refundedAmountCents!: number;
  @Column({ name: 'payment_deadline_at', type: 'datetime', precision: 3 }) paymentDeadlineAt!: Date;
  @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true }) paidAt!: Date | null;
  @Column({ name: 'cancelled_at', type: 'datetime', precision: 3, nullable: true }) cancelledAt!: Date | null;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true }) completedAt!: Date | null;
  @Column({ name: 'cancel_reason', type: 'varchar', length: 200, nullable: true }) cancelReason!: string | null;
  @Column({ name: 'closed_reason', type: 'varchar', length: 200, nullable: true }) closedReason!: string | null;
}
@Entity('order_items')
export class OrderItem extends RecordBase {
  @Column({ name: 'order_id', type: 'varchar', length: 36 }) orderId!: string;
  @Column({ name: 'resource_id', type: 'varchar', length: 36, nullable: true }) resourceId!: string | null;
  @Column({ name: 'product_id', type: 'varchar', length: 36, nullable: true }) productId!: string | null;
  @Column({ name: 'course_id', type: 'varchar', length: 36, nullable: true }) courseId!: string | null;
  @Column({ name: 'membership_plan_id', type: 'varchar', length: 36, nullable: true }) membershipPlanId!: string | null;
  @Column({ name: 'membership_snapshot', type: 'json', nullable: true }) membershipSnapshot!: ItemSnapshot['membershipSnapshot'] | null;
  @Column({ type: 'varchar', length: 120 }) title!: string;
  @Column({ name: 'sku_attributes', type: 'json' }) skuAttributes!: Attribute[];
  @Column({ name: 'cover_url', type: 'varchar', length: 2048, nullable: true }) coverUrl!: string | null;
  @Column({ type: 'int', unsigned: true }) quantity!: number;
  @Column({ name: 'unit_price_cents', type: 'int', unsigned: true }) unitPriceCents!: number;
  @Column({ name: 'subtotal_cents', type: 'int', unsigned: true }) subtotalCents!: number;
  @Column({ name: 'refunded_quantity', type: 'int', unsigned: true, default: 0 }) refundedQuantity!: number;
  @Column({ name: 'refunded_amount_cents', type: 'int', unsigned: true, default: 0 }) refundedAmountCents!: number;
  get resourceType(): 'SKU' | 'COURSE' | 'MEMBERSHIP_PLAN' { return this.membershipPlanId ? 'MEMBERSHIP_PLAN' : this.courseId ? 'COURSE' : 'SKU'; }
}
@Entity('shipments')
export class Shipment extends Versioned {
  @Column({ name: 'order_id', type: 'varchar', length: 36 }) orderId!: string;
  @Column({ name: 'carrier_code', type: 'varchar', length: 32 }) carrierCode!: string;
  @Column({ name: 'carrier_name', type: 'varchar', length: 64 }) carrierName!: string;
  @Column({ name: 'tracking_no', type: 'varchar', length: 64 }) trackingNo!: string;
  @Column({ type: 'varchar', length: 24, default: 'PENDING_PICKUP' }) status!: string;
  @Column({ name: 'shipped_at', type: 'datetime', precision: 3 }) shippedAt!: Date;
  @Column({ name: 'delivered_at', type: 'datetime', precision: 3, nullable: true }) deliveredAt!: Date | null;
  @Column({ name: 'last_synced_at', type: 'datetime', precision: 3, nullable: true }) lastSyncedAt!: Date | null;
  @Column({ name: 'query_phone_last4', type: 'char', length: 4, nullable: true }) queryPhoneLast4!: string | null;
  @Column({ name: 'sync_status', type: 'varchar', length: 16, default: 'PENDING' }) syncStatus!: string;
  @Column({ name: 'sync_error_code', type: 'varchar', length: 64, nullable: true }) syncErrorCode!: string | null;
  @Column({ name: 'last_sync_attempt_at', type: 'datetime', precision: 3, nullable: true }) lastSyncAttemptAt!: Date | null;
  @Column({ name: 'next_sync_at', type: 'datetime', precision: 3, nullable: true }) nextSyncAt!: Date | null;
  @Column({ name: 'sync_lease_token', type: 'varchar', length: 36, nullable: true }) syncLeaseToken!: string | null;
  @Column({ name: 'sync_lease_until', type: 'datetime', precision: 3, nullable: true }) syncLeaseUntil!: Date | null;
  @Column({ name: 'sync_failures', type: 'int', unsigned: true, default: 0 }) syncFailures!: number;
  @Column({ type: 'json' }) items!: { orderItemId: string; quantity: number }[];
}
@Entity('logistics_events')
export class LogisticsEvent extends RecordBase {
  @Column({ name: 'shipment_id', type: 'varchar', length: 36 }) shipmentId!: string;
  @Column({ type: 'datetime', precision: 3 }) time!: Date;
  @Column({ type: 'varchar', length: 500 }) description!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) location!: string | null;
  @Column({ type: 'varchar', length: 16, default: 'MANUAL' }) source!: string;
  @Column({ name: 'event_key', type: 'char', length: 64, nullable: true }) eventKey!: string | null;
}
export const ACTIVE_AFTERSALES = ['PENDING_REVIEW', 'AWAITING_RETURN', 'RETURNING', 'REFUNDING', 'REFUND_FAILED'];
export const AFTERSALE_STATUSES = [...ACTIVE_AFTERSALES, 'REJECTED', 'CANCELLED', 'CLOSED', 'COMPLETED'];
@Entity('after_sales')
export class AfterSale extends Versioned {
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ name: 'order_id', type: 'varchar', length: 36 }) orderId!: string;
  @Column({ name: 'after_sale_no', type: 'varchar', length: 40 }) afterSaleNo!: string;
  @Column({ type: 'varchar', length: 16 }) type!: 'REFUND_ONLY' | 'RETURN_REFUND';
  @Column({ type: 'varchar', length: 24 }) status!: string;
  @Column({ name: 'items_refund_amount_cents', type: 'int', unsigned: true }) itemsRefundAmountCents!: number;
  @Column({ name: 'shipping_refund_amount_cents', type: 'int', unsigned: true }) shippingRefundAmountCents!: number;
  @Column({ name: 'refund_amount_cents', type: 'int', unsigned: true }) refundAmountCents!: number;
  @Column({ name: 'reason_code', type: 'varchar', length: 24 }) reasonCode!: string;
  @Column({ type: 'varchar', length: 2000 }) description!: string;
  @Column({ name: 'review_note', type: 'varchar', length: 1000, nullable: true }) reviewNote!: string | null;
  @Column({ name: 'return_deadline_at', type: 'datetime', precision: 3, nullable: true }) returnDeadlineAt!: Date | null;
  @Column({ name: 'return_address', type: 'json', nullable: true }) returnAddress!: AddressSnapshot | null;
  @Column({ name: 'return_shipment', type: 'json', nullable: true }) returnShipment!: { carrierCode: string; trackingNo: string; submittedAt: string } | null;
  @Column({ name: 'refund_id', type: 'varchar', length: 36, nullable: true }) refundId!: string | null;
}
@Entity('after_sale_items')
export class AfterSaleItem extends RecordBase {
  @Column({ name: 'after_sale_id', type: 'varchar', length: 36 }) afterSaleId!: string;
  @Column({ name: 'order_item_id', type: 'varchar', length: 36 }) orderItemId!: string;
  @Column({ type: 'int', unsigned: true }) quantity!: number;
  @Column({ name: 'refund_amount_cents', type: 'int', unsigned: true }) refundAmountCents!: number;
}
@Entity('payment_records')
export class PaymentRecord extends RecordBase {
  @Column({ name: 'order_id', type: 'varchar', length: 36 }) orderId!: string;
  @Column({ type: 'varchar', length: 16 }) provider!: string;
  @Column({ name: 'transaction_no', type: 'varchar', length: 64 }) transactionNo!: string;
  @Column({ name: 'amount_cents', type: 'int', unsigned: true }) amountCents!: number;
  @Column({ name: 'operator_id', type: 'varchar', length: 36 }) operatorId!: string;
}
@Entity('refunds')
export class Refund extends RecordBase {
  @Column({ type: 'int', unsigned: true, default: 1 }) version!: number;
  @Column({ name: 'order_id', type: 'varchar', length: 36 }) orderId!: string;
  @Column({ name: 'after_sale_id', type: 'varchar', length: 36, nullable: true }) afterSaleId!: string | null;
  @Column({ name: 'payment_id', type: 'varchar', length: 36 }) paymentId!: string;
  @Column({ name: 'amount_cents', type: 'int', unsigned: true }) amountCents!: number;
  @Column({ type: 'varchar', length: 16 }) status!: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  @Column({ name: 'failure_code', type: 'varchar', length: 64, nullable: true }) failureCode!: string | null;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true }) completedAt!: Date | null;
}
@Entity('idempotency_records')
export class IdempotencyRecord extends RecordBase {
  @Column({ name: 'actor_key', type: 'varchar', length: 48 }) actorKey!: string;
  @Column({ name: 'request_key', type: 'varchar', length: 64 }) requestKey!: string;
  @Column({ name: 'request_hash', type: 'char', length: 64 }) requestHash!: string;
  @Column({ type: 'json', nullable: true }) response!: unknown;
}
@Entity('commerce_audit_logs')
export class AuditLog extends RecordBase {
  @Column({ name: 'actor_key', type: 'varchar', length: 48 }) actorKey!: string;
  @Column({ type: 'varchar', length: 100 }) action!: string;
  @Column({ name: 'resource_id', type: 'varchar', length: 36 }) resourceId!: string;
  @Column({ type: 'json' }) details!: Record<string, unknown>;
}
export const commerceEntities = [AdminAccount, AdminSession, AdminRefreshToken, Category, ProductImage,
  Product, Sku, StockMovement, Address, CartItem, Quote, Order, OrderItem, Shipment, LogisticsEvent,
  AfterSale, AfterSaleItem, PaymentRecord, Refund, IdempotencyRecord, AuditLog];
