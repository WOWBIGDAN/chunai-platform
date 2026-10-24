import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../common/http';
import { AdminAfterSaleQueryDto, AfterSaleCreateDto, RefundQueryDto, ReturnReceiptDto, ReturnShipmentDto, ReviewDto, TestRefundDto, VersionDto } from './commerce.dto';
import { ACTIVE_AFTERSALES, AfterSale, AfterSaleItem, Order, OrderItem, PaymentRecord, Refund } from './entities';
import { Actor, actorId, CommerceTransaction, checkVersion, conflict, missing, page, touch } from './transaction';
import { OrdersService, addressSnapshot, carrierName, testMode } from './orders.service';
import { CatalogService } from './catalog.service';

@Injectable()
export class AfterSalesService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction,
    private readonly orders: OrdersService, private readonly catalog: CatalogService) {}
  async view(m: EntityManager, a: AfterSale) {
    const items = await m.find(AfterSaleItem, { where: { afterSaleId: a.id }, order: { id: 'ASC' } });
    return { id: a.id, afterSaleNo: a.afterSaleNo, orderId: a.orderId, type: a.type, status: a.status,
      items: items.map(i => ({ orderItemId: i.orderItemId, quantity: i.quantity, refundAmountCents: i.refundAmountCents })),
      itemsRefundAmountCents: a.itemsRefundAmountCents, shippingRefundAmountCents: a.shippingRefundAmountCents, refundAmountCents: a.refundAmountCents,
      reasonCode: a.reasonCode, description: a.description, evidence: [], reviewNote: a.reviewNote, returnDeadlineAt: a.returnDeadlineAt,
      ...(a.returnAddress ? { returnAddress: a.returnAddress } : {}), ...(a.returnShipment ? { returnShipment: a.returnShipment } : {}),
      refundId: a.refundId, createdAt: a.createdAt, updatedAt: a.updatedAt, version: a.version };
  }
  async summary(m: EntityManager, o: Order) {
    const active = await this.orders.hasActiveAfterSale(m, o.id);
    o.afterSaleStatus = active ? 'PROCESSING' : o.refundedAmountCents === o.paidAmountCents && o.paidAmountCents > 0 ? 'COMPLETED'
      : o.refundedAmountCents > 0 ? 'PARTIALLY_COMPLETED' : 'NONE';
    touch(o); await m.save(o);
  }
  async create(actor: Actor, dto: AfterSaleCreateDto, key?: string) {
    return this.tx.run(actor, async m => {
      if (dto.evidenceMediaIds?.length) throw new ApiException(503, 'EVIDENCE_STORAGE_UNAVAILABLE', '私有凭证存储尚未配置，请先使用文字说明');
      if (new Set(dto.items.map(i => i.orderItemId)).size !== dto.items.length) throw new ApiException(400, 'VALIDATION_ERROR', '售后订单行不可重复');
      const o = await this.orders.lockOrder(m, dto.orderId, actorId(actor));
      if (!['PENDING_SHIPMENT', 'PENDING_RECEIPT', 'COMPLETED'].includes(o.status) || !['PAID', 'PARTIALLY_REFUNDED'].includes(o.paymentStatus)) conflict('AFTERSALE_NOT_ELIGIBLE', '当前订单不能申请售后');
      if (o.completedAt && Date.now() > o.completedAt.getTime() + 7 * 86400000) conflict('AFTERSALE_WINDOW_EXPIRED', '已超过确认收货后七天的申请时限');
      if ((o.status === 'PENDING_SHIPMENT' ? 'REFUND_ONLY' : 'RETURN_REFUND') !== dto.type) conflict('AFTERSALE_TYPE_INVALID', '未发货仅退款，发货后须退货退款');
      if (await this.orders.hasActiveAfterSale(m, o.id)) conflict('AFTERSALE_ACTIVE', '订单已有进行中的售后申请');
      const ordered = await this.orders.items(m, o.id); const lines: AfterSaleItem[] = [];
      const id = randomUUID();
      for (const line of dto.items) {
        const item = ordered.find(i => i.id === line.orderItemId);
        if (!item) throw missing();
        if (line.quantity > item.quantity - item.refundedQuantity) conflict('AFTERSALE_QUANTITY_EXCEEDED', '申请数量超过剩余可售后数量');
        lines.push(m.create(AfterSaleItem, { id: randomUUID(), afterSaleId: id, orderItemId: item.id,
          quantity: line.quantity, refundAmountCents: line.quantity * item.unitPriceCents }));
      }
      const itemsAmount = lines.reduce((n,i) => n + i.refundAmountCents, 0);
      const allRemaining = ordered.every(i => i.refundedQuantity + (dto.items.find(l => l.orderItemId === i.id)?.quantity ?? 0) === i.quantity);
      const shippingAmount = allRemaining ? o.shippingFeeCents : 0;
      if (itemsAmount + shippingAmount > o.paidAmountCents - o.refundedAmountCents) conflict('REFUND_AMOUNT_EXCEEDED', '退款超过剩余实付金额');
      const a = m.create(AfterSale, { id, userId: actorId(actor), orderId: o.id, afterSaleNo: `AS${id.replace(/-/g, '')}`,
        type: dto.type, status: 'PENDING_REVIEW', itemsRefundAmountCents: itemsAmount, shippingRefundAmountCents: shippingAmount,
        refundAmountCents: itemsAmount + shippingAmount, reasonCode: dto.reasonCode, description: dto.description,
        reviewNote: null, returnDeadlineAt: null, returnAddress: null, returnShipment: null, refundId: null, version: 1 });
      await m.save(a); await m.save(lines); await this.summary(m, o); await this.tx.audit(m, actor, 'aftersale.create', id);
      return this.view(m, a);
    }, { key, action: 'aftersale.create', body: dto });
  }
  async lock(m: EntityManager, id: string, userId?: string) {
    const candidate = await m.findOneBy(AfterSale, { id, ...(userId ? { userId } : {}) }); if (!candidate) throw missing();
    const order = await this.orders.lockOrder(m, candidate.orderId, userId);
    const sale = await m.findOneOrFail(AfterSale, { where: { id }, lock: { mode: 'pessimistic_write' } });
    return { order, sale };
  }
  async get(id: string, userId?: string) {
    const a = await this.db.getRepository(AfterSale).findOneBy({ id, ...(userId ? { userId } : {}) }); if (!a) throw missing();
    await this.expire(id);
    return this.db.transaction('REPEATABLE READ', async m => this.view(m, await m.findOneByOrFail(AfterSale, { id })));
  }
  async list(q: AdminAfterSaleQueryDto, userId?: string) {
    return this.db.transaction('REPEATABLE READ', async m => {
    const b = m.getRepository(AfterSale).createQueryBuilder('a'); const owner = userId ?? q.userId;
    if (owner) b.andWhere('a.userId = :owner', { owner });
    if (q.orderId) b.andWhere('a.orderId = :orderId', { orderId: q.orderId });
    if (q.status) b.andWhere('a.status = :status', { status: q.status });
    if (q.createdFrom) b.andWhere('a.createdAt >= :from', { from: new Date(q.createdFrom) });
    if (q.createdTo) b.andWhere('a.createdAt <= :to', { to: new Date(q.createdTo) });
    const [items, total] = await b.orderBy('a.createdAt', 'DESC').addOrderBy('a.id', 'DESC').skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
    return page(await Promise.all(items.map(a => this.view(m, a))), total, q);
    });
  }
  cancel(actor: Actor, id: string, dto: VersionDto, key?: string) {
    return this.tx.run(actor, async m => {
      const { order: o, sale: a } = await this.lock(m, id, actorId(actor)); checkVersion(a, dto.version);
      if (!['PENDING_REVIEW', 'AWAITING_RETURN'].includes(a.status)) conflict('AFTERSALE_STATE_INVALID', '当前售后不能撤销');
      a.status = 'CANCELLED'; touch(a); await m.save(a); await this.summary(m, o); await this.tx.audit(m, actor, 'aftersale.cancel', id);
      return this.view(m, a);
    }, { key, action: `aftersale.cancel:${id}`, body: dto });
  }
  async expire(id: string) {
    await this.db.transaction('READ COMMITTED', async m => {
      const { order: o, sale: a } = await this.lock(m, id);
      if (a.status !== 'AWAITING_RETURN' || !a.returnDeadlineAt || a.returnDeadlineAt.getTime() > Date.now()) return;
      a.status = 'CLOSED'; a.reviewNote = 'RETURN_TIMEOUT'; touch(a); await m.save(a); await this.summary(m, o);
    });
  }
  private async beginRefund(m: EntityManager, a: AfterSale, o: Order) {
    const payment = await m.findOneBy(PaymentRecord, { orderId: o.id });
    if (!payment) conflict('PAYMENT_RECORD_MISSING', '订单没有可退款的支付记录');
    if (payment.provider !== 'TEST') throw new ApiException(503, 'REFUND_PROVIDER_UNAVAILABLE', '退款服务未配置');
    const r = m.create(Refund, { id: randomUUID(), orderId: o.id, afterSaleId: a.id, paymentId: payment.id,
      amountCents: a.refundAmountCents, status: 'PROCESSING', failureCode: null, completedAt: null });
    await m.save(r); a.refundId = r.id; a.status = 'REFUNDING';
  }
  review(actor: Actor, id: string, dto: ReviewDto, key?: string) {
    return this.tx.run(actor, async m => {
      const { order: o, sale: a } = await this.lock(m, id); checkVersion(a, dto.version);
      if (a.status !== 'PENDING_REVIEW') conflict('AFTERSALE_STATE_INVALID', '只能审核待审核售后');
      a.reviewNote = dto.note;
      if (dto.decision === 'REJECT') a.status = 'REJECTED';
      else if (a.type === 'REFUND_ONLY') await this.beginRefund(m, a, o);
      else {
        if (!dto.returnAddress) throw new ApiException(400, 'RETURN_ADDRESS_REQUIRED', '批准退货必须提供退货地址');
        a.returnAddress = addressSnapshot(dto.returnAddress); a.returnDeadlineAt = new Date(Date.now() + 7 * 86400000); a.status = 'AWAITING_RETURN';
      }
      touch(a); await m.save(a); await this.summary(m, o); await this.tx.audit(m, actor, 'aftersale.review', id, { decision: dto.decision, note: dto.note });
      return this.view(m, a);
    }, { key, action: `aftersale.review:${id}`, body: dto });
  }
  returnShipment(actor: Actor, id: string, dto: ReturnShipmentDto, key?: string) {
    return this.tx.run(actor, async m => {
      const { order: o, sale: a } = await this.lock(m, id, actorId(actor)); checkVersion(a, dto.version); carrierName(dto.carrierCode);
      if (a.status !== 'AWAITING_RETURN' || !a.returnDeadlineAt || a.returnDeadlineAt.getTime() <= Date.now()) conflict('AFTERSALE_STATE_INVALID', '不在可提交退货物流期限内');
      a.returnShipment = { carrierCode: dto.carrierCode, trackingNo: dto.trackingNo, submittedAt: new Date().toISOString() }; a.status = 'RETURNING';
      touch(a); await m.save(a); await this.summary(m, o); await this.tx.audit(m, actor, 'aftersale.return-shipment', id); return this.view(m, a);
    }, { key, action: `aftersale.return:${id}`, body: dto });
  }
  confirmReturn(actor: Actor, id: string, dto: ReturnReceiptDto, key?: string) {
    return this.tx.run(actor, async m => {
      const { order: o, sale: a } = await this.lock(m, id); checkVersion(a, dto.version);
      if (a.status !== 'RETURNING') conflict('AFTERSALE_STATE_INVALID', '只能验收已提交退货物流的申请');
      a.reviewNote = dto.note; await this.beginRefund(m, a, o); touch(a); await m.save(a); await this.summary(m, o);
      await this.tx.audit(m, actor, 'aftersale.confirm-return', id, { note: dto.note, restocked: false }); return this.view(m, a);
    }, { key, action: `aftersale.receipt:${id}`, body: dto });
  }
  retryRefund(actor: Actor, id: string, dto: VersionDto, key?: string) {
    return this.tx.run(actor, async m => {
      const { order: o, sale: a } = await this.lock(m, id); checkVersion(a, dto.version);
      if (a.status !== 'REFUND_FAILED' || !a.refundId) conflict('AFTERSALE_STATE_INVALID', '只能重试已失败的退款');
      const r = await m.findOneOrFail(Refund, { where: { id: a.refundId }, lock: { mode: 'pessimistic_write' } });
      if (r.status !== 'FAILED') conflict('REFUND_STATE_INVALID', '退款状态已经改变');
      const payment = await m.findOneByOrFail(PaymentRecord, { id: r.paymentId });
      if (payment.provider !== 'TEST') throw new ApiException(503, 'REFUND_PROVIDER_UNAVAILABLE', '真实退款重试必须先查询服务商');
      r.status = 'PROCESSING'; r.failureCode = null; await m.save(r); a.status = 'REFUNDING'; touch(a); await m.save(a); await this.summary(m, o);
      await this.tx.audit(m, actor, 'aftersale.retry-refund', id, { refundId: r.id }); return this.view(m, a);
    }, { key, action: `aftersale.retry:${id}`, body: dto });
  }
  refundView(r: Refund) { return { id: r.id, orderId: r.orderId, afterSaleId: r.afterSaleId, reasonType: 'AFTERSALE', amountCents: r.amountCents,
    status: r.status, failureCode: r.failureCode, createdAt: r.createdAt, completedAt: r.completedAt }; }
  async refunds(q: RefundQueryDto, orderId?: string, userId?: string) {
    if (userId && (!orderId || !await this.db.getRepository(Order).existsBy({ id: orderId, userId }))) throw missing();
    const b = this.db.getRepository(Refund).createQueryBuilder('r');
    if (orderId ?? q.orderId) b.andWhere('r.orderId = :id', { id: orderId ?? q.orderId });
    if (q.status) b.andWhere('r.status = :status', { status: q.status });
    if (q.createdFrom) b.andWhere('r.createdAt >= :from', { from: new Date(q.createdFrom) });
    if (q.createdTo) b.andWhere('r.createdAt <= :to', { to: new Date(q.createdTo) });
    const [items, total] = await b.orderBy('r.createdAt', 'DESC').addOrderBy('r.id', 'DESC').skip((q.page - 1) * q.pageSize).take(q.pageSize).getManyAndCount();
    return page(items.map(r => this.refundView(r)), total, q);
  }
  testRefund(actor: Actor, id: string, dto: TestRefundDto, key?: string) {
    testMode();
    return this.tx.run(actor, async m => {
      testMode(); const candidate = await m.findOneBy(Refund, { id }); if (!candidate) throw missing();
      const { order: o, sale: a } = await this.lock(m, candidate.afterSaleId); checkVersion(a, dto.version);
      const r = await m.findOneOrFail(Refund, { where: { id }, lock: { mode: 'pessimistic_write' } });
      const payment = await m.findOneByOrFail(PaymentRecord, { id: r.paymentId });
      if (payment.provider !== 'TEST' || r.status !== 'PROCESSING' || a.status !== 'REFUNDING') conflict('REFUND_STATE_INVALID', '退款不在可确认的测试状态');
      r.status = dto.result;
      if (dto.result === 'FAILED') { r.failureCode = 'TEST_FAILURE'; a.status = 'REFUND_FAILED'; }
      else {
        if (o.refundedAmountCents + r.amountCents > o.paidAmountCents) conflict('REFUND_AMOUNT_EXCEEDED', '退款超过合法成交金额');
        const lines = await m.findBy(AfterSaleItem, { afterSaleId: a.id });
        const items = await this.orders.items(m, o.id);
        const skus = a.type === 'REFUND_ONLY' ? (await this.orders.lockSkus(m, lines.map(l => items.find(i => i.id === l.orderItemId)!.resourceId))).skus : null;
        for (const line of lines) {
          const item = items.find(i => i.id === line.orderItemId)!;
          if (item.refundedQuantity + line.quantity > item.quantity) conflict('AFTERSALE_QUANTITY_EXCEEDED', '重复退款数量');
          item.refundedQuantity += line.quantity; item.refundedAmountCents += line.refundAmountCents; await m.save(OrderItem, item);
          if (skus) await this.catalog.moveStock(m, skus.get(item.resourceId)!, 0, -line.quantity, 'REFUND_RELEASED', actorId(actor), o.id);
        }
        o.refundedAmountCents += r.amountCents; o.paymentStatus = o.refundedAmountCents === o.paidAmountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        if (o.paymentStatus === 'REFUNDED') { o.status = 'CLOSED'; o.closedReason = 'FULL_REFUND'; }
        r.completedAt = new Date(); r.failureCode = null; a.status = 'COMPLETED';
      }
      await m.save(r); touch(a); await m.save(a); await this.summary(m, o);
      await this.tx.audit(m, actor, 'refund.test-confirm', id, { result: dto.result, amountCents: r.amountCents }); return this.refundView(r);
    }, { key, action: `refund.test:${id}`, body: dto });
  }
}
