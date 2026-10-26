import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { ItemSnapshot, Order, OrderItem, Quote } from '../commerce/entities';
import { canonical, conflict, missing } from '../commerce/transaction';
import { User } from '../database/entities';
import { MembershipEntitlement, MembershipPlan, MembershipPlanSnapshot, UserMembership } from './entities';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The calling transaction locks User before Order/Plan/Entitlement, including administrative payments. */
async function lockPlan(m: EntityManager, id: string) {
  const plan = await m.findOne(MembershipPlan, { where: { id }, lock: { mode: 'pessimistic_write' } });
  if (!plan) throw missing();
  if (!plan.enabled) conflict('RESOURCE_NOT_SELLABLE', '会员套餐当前不可购买');
  return plan;
}

const snapshot = (plan: MembershipPlan): MembershipPlanSnapshot => ({
  planId: plan.id, name: plan.name, durationDays: plan.durationDays, priceCents: plan.priceCents, benefitCodes: [...plan.benefitCodes],
});

async function lockPeriods(m: EntityManager, userId: string) {
  return m.getRepository(MembershipEntitlement).createQueryBuilder('p').where('p.userId = :userId', { userId })
    .andWhere("(p.status IN ('REFUND_PENDING', 'SUSPENDED') OR (p.status = 'ACTIVE' AND p.expiresAt > :now))", { now: new Date() })
    .orderBy('p.startsAt', 'ASC').addOrderBy('p.createdAt', 'ASC').addOrderBy('p.id', 'ASC')
    .setLock('pessimistic_write').getMany();
}

function noPendingRefund(periods: MembershipEntitlement[]) {
  if (periods.some(p => p.status === 'REFUND_PENDING' || p.status === 'SUSPENDED')) {
    conflict('MEMBERSHIP_REFUND_PENDING', '会员退款处理中，请完成退款后再购买或修改会员期限');
  }
}

async function manualExpiry(m: EntityManager, userId: string, now: number) {
  const manual = await m.findOneBy(UserMembership, { userId });
  return manual && !manual.revokedAt ? Math.max(now, manual.expiresAt.getTime()) : now;
}

function expiresAfter(start: number, durationDays: number) {
  const expiresAt = new Date(start + durationDays * DAY_MS);
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650 ||
    !Number.isFinite(expiresAt.getTime()) || expiresAt.getUTCFullYear() > 9999) {
    conflict('MEMBERSHIP_TERM_INVALID', '会员累计期限超过支持范围');
  }
  return expiresAt;
}

export async function membershipQuote(m: EntityManager, userId: string, planId: string) {
  const plan = await lockPlan(m, planId);
  const items: ItemSnapshot[] = [{ id: randomUUID(), resourceId: plan.id, resourceType: 'MEMBERSHIP_PLAN', productId: null,
    title: plan.name, skuAttributes: [], coverUrl: null, quantity: 1, unitPriceCents: plan.priceCents,
    subtotalCents: plan.priceCents, refundedQuantity: 0, refundedAmountCents: 0, membershipSnapshot: snapshot(plan) }];
  const q = m.create(Quote, { id: randomUUID(), userId, type: 'MEMBERSHIP', address: null, items, shippingFeeCents: 0,
    expiresAt: new Date(Date.now() + 600000) });
  await m.save(q);
  return { quoteId: q.id, type: q.type, items, itemsAmountCents: plan.priceCents, shippingFeeCents: 0,
    payableAmountCents: plan.priceCents, currency: 'CNY', address: null, expiresAt: q.expiresAt };
}

export async function validateMembershipOrder(m: EntityManager, q: Quote) {
  const item = q.items[0];
  if (q.items.length !== 1 || !item || item.resourceType !== 'MEMBERSHIP_PLAN' || item.quantity !== 1 ||
    q.shippingFeeCents !== 0 || q.address !== null || !item.membershipSnapshot) {
    conflict('QUOTE_CHANGED', '会员试算信息已失效，请重新试算');
  }
  const plan = await lockPlan(m, item.resourceId);
  if (canonical(snapshot(plan)) !== canonical(item.membershipSnapshot) || plan.priceCents !== item.unitPriceCents ||
    item.subtotalCents !== item.unitPriceCents) conflict('QUOTE_CHANGED', '会员套餐已变更，请重新试算');
  const pending = await m.getRepository(Order).createQueryBuilder('o')
    .innerJoin(OrderItem, 'i', 'i.orderId = o.id')
    .where('o.userId = :userId AND i.membershipPlanId = :planId', { userId: q.userId, planId: plan.id })
    .andWhere("o.type = 'MEMBERSHIP' AND o.status = 'PENDING_PAYMENT' AND o.paymentDeadlineAt > :now", { now: new Date() })
    .getExists();
  if (pending) conflict('MEMBERSHIP_ORDER_PENDING', '该套餐已有待付款订单，请继续付款或先取消');
}

/** Payment and entitlement insertion commit together. Paid duration is the immutable order snapshot. */
export async function grantMembership(m: EntityManager, o: Order) {
  const existing = await m.findOneBy(MembershipEntitlement, { orderId: o.id });
  if (existing) return existing;
  if (!await m.existsBy(User, { id: o.userId, status: 'ACTIVE' })) conflict('ACCOUNT_UNAVAILABLE', '该用户当前不可开通会员');
  const item = await m.findOneByOrFail(OrderItem, { orderId: o.id });
  if (!item.membershipPlanId || !item.membershipSnapshot || item.membershipSnapshot.planId !== item.membershipPlanId ||
    item.membershipSnapshot.priceCents !== o.payableAmountCents) conflict('MEMBERSHIP_ORDER_INVALID', '会员订单信息无效');
  await lockPlan(m, item.membershipPlanId);
  const periods = await lockPeriods(m, o.userId); noPendingRefund(periods);
  const now = Date.now();
  const startsAt = Math.max(await manualExpiry(m, o.userId, now), ...periods
    .filter(p => p.status === 'ACTIVE' && !p.revokedAt).map(p => p.expiresAt.getTime()));
  const period = m.create(MembershipEntitlement, { id: randomUUID(), userId: o.userId, planId: item.membershipPlanId,
    orderId: o.id, snapshot: item.membershipSnapshot, startsAt: new Date(startsAt),
    expiresAt: expiresAfter(startsAt, item.membershipSnapshot.durationDays), status: 'ACTIVE', revokedAt: null });
  return m.save(period);
}

/** Manual changes cannot silently overwrite paid rights or disturb the refund queue. */
export async function assertManualMembershipWritable(m: EntityManager, userId: string) {
  const periods = await lockPeriods(m, userId);
  if (periods.some(p => p.status === 'REFUND_PENDING' || p.status === 'SUSPENDED' ||
    (p.status === 'ACTIVE' && !p.revokedAt && p.expiresAt.getTime() > Date.now()))) {
    conflict('MEMBERSHIP_PAID_TERM_EXISTS', '已有付费会员期限，不能直接修改或撤销；请通过对应订单办理退款');
  }
}

/** Only an entirely unused future purchase can receive a full digital refund. */
export async function requestMembershipRefund(m: EntityManager, o: Order) {
  const periods = await lockPeriods(m, o.userId); noPendingRefund(periods);
  const target = periods.find(p => p.orderId === o.id);
  const now = Date.now();
  if (!target || target.status !== 'ACTIVE' || target.revokedAt || target.startsAt.getTime() <= now) {
    conflict('MEMBERSHIP_REFUND_NOT_ALLOWED', '仅支持尚未开始的会员购买时段全额退款');
  }
  // Freeze all not-yet-started purchases so an asynchronous refund cannot consume
  // the requested segment or let later purchases start before the queue is rebuilt.
  const future = periods.filter(p => p.status === 'ACTIVE' && !p.revokedAt && p.startsAt.getTime() > now);
  for (const p of future) p.status = p.id === target.id ? 'REFUND_PENDING' : 'SUSPENDED';
  await m.save(future);
  return target;
}

export async function settleMembershipRefund(m: EntityManager, o: Order, result: 'SUCCEEDED' | 'FAILED') {
  const periods = await lockPeriods(m, o.userId);
  const target = periods.find(p => p.orderId === o.id);
  if (!target || target.status !== 'REFUND_PENDING') conflict('MEMBERSHIP_REFUND_INVALID', '会员退款状态已变更');
  const now = Date.now();
  target.status = result === 'SUCCEEDED' ? 'REVOKED' : 'SUSPENDED';
  target.revokedAt = result === 'SUCCEEDED' ? new Date(now) : null;
  const changed = periods.filter(p => p.id === target.id || p.status === 'SUSPENDED');
  // Already-started ACTIVE segments retain their original bounds. Suspended
  // segments resume with their full purchased duration, in original queue order.
  let cursor = Math.max(await manualExpiry(m, o.userId, now), ...periods
    .filter(p => p.status === 'ACTIVE' && !p.revokedAt).map(p => p.expiresAt.getTime()));
  for (const p of periods.filter(p => p.status === 'SUSPENDED')) {
    p.startsAt = new Date(cursor); p.expiresAt = expiresAfter(cursor, p.snapshot.durationDays);
    p.status = 'ACTIVE'; p.revokedAt = null; cursor = p.expiresAt.getTime();
  }
  await m.save(changed);
  return target;
}
