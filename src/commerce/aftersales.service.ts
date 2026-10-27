import { Injectable } from '@nestjs/common';
import { requestMembershipRefund, settleMembershipRefund } from '../membership/membership-purchase';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../common/http';
import { AdminAfterSaleQueryDto, AfterSaleCreateDto, DigitalRefundDto, RefundQueryDto, ReturnReceiptDto, ReturnShipmentDto, ReviewDto, TestRefundDto, VersionDto } from './commerce.dto';
import { CourseEntitlement } from '../content/entities';
import { lockCourse } from '../content/course-purchase';
import { ACTIVE_AFTERSALES, AfterSale, AfterSaleItem, Order, OrderItem, PaymentRecord, Refund } from './entities';
import { Actor, actorId, CommerceTransaction, checkVersion, conflict, missing, page, touch } from './transaction';
import { OrdersService, addressSnapshot, carrierName, testMode } from './orders.service';
import { CatalogService } from './catalog.service';
import { afterSaleEvidence, bindAfterSaleEvidence } from '../uploads/references';
import { deliverMessage } from '../messages/delivery';

@Injectable()
export class AfterSalesService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction,
    private readonly orders: OrdersService, private readonly catalog: CatalogService) {}
  async view(m: EntityManager, a: AfterSale) {
    const items = await m.find(AfterSaleItem, { where: { afterSaleId: a.id }, order: { id: 'ASC' } });
    return { id: a.id, afterSaleNo: a.afterSaleNo, orderId: a.orderId, type: a.type, status: a.status,
      items: items.map(i => ({ orderItemId: i.orderItemId, quantity: i.quantity, refundAmountCents: i.refundAmountCents })),
      itemsRefundAmountCents: a.itemsRefundAmountCents, shippingRefundAmountCents: a.shippingRefundAmountCents, refundAmountCents: a.refundAmountCents,
      reasonCode: a.reasonCode, description: a.description, evidence: await afterSaleEvidence(m, a.id), reviewNote: a.reviewNote, returnDeadlineAt: a.returnDeadlineAt,
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
      if (new Set(dto.items.map(i => i.orderItemId)).size !== dto.items.length) throw new ApiException(400, 'VALIDATION_ERROR', '售后订单行不可重复');
      const o = await this.orders.lockOrder(m, dto.orderId, actorId(actor));
      if (o.type !== 'PRODUCT') conflict('ORDER_TYPE_INVALID', '数字订单退款需由管理员发起');
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
      await m.save(a); await m.save(lines);
      await bindAfterSaleEvidence(m, actor, a.id, a.userId, dto.evidenceMediaIds ?? []);
      await this.summary(m, o); await this.tx.audit(m, actor, 'aftersale.create', id);
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
      await deliverMessage(m, { userId: a.userId, eventKey: `aftersale:${a.id}:return-timeout`, category: 'AFTERSALE',
        title: '售后申请已超时关闭', body: '未在规定时间内提交退货物流，售后申请已关闭。详情请查看售后记录。',
        resourceType: 'AFTERSALE', resourceId: a.id });
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
      await deliverMessage(m, { userId: a.userId, eventKey: `aftersale:${a.id}:reviewed`, category: 'AFTERSALE',
        title: dto.decision === 'REJECT' ? '售后申请未通过' : '售后申请已通过',
        body: dto.decision === 'REJECT' ? '售后申请未通过审核，请在售后详情查看审核说明。' : a.type === 'REFUND_ONLY'
          ? '售后申请已通过审核，退款正在处理中。' : '退货申请已通过审核，请在七天内按售后详情中的要求寄回商品并提交退货物流。',
        resourceType: 'AFTERSALE', resourceId: a.id });
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
      await this.tx.audit(m, actor, 'aftersale.confirm-return', id, { note: dto.note, restocked: false });
      await deliverMessage(m, { userId: a.userId, eventKey: `aftersale:${a.id}:return-accepted`, category: 'AFTERSALE',
        title: '退货已验收', body: '退回商品已验收，退款正在处理中。', resourceType: 'AFTERSALE', resourceId: a.id });
      return this.view(m, a);
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
      await this.tx.audit(m, actor, 'aftersale.retry-refund', id, { refundId: r.id });
      await deliverMessage(m, { userId: a.userId, eventKey: `aftersale:${a.id}:refund-retry:${a.version}`, category: 'AFTERSALE',
        title: '退款已重新处理', body: '管理员已重新处理退款，请等待处理结果。', resourceType: 'AFTERSALE', resourceId: a.id });
      return this.view(m, a);
    }, { key, action: `aftersale.retry:${id}`, body: dto });
  }
  refundView(r: Refund) { return { id: r.id, orderId: r.orderId, afterSaleId: r.afterSaleId, reasonType: r.afterSaleId ? 'AFTERSALE' : 'DIGITAL_ORDER', amountCents: r.amountCents,
    status: r.status, failureCode: r.failureCode, createdAt: r.createdAt, completedAt: r.completedAt, version: r.version }; }
  digitalRefund(actor: Actor, id: string, dto: DigitalRefundDto, key?: string) {
    return this.tx.run(actor, async m => {
      const o = await this.orders.lockOrder(m, id); checkVersion(o, dto.orderVersion);
      if (!['COURSE', 'MEMBERSHIP'].includes(o.type) || o.status !== 'COMPLETED' || o.paymentStatus !== 'PAID' || o.refundedAmountCents !== 0) conflict('DIGITAL_REFUND_NOT_ELIGIBLE', '仅可对符合条件的已付款数字订单全额退款');
      const payment = await m.findOneByOrFail(PaymentRecord, { orderId: id });
      if (payment.provider !== 'TEST') throw new ApiException(503, 'REFUND_PROVIDER_UNAVAILABLE', '真实退款渠道尚未接入');
      let r = await m.findOneBy(Refund, { orderId: id });
      if (r && r.status !== 'FAILED') conflict('REFUND_STATE_INVALID', '订单已有退款');
      if (o.type === 'MEMBERSHIP') await requestMembershipRefund(m, o);
      if (r) { r.status = 'PROCESSING'; r.failureCode = null; r.version++; }
      else r = m.create(Refund, { id: randomUUID(), orderId: id, afterSaleId: null, paymentId: payment.id, amountCents: o.paidAmountCents, status: 'PROCESSING', failureCode: null, completedAt: null, version: 1 });
      await m.save(r); o.afterSaleStatus = 'PROCESSING'; touch(o); await m.save(o);
      await this.tx.audit(m, actor, `${o.type === 'MEMBERSHIP' ? 'membership' : 'course'}.refund-request`, id, { refundId: r.id, reason: dto.reason });
      await deliverMessage(m, { userId: o.userId, eventKey: `refund:${r.id}:requested:${r.version}`, category: 'AFTERSALE',
        title: '订单退款处理中', body: '管理员已发起订单退款，请在订单详情查看处理进度。', resourceType: 'ORDER', resourceId: o.id });
      return this.refundView(r);
    }, { key, action: `course.refund:${id}`, body: dto });
  }
  private async confirmDigitalRefund(m: EntityManager, actor: Actor, candidate: Refund, dto: TestRefundDto) {
    const o = await this.orders.lockOrder(m, candidate.orderId);
    const r = await m.findOneOrFail(Refund, { where: { id: candidate.id }, lock: { mode: 'pessimistic_write' } });
    if (r.version !== dto.version) conflict('VERSION_CONFLICT', '退款数据已更新');
    const payment = await m.findOneByOrFail(PaymentRecord, { id: r.paymentId });
    if (!['COURSE', 'MEMBERSHIP'].includes(o.type) || payment.provider !== 'TEST' || r.status !== 'PROCESSING' || o.paymentStatus !== 'PAID') conflict('REFUND_STATE_INVALID', '退款不在可确认状态');
    if (o.type === 'MEMBERSHIP') await settleMembershipRefund(m, o, dto.result);
    if (dto.result === 'SUCCEEDED') {
      if (o.type === 'COURSE') {
        const entitlement = await m.findOneByOrFail(CourseEntitlement, { orderId: o.id, status: 'ACTIVE' });
        await lockCourse(m, entitlement.courseId);
        entitlement.status = 'REVOKED'; entitlement.revokedAt = new Date(); await m.save(entitlement);
      }
      for (const item of await this.orders.items(m, o.id)) { item.refundedQuantity = item.quantity; item.refundedAmountCents = item.subtotalCents; await m.save(item); }
      o.refundedAmountCents = r.amountCents; o.paymentStatus = 'REFUNDED'; o.afterSaleStatus = 'COMPLETED'; o.status = 'CLOSED'; o.closedReason = 'FULL_REFUND';
      r.completedAt = new Date(); r.failureCode = null;
    } else { r.failureCode = 'TEST_FAILURE'; }
    r.status = dto.result; r.version++; await m.save(r); touch(o); await m.save(o);
    await this.tx.audit(m, actor, `${o.type === 'MEMBERSHIP' ? 'membership' : 'course'}.refund-test-confirm`, r.id, { result: dto.result, amountCents: r.amountCents });
    await deliverMessage(m, { userId: o.userId, eventKey: `refund:${r.id}:result:${r.version}`, category: 'AFTERSALE',
      title: dto.result === 'SUCCEEDED' ? '订单退款已完成' : '订单退款处理失败',
      body: dto.result === 'SUCCEEDED' ? '订单退款流程已完成，该订单对应的购买权益已撤销。详情请查看订单。' : '订单退款处理失败，请在订单详情查看结果并联系管理员处理。',
      resourceType: 'ORDER', resourceId: o.id });
    return this.refundView(r);
  }
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
      if (!candidate.afterSaleId) return this.confirmDigitalRefund(m, actor, candidate, dto);
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
        const skus = a.type === 'REFUND_ONLY' ? (await this.orders.lockSkus(m, lines.map(l => items.find(i => i.id === l.orderItemId)!.resourceId!))).skus : null;
        for (const line of lines) {
          const item = items.find(i => i.id === line.orderItemId)!;
          if (item.refundedQuantity + line.quantity > item.quantity) conflict('AFTERSALE_QUANTITY_EXCEEDED', '重复退款数量');
          item.refundedQuantity += line.quantity; item.refundedAmountCents += line.refundAmountCents; await m.save(OrderItem, item);
          if (skus) await this.catalog.moveStock(m, skus.get(item.resourceId!)!, 0, -line.quantity, 'REFUND_RELEASED', actorId(actor), o.id);
        }
        o.refundedAmountCents += r.amountCents; o.paymentStatus = o.refundedAmountCents === o.paidAmountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        if (o.paymentStatus === 'REFUNDED') { o.status = 'CLOSED'; o.closedReason = 'FULL_REFUND'; }
        r.completedAt = new Date(); r.failureCode = null; a.status = 'COMPLETED';
      }
      r.version++; await m.save(r); touch(a); await m.save(a); await this.summary(m, o);
      await this.tx.audit(m, actor, 'refund.test-confirm', id, { result: dto.result, amountCents: r.amountCents });
      await deliverMessage(m, { userId: a.userId, eventKey: `refund:${r.id}:result:${r.version}`, category: 'AFTERSALE',
        title: dto.result === 'SUCCEEDED' ? '售后退款已完成' : '售后退款处理失败',
        body: dto.result === 'SUCCEEDED' ? '售后退款流程已完成，请在售后详情查看处理结果。' : '售后退款处理失败，请在售后详情查看结果并联系管理员处理。',
        resourceType: 'AFTERSALE', resourceId: a.id });
      return this.refundView(r);
    }, { key, action: `refund.test:${id}`, body: dto });
  }
}
