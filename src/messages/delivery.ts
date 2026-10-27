import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { MessageCategory, MessageResource, UserMessage, UserMessageState } from './entities';

export async function lockMessageState(m: EntityManager, userId: string) {
  if (!m.queryRunner?.isTransactionActive) throw new Error('Message writes require a business transaction');
  // Do not lock users/business rows here: callers may already hold an order lock.
  await m.query('INSERT INTO user_message_states (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id', [userId]);
  return m.findOneOrFail(UserMessageState, { where: { userId }, lock: { mode: 'pessimistic_write' } });
}

export interface MessageDelivery {
  userId: string; eventKey: string; category: MessageCategory; title: string; body: string;
  resourceType?: MessageResource; resourceId?: string;
}

/** Commit/rollback together with the business change. No asynchronous, lossy event handler. */
export async function deliverMessage(m: EntityManager, input: MessageDelivery): Promise<void> {
  const state = await lockMessageState(m, input.userId);
  // Tombstones retain this unique key, preventing redelivery even after inbox deletion.
  if (await m.existsBy(UserMessage, { userId: input.userId, eventKey: input.eventKey })) return;
  state.nextSequence = (BigInt(state.nextSequence) + 1n).toString();
  state.revision = (BigInt(state.revision) + 1n).toString();
  state.unreadCount++;
  await m.insert(UserMessage, { ...input, id: randomUUID(), sequence: state.nextSequence,
    resourceType: input.resourceType ?? null, resourceId: input.resourceId ?? null,
    readAt: null, deletedAt: null, createdAt: new Date() });
  await m.save(state);
}
