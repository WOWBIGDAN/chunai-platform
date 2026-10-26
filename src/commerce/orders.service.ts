import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../common/http';
import { User } from '../database/entities';
import { PageDto } from '../auth/auth.dto';
import { AddressCreateDto, AddressReplaceDto, AdminOrderQueryDto, CancelOrderDto, CreateOrderDto,
  LogisticsEventDto, QuoteDto, ShipmentDto, ShipmentPatchDto, TestPaymentDto, VersionDto } from './commerce.dto';
import { Address, AddressSnapshot, AfterSale, ACTIVE_AFTERSALES, Category, ItemSnapshot, LogisticsEvent,
  Order, OrderItem, PaymentRecord, Product, ProductImage, Quote, Shipment, Sku } from './entities';
import { Actor, actorId, CommerceTransaction, canonical, checkVersion, conflict, missing, page, touch } from './transaction';
import { CatalogService } from './catalog.service';
import { testPaymentsEnabled } from './permissions';
import { courseQuote, grantCourse, validateCourseOrder } from '../content/course-purchase';
import { membershipSummary } from '../membership/membership-access';
import { membershipQuote, grantMembership, validateMembershipOrder } from '../membership/membership-purchase';

export const CARRIERS: Record<string, string> = { SF: '顺丰速运', YTO: '圆通速递', ZTO: '中通快递', STO: '申通快递', YUNDA: '韵达快递', EMS: '中国邮政', JD: '京东物流' };
export function carrierName(code: string) { if (!CARRIERS[code]) throw new ApiException(400, 'CARRIER_UNSUPPORTED', '不支持的快递代码'); return CARRIERS[code]; }
export function testMode() { if (!testPaymentsEnabled()) throw new ApiException(403, 'TEST_PAYMENTS_DISABLED', '测试收付款功能未启用'); }
export function addressSnapshot(dto: AddressSnapshot): AddressSnapshot {
  const { recipient, phone, provinceCode, province, cityCode, city, districtCode, district, detail } = dto;
  return { recipient, phone, provinceCode, province, cityCode, city, districtCode, district, detail };
}
@Injectable()
export class OrdersService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction, private readonly catalog: CatalogService) {}
  private addressView(a: Address) { return { id: a.id, ...a.snapshot, isDefault: a.isDefault, version: a.version }; }
  async addresses(userId: string, q: PageDto) {
    const [items, total] = await this.db.getRepository(Address).findAndCount({ where: { userId }, order: { isDefault: 'DESC', createdAt: 'DESC', id: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
    return page(items.map(a => this.addressView(a)), total, q);
  }
  saveAddress(actor: Actor, dto: AddressCreateDto | AddressReplaceDto, id?: string) {
    return this.tx.run(actor, async m => {
      const userId = actorId(actor);
      const a = id ? await m.findOneBy(Address, { id, userId }) : m.create(Address, { id: randomUUID(), userId, version: 1 });
      if (!a) throw missing(); if (id) checkVersion(a, (dto as AddressReplaceDto).version);
      const count = await m.countBy(Address, { userId });
      if (!id && count >= 50) conflict('ADDRESS_LIMIT', '最多保存 50 个地址');
      a.snapshot = addressSnapshot(dto);
      a.isDefault = dto.isDefault ?? false;
      if (!count) a.isDefault = true;
      if (a.isDefault) await m.update(Address, { userId, isDefault: true }, { isDefault: false, version: () => 'version + 1', updatedAt: new Date() });
      if (id) touch(a); await m.save(a);
      return this.addressView(a);
    });
  }
  deleteAddress(actor: Actor, id: string, version: number) {
    return this.tx.run(actor, async m => {
      const a = await m.findOneBy(Address, { id, userId: actorId(actor) }); if (!a) throw missing(); checkVersion(a, version);
      await m.delete(Address, id);
      if (a.isDefault) {
        const next = await m.findOne(Address, { where: { userId: actorId(actor) }, order: { createdAt: 'DESC', id: 'DESC' } });
        if (next) { next.isDefault = true; touch(next); await m.save(next); }
      }
      return { success: true };
    });
  }
  /** Order -> products sorted -> SKUs sorted. Product maintenance never locks an order. */
  async lockSkus(m: EntityManager, ids: string[]) {
    const unique = [...new Set(ids)].sort();
    const candidates = await Promise.all(unique.map(id => m.findOneBy(Sku, { id })));
    if (candidates.some(s => !s)) throw missing();
    const products = new Map<string, Product>();
    for (const id of [...new Set(candidates.map(s => s!.productId))].sort()) products.set(id, await this.catalog.lockProduct(m, id));
    const skus = new Map<string, Sku>();
    for (const id of unique) {
      const s = await m.findOne(Sku, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!s) throw missing(); skus.set(id, s);
    }
    return { products, skus };
  }
  private async sellable(m: EntityManager, p: Product, s: Sku, quantity: number) {
    if (p.status !== 'PUBLISHED' || !s.enabled || !await m.existsBy(Category, { id: p.categoryId, enabled: true })) conflict('PRODUCT_UNAVAILABLE', '产品或 SKU 当前不可购买');
    if (s.onHandStock - s.reservedStock < quantity) conflict('STOCK_INSUFFICIENT', '库存不足');
  }
  createQuote(actor: Actor, dto: QuoteDto) {
    return this.tx.run(actor, async m => {
      if (dto.type === 'MEMBERSHIP') {
        if (dto.addressId !== undefined || dto.items !== undefined || dto.courseId !== undefined) throw new ApiException(400, 'VALIDATION_ERROR', '会员订单只能指定会员套餐');
        return membershipQuote(m, actorId(actor), dto.planId!);
      }
      if (dto.planId !== undefined) throw new ApiException(400, 'VALIDATION_ERROR', '非会员订单不能包含会员套餐');
      if (dto.type === 'COURSE') {
        if (dto.addressId !== undefined || dto.items !== undefined) throw new ApiException(400, 'VALIDATION_ERROR', '课程订单不能包含地址或 SKU');
        return courseQuote(m, actorId(actor), dto.courseId!);
      }
      if (dto.courseId !== undefined) throw new ApiException(400, 'VALIDATION_ERROR', '产品订单不能包含课程');
      const lines = dto.items!;
      if (new Set(lines.map(i => i.skuId)).size !== lines.length) throw new ApiException(400, 'VALIDATION_ERROR', 'SKU 不可重复');
      const a = await m.findOneBy(Address, { id: dto.addressId, userId: actorId(actor) }); if (!a) throw missing();
      const { products, skus } = await this.lockSkus(m, lines.map(i => i.skuId));
      const items: ItemSnapshot[] = [];
      for (const line of lines) {
        const s = skus.get(line.skuId)!; const p = products.get(s.productId)!;
        await this.sellable(m, p, s, line.quantity);
        const image = await m.findOneByOrFail(ProductImage, { id: p.coverMediaId });
        items.push({ id: randomUUID(), resourceId: s.id, resourceType: 'SKU', productId: p.id, title: p.name,
          skuAttributes: s.attributes, coverUrl: image.publicUrl, quantity: line.quantity, unitPriceCents: s.priceCents,
          subtotalCents: s.priceCents * line.quantity, refundedQuantity: 0, refundedAmountCents: 0 });
      }
      if (items.reduce((n,i) => n + i.subtotalCents, 0) > 100000000) conflict('ORDER_AMOUNT_LIMIT', '单笔订单金额超过上限');
      const q = m.create(Quote, { id: randomUUID(), type: 'PRODUCT', userId: actorId(actor), address: a.snapshot, items, shippingFeeCents: 0, expiresAt: new Date(Date.now() + 600000) });
      await m.save(q);
      const itemsAmountCents = items.reduce((n,i) => n + i.subtotalCents, 0);
      return { quoteId: q.id, type: 'PRODUCT', items, itemsAmountCents, shippingFeeCents: q.shippingFeeCents,
        payableAmountCents: itemsAmountCents + q.shippingFeeCents, currency: 'CNY', address: q.address, expiresAt: q.expiresAt };
    });
  }
  createOrder(actor: Actor, dto: CreateOrderDto, key?: string) {
    return this.tx.run(actor, async m => {
      const q = await m.findOne(Quote, { where: { id: dto.quoteId, userId: actorId(actor) }, lock: { mode: 'pessimistic_write' } });
      if (!q) throw missing();
      const existing = await m.findOneBy(Order, { quoteId: q.id, userId: actorId(actor) });
      if (existing) return this.view(m, existing);
      if (q.expiresAt.getTime() <= Date.now()) conflict('QUOTE_EXPIRED', '报价已过期，请重新试算');
      if (q.type === 'COURSE') await validateCourseOrder(m, q);
      if (q.type === 'MEMBERSHIP') await validateMembershipOrder(m, q);
      const { products, skus } = q.type === 'PRODUCT' ? await this.lockSkus(m, q.items.map(i => i.resourceId)) : { products: new Map<string, Product>(), skus: new Map<string, Sku>() };
      for (const i of q.type === 'PRODUCT' ? q.items : []) {
        const s = skus.get(i.resourceId)!; await this.sellable(m, products.get(s.productId)!, s, i.quantity);
        if (s.priceCents !== i.unitPriceCents || canonical(s.attributes) !== canonical(i.skuAttributes)) conflict('QUOTE_CHANGED', '价格或规格已变更，请重新试算');
      }
      const id = randomUUID(); const amount = q.items.reduce((n,i) => n + i.subtotalCents, 0);
      const order = m.create(Order, { id, type: q.type, userId: actorId(actor), quoteId: q.id, orderNo: `O${id.replace(/-/g, '')}`,
        status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', afterSaleStatus: 'NONE', address: q.address,
        itemsAmountCents: amount, shippingFeeCents: q.shippingFeeCents, payableAmountCents: amount + q.shippingFeeCents,
        paidAmountCents: 0, refundedAmountCents: 0, paymentDeadlineAt: new Date(Date.now() + 1800000),
        paidAt: null, cancelledAt: null, completedAt: null, cancelReason: null, closedReason: null, version: 1 });
      await m.save(order);
      for (const i of q.items) {
        const { resourceType: _type, ...snapshot } = i;
        await m.save(m.create(OrderItem, { ...snapshot, resourceId: q.type === 'PRODUCT' ? i.resourceId : null,
          courseId: q.type === 'COURSE' ? i.resourceId : null, membershipPlanId: q.type === 'MEMBERSHIP' ? i.resourceId : null,
          membershipSnapshot: q.type === 'MEMBERSHIP' ? i.membershipSnapshot : null, id: randomUUID(), orderId: id }));
        if (q.type === 'PRODUCT') await this.catalog.moveStock(m, skus.get(i.resourceId)!, 0, i.quantity, 'ORDER_RESERVED', actorId(actor), id);
      }
      await this.tx.audit(m, actor, 'order.create', id); return this.view(m, order);
    }, { key, action: 'order.create', body: dto });
  }
  async lockOrder(m: EntityManager, id: string, userId?: string) {
    // Membership scheduling and moderation share the stable user lock before any order lock.
    const candidate = await m.findOneBy(Order, { id, ...(userId ? { userId } : {}) });
    if (!candidate) throw missing();
    if (candidate.type === 'MEMBERSHIP') await m.findOneOrFail(User, { where: { id: candidate.userId }, lock: { mode: 'pessimistic_write' } });
    const o = await m.findOne(Order, { where: { id, ...(userId ? { userId } : {}) }, lock: { mode: 'pessimistic_write' } });
    if (!o) throw missing(); return o;
  }
  items(m: EntityManager, orderId: string) { return m.find(OrderItem, { where: { orderId }, order: { id: 'ASC' } }); }
  async hasActiveAfterSale(m: EntityManager, orderId: string) {
    return m.getRepository(AfterSale).createQueryBuilder('a').where('a.orderId = :orderId', { orderId })
      .andWhere('a.status IN (:...statuses)', { statuses: ACTIVE_AFTERSALES }).getExists();
  }
  async view(m: EntityManager, o: Order, admin = false) {
    const items = (await this.items(m, o.id)).map(i => ({ id: i.id, resourceId: i.membershipPlanId ?? i.courseId ?? i.resourceId, resourceType: i.resourceType, productId: i.productId,
      title: i.title, skuAttributes: i.skuAttributes, coverUrl: i.coverUrl, quantity: i.quantity, unitPriceCents: i.unitPriceCents,
      subtotalCents: i.subtotalCents, refundedQuantity: i.refundedQuantity, refundedAmountCents: i.refundedAmountCents,
      ...(i.membershipSnapshot ? { membershipSnapshot: i.membershipSnapshot } : {}) }));
    const active = o.afterSaleStatus === 'PROCESSING'; const withinWindow = !o.completedAt || Date.now() <= o.completedAt.getTime() + 7 * 86400000;
    const user = admin ? await m.findOneByOrFail(User, { id: o.userId }) : null;
    return { id: o.id, orderNo: o.orderNo, type: o.type, status: o.status, paymentStatus: o.paymentStatus,
      afterSaleStatus: o.afterSaleStatus, items, itemsAmountCents: o.itemsAmountCents, shippingFeeCents: o.shippingFeeCents,
      payableAmountCents: o.payableAmountCents, paidAmountCents: o.paidAmountCents, refundedAmountCents: o.refundedAmountCents,
      currency: 'CNY', paymentDeadlineAt: o.paymentDeadlineAt, paidAt: o.paidAt, createdAt: o.createdAt, address: o.address,
      actions: { canPay: o.status === 'PENDING_PAYMENT' && o.paymentDeadlineAt.getTime() > Date.now(), canCancel: o.status === 'PENDING_PAYMENT',
        canConfirmReceipt: o.status === 'PENDING_RECEIPT' && !active,
        canApplyAfterSale: o.type === 'PRODUCT' && ['PENDING_SHIPMENT', 'PENDING_RECEIPT', 'COMPLETED'].includes(o.status) && !active && withinWindow },
      cancelReason: o.cancelReason, cancelledAt: o.cancelledAt, completedAt: o.completedAt, closedReason: o.closedReason, version: o.version,
      ...(user ? { user: { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl, version: user.version,
        phoneMasked: `${(user.phone.startsWith('+86') ? user.phone.slice(3) : user.phone).slice(0, 3)}****${user.phone.slice(-4)}`,
        status: user.status, membership: await membershipSummary(m, user.id), createdAt: user.createdAt } } : {}) };
  }
  async getOrder(id: string, userId?: string) {
    const o = await this.db.getRepository(Order).findOneBy({ id, ...(userId ? { userId } : {}) }); if (!o) throw missing();
    await this.expireOrder(id);
    return this.db.transaction('REPEATABLE READ', async m => this.view(m, await m.findOneByOrFail(Order, { id }), !userId));
  }
  async list(q: AdminOrderQueryDto, userId?: string) {
    return this.db.transaction('REPEATABLE READ', async m => {
    const b = m.getRepository(Order).createQueryBuilder('o');
    const owner = userId ?? q.userId;
    if (owner) b.andWhere('o.userId = :owner', { owner });
    for (const field of ['type', 'status', 'paymentStatus', 'afterSaleStatus', 'orderNo'] as const) if (q[field]) b.andWhere(`o.${field} = :${field}`, { [field]: q[field] });
    if (q.createdFrom) b.andWhere('o.createdAt >= :from', { from: new Date(q.createdFrom) });
    if (q.createdTo) b.andWhere('o.createdAt <= :to', { to: new Date(q.createdTo) });
    const [items, total] = await b.orderBy('o.createdAt', q.sort === 'createdAt:asc' ? 'ASC' : 'DESC').addOrderBy('o.id', 'DESC').skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
    return page(await Promise.all(items.map(async o => {
      const { address: _address, actions: _actions, cancelReason: _cancel, cancelledAt: _cancelAt,
        completedAt: _completed, closedReason: _closed, version: _version, ...summary } = await this.view(m, o, !userId);
      return summary;
    })), total, q);
    });
  }
  private async release(m: EntityManager, o: Order, operatorId: string) {
    if (o.type !== 'PRODUCT') return;
    const items = await this.items(m, o.id); const { skus } = await this.lockSkus(m, items.map(i => i.resourceId!));
    for (const i of items) await this.catalog.moveStock(m, skus.get(i.resourceId!)!, 0, -(i.quantity - i.refundedQuantity), 'ORDER_RELEASED', operatorId, o.id);
  }
  async expireOrder(id: string) {
    await this.db.transaction('READ COMMITTED', async m => {
      const o = await this.lockOrder(m, id);
      if (o.status !== 'PENDING_PAYMENT' || o.paymentDeadlineAt.getTime() > Date.now()) return;
      await this.release(m, o, o.userId); o.status = 'CANCELLED'; o.cancelledAt = new Date(); o.cancelReason = 'PAYMENT_TIMEOUT'; touch(o); await m.save(o);
    });
  }
  cancel(actor: Actor, id: string, dto: CancelOrderDto, key?: string) {
    return this.tx.run(actor, async m => {
      const o = await this.lockOrder(m, id, actorId(actor)); checkVersion(o, dto.version);
      if (o.status !== 'PENDING_PAYMENT') conflict('ORDER_STATE_INVALID', '只能取消待支付订单');
      await this.release(m, o, actorId(actor)); o.status = 'CANCELLED'; o.cancelReason = dto.reason; o.cancelledAt = new Date(); touch(o); await m.save(o);
      await this.tx.audit(m, actor, 'order.cancel', id); return this.view(m, o);
    }, { key, action: `order.cancel:${id}`, body: dto });
  }
  confirmReceipt(actor: Actor, id: string, dto: VersionDto, key?: string) {
    return this.tx.run(actor, async m => {
      const o = await this.lockOrder(m, id, actorId(actor)); checkVersion(o, dto.version);
      if (o.status !== 'PENDING_RECEIPT' || await this.hasActiveAfterSale(m, id)) conflict('ORDER_STATE_INVALID', '当前不能确认收货');
      o.status = 'COMPLETED'; o.completedAt = new Date(); touch(o); await m.save(o); await this.tx.audit(m, actor, 'order.confirm-receipt', id);
      return this.view(m, o);
    }, { key, action: `order.receipt:${id}`, body: dto });
  }
  async testPay(actor: Actor, id: string, dto: TestPaymentDto, key?: string) {
    testMode();
    return this.tx.run(actor, async m => {
      testMode(); const o = await this.lockOrder(m, id); checkVersion(o, dto.version);
      if (o.status !== 'PENDING_PAYMENT' || o.paymentDeadlineAt.getTime() <= Date.now()) conflict('ORDER_STATE_INVALID', '订单不是有效的待支付订单');
      if (o.type === 'COURSE') await grantCourse(m, o);
      if (o.type === 'MEMBERSHIP') await grantMembership(m, o);
      await m.insert(PaymentRecord, { id: randomUUID(), orderId: id, provider: 'TEST', transactionNo: dto.transactionNo, amountCents: o.payableAmountCents, operatorId: actorId(actor) });
      o.status = o.type !== 'PRODUCT' ? 'COMPLETED' : 'PENDING_SHIPMENT'; o.paymentStatus = 'PAID'; o.paidAmountCents = o.payableAmountCents; o.paidAt = new Date();
      if (o.type !== 'PRODUCT') o.completedAt = o.paidAt;
      touch(o); await m.save(o);
      await this.tx.audit(m, actor, 'payment.test-confirm', id, { transactionNo: dto.transactionNo, amountCents: o.paidAmountCents });
      return this.view(m, o, true);
    }, { key, action: `payment.test:${id}`, body: dto });
  }
  shipmentView(s: Shipment) {
    return { id: s.id, orderId: s.orderId, carrierCode: s.carrierCode, carrierName: s.carrierName, trackingNo: s.trackingNo,
      status: s.status, shippedAt: s.shippedAt, deliveredAt: s.deliveredAt, lastSyncedAt: s.lastSyncedAt, version: s.version, items: s.items };
  }
  ship(actor: Actor, id: string, dto: ShipmentDto, key?: string) {
    return this.tx.run(actor, async m => {
      const name = carrierName(dto.carrierCode); const o = await this.lockOrder(m, id); checkVersion(o, dto.orderVersion);
      if (o.status !== 'PENDING_SHIPMENT' || !['PAID', 'PARTIALLY_REFUNDED'].includes(o.paymentStatus) || await this.hasActiveAfterSale(m, id)) conflict('ORDER_STATE_INVALID', '订单未付款、已发货或存在活跃售后');
      const items = (await this.items(m, id)).filter(i => i.quantity > i.refundedQuantity); if (!items.length) conflict('ORDER_STATE_INVALID', '没有可发货商品');
      const { skus } = await this.lockSkus(m, items.map(i => i.resourceId!));
      for (const i of items) await this.catalog.moveStock(m, skus.get(i.resourceId!)!, -(i.quantity - i.refundedQuantity), -(i.quantity - i.refundedQuantity), 'ORDER_SHIPPED', actorId(actor), id);
      const s = m.create(Shipment, { id: randomUUID(), orderId: id, carrierCode: dto.carrierCode, carrierName: name,
        trackingNo: dto.trackingNo, status: 'PENDING_PICKUP', shippedAt: new Date(), deliveredAt: null, lastSyncedAt: null,
        items: items.map(i => ({ orderItemId: i.id, quantity: i.quantity - i.refundedQuantity })), version: 1 });
      await m.save(s); o.status = 'PENDING_RECEIPT'; touch(o); await m.save(o); await this.tx.audit(m, actor, 'order.ship', id, { shipmentId: s.id });
      return this.shipmentView(s);
    }, { key, action: `order.ship:${id}`, body: dto });
  }
  async logistics(id: string, userId?: string) {
    if (!await this.db.getRepository(Order).existsBy({ id, ...(userId ? { userId } : {}) })) throw missing();
    const s = await this.db.getRepository(Shipment).findOneBy({ orderId: id });
    if (!s) return { shipment: null, events: [], syncStatus: 'NOT_SHIPPED' };
    const events = await this.db.getRepository(LogisticsEvent).find({ where: { shipmentId: s.id }, order: { time: 'DESC', id: 'DESC' }, take: 100 });
    return { shipment: this.shipmentView(s), events: events.map(e => ({ time: e.time, description: e.description, location: e.location, source: e.source })), syncStatus: 'MANUAL' };
  }
  private async lockShipment(m: EntityManager, id: string) {
    const candidate = await m.findOneBy(Shipment, { id }); if (!candidate) throw missing();
    await this.lockOrder(m, candidate.orderId);
    return m.findOneOrFail(Shipment, { where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  patchShipment(actor: Actor, id: string, dto: ShipmentPatchDto) {
    return this.tx.run(actor, async m => {
      const s = await this.lockShipment(m, id); checkVersion(s, dto.version);
      if (s.status !== 'PENDING_PICKUP' || await m.countBy(LogisticsEvent, { shipmentId: id })) conflict('SHIPMENT_STATE_INVALID', '揽收后不能修改运单');
      const oldTrackingNo = s.trackingNo; s.carrierName = carrierName(dto.carrierCode); s.carrierCode = dto.carrierCode; s.trackingNo = dto.trackingNo;
      touch(s); await m.save(s); await this.tx.audit(m, actor, 'shipment.correct', id, { reason: dto.reason, oldTrackingNo, trackingNo: s.trackingNo }); return this.shipmentView(s);
    });
  }
  addLogisticsEvent(actor: Actor, id: string, dto: LogisticsEventDto, key?: string) {
    return this.tx.run(actor, async m => {
      const s = await this.lockShipment(m, id); checkVersion(s, dto.version);
      const latest = await m.findOne(LogisticsEvent, { where: { shipmentId: id }, order: { time: 'DESC' } });
      const time = new Date(dto.time);
      const transitions: Record<string, string[]> = { PENDING_PICKUP: ['IN_TRANSIT', 'EXCEPTION'], IN_TRANSIT: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'], OUT_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'], EXCEPTION: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'], DELIVERED: [] };
      if (!transitions[s.status].includes(dto.status) || time.getTime() < s.shippedAt.getTime() || time.getTime() > Date.now() + 60000 || (latest && time < latest.time)) conflict('SHIPMENT_STATE_INVALID', '物流状态或事件时间不合法');
      await m.insert(LogisticsEvent, { id: randomUUID(), shipmentId: id, time, description: dto.description, location: dto.location ?? null, source: 'MANUAL' });
      s.status = dto.status; if (dto.status === 'DELIVERED') s.deliveredAt = time;
      touch(s); await m.save(s); await this.tx.audit(m, actor, 'shipment.manual-event', id, { status: dto.status }); return this.shipmentView(s);
    }, { key, action: `shipment.event:${id}`, body: dto });
  }
}
