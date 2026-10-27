import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { Category, ItemSnapshot, Order, OrderItem, Quote } from '../commerce/entities';
import { conflict, missing } from '../commerce/transaction';
import { Content, ContentMedia, CourseEntitlement, isCourse } from './entities';

/** Called inside the existing order/payment transaction; serialize all sales for a course. */
export async function lockCourse(m: EntityManager, id: string) {
  const c = await m.findOne(Content, { where: { id }, lock: { mode: 'pessimistic_write' } });
  if (!c || !isCourse(c.kind)) throw missing(); return c;
}
export async function courseSellable(m: EntityManager, c: Content, userId: string) {
  if (c.status !== 'PUBLISHED' || c.accessPolicy !== 'PURCHASE' || c.priceCents <= 0 || !await m.existsBy(Category, { id: c.categoryId, scope: 'COURSE', enabled: true })) conflict('RESOURCE_NOT_SELLABLE', '课程不可购买');
  if (await m.existsBy(CourseEntitlement, { userId, courseId: c.id, status: 'ACTIVE' })) conflict('COURSE_ALREADY_PURCHASED', '已拥有该课程');
}
export async function courseQuote(m: EntityManager, userId: string, id: string) {
  const c = await lockCourse(m, id); await courseSellable(m, c, userId);
  const image = await m.findOneByOrFail(ContentMedia, { id: c.coverMediaId });
  const items: ItemSnapshot[] = [{ id: randomUUID(), resourceId: c.id, resourceType: 'COURSE', productId: null,
    title: c.title, skuAttributes: [], coverUrl: image.publicUrl, quantity: 1, unitPriceCents: c.priceCents,
    subtotalCents: c.priceCents, refundedQuantity: 0, refundedAmountCents: 0 }];
  const q = m.create(Quote, { id: randomUUID(), userId, type: 'COURSE', address: null, items, shippingFeeCents: 0, expiresAt: new Date(Date.now() + 600000) });
  await m.save(q);
  return { quoteId: q.id, type: q.type, items, itemsAmountCents: c.priceCents, shippingFeeCents: 0,
    payableAmountCents: c.priceCents, currency: 'CNY', address: null, expiresAt: q.expiresAt };
}
export async function validateCourseOrder(m: EntityManager, q: Quote) {
  const item = q.items[0];
  const c = await lockCourse(m, item.resourceId); await courseSellable(m, c, q.userId);
  if (q.items.length !== 1 || item.resourceType !== 'COURSE' || item.quantity !== 1 || q.shippingFeeCents !== 0 || c.priceCents !== item.unitPriceCents) conflict('QUOTE_CHANGED', '课程价格已变更，请重新试算');
  const pending = await m.getRepository(Order).createQueryBuilder('o').innerJoin(OrderItem, 'i', 'i.orderId = o.id')
    .where('o.userId = :userId AND i.courseId = :courseId', { userId: q.userId, courseId: c.id })
    .andWhere("o.status = 'PENDING_PAYMENT' AND o.paymentDeadlineAt > :now", { now: new Date() }).getExists();
  if (pending) conflict('COURSE_ORDER_PENDING', '该课程已有待付款订单，请继续付款或先取消');
}
export async function grantCourse(m: EntityManager, o: Order) {
  const item = await m.findOneByOrFail(OrderItem, { orderId: o.id });
  const c = await lockCourse(m, item.courseId!);
  // No new payment for an offline course; the already paid entitlement survives unpublishing.
  await courseSellable(m, c, o.userId);
  await m.insert(CourseEntitlement, { id: randomUUID(), userId: o.userId, courseId: c.id, orderId: o.id, status: 'ACTIVE', revokedAt: null });
}
