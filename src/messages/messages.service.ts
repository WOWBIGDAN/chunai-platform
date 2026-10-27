import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In, IsNull } from 'typeorm';
import { ApiException } from '../common/http';
import { Actor, CommerceTransaction, missing } from '../commerce/transaction';
import { User } from '../database/entities';
import { deliverMessage, lockMessageState } from './delivery';
import { UserMessage, UserMessageState } from './entities';
import { AdminMessageDto, MessageListDto } from './messages.dto';

const invalid = (message: string) => new ApiException(400, 'VALIDATION_ERROR', message);
const summary = (s: UserMessageState | null) => ({ revision: String(s?.revision ?? '0'),
  unreadCount: s?.unreadCount ?? 0, latestSequence: String(s?.nextSequence ?? '0') });
const view = (v: UserMessage) => ({ id: v.id, sequence: String(v.sequence), category: v.category,
  title: v.title, body: v.body, resourceType: v.resourceType, resourceId: v.resourceId,
  readAt: v.readAt, createdAt: v.createdAt });

@Injectable()
export class MessagesService {
  constructor(private readonly db: DataSource, private readonly tx: CommerceTransaction) {}

  async poll(userId: string, revision: string) {
    const state = summary(await this.db.getRepository(UserMessageState).findOneBy({ userId }));
    return { changed: state.revision !== revision, ...state, pollAfterSeconds: 60 };
  }

  async list(userId: string, q: MessageListDto) {
    if (q.afterSequence !== undefined && q.beforeSequence !== undefined) throw invalid('只能选择一个消息分页方向');
    const ascending = q.afterSequence !== undefined;
    const query = this.db.getRepository(UserMessage).createQueryBuilder('m')
      .where('m.userId = :userId AND m.deletedAt IS NULL', { userId });
    if (ascending) query.andWhere('m.sequence > :after', { after: q.afterSequence });
    if (q.beforeSequence !== undefined) query.andWhere('m.sequence < :before', { before: q.beforeSequence });
    if (q.unreadOnly) query.andWhere('m.readAt IS NULL');
    const rows = await query.orderBy('m.sequence', ascending ? 'ASC' : 'DESC').take(q.limit + 1).getMany();
    const hasMore = rows.length > q.limit, items = rows.slice(0, q.limit).map(view);
    const end = items.at(-1)?.sequence ?? null;
    return { items, hasMore, nextBeforeSequence: !ascending && hasMore ? end : null,
      nextAfterSequence: ascending ? end ?? q.afterSequence! : null };
  }

  async get(userId: string, id: string) {
    const message = await this.db.getRepository(UserMessage).findOneBy({ id, userId, deletedAt: IsNull() });
    if (!message) throw missing();
    return view(message);
  }

  async read(actor: Actor, ids: string[]) {
    if (actor.kind !== 'user') throw new ApiException(403, 'PERMISSION_DENIED', '仅用户可操作自己的消息');
    const userId = actor.principal.user.id;
    return this.tx.run(actor, async m => {
      const state = await lockMessageState(m, userId);
      const rows = await m.findBy(UserMessage, { id: In(ids), userId, deletedAt: IsNull() });
      if (rows.length !== ids.length) throw missing();
      const unreadIds = rows.filter(v => !v.readAt).map(v => v.id);
      if (unreadIds.length) {
        await m.update(UserMessage, { id: In(unreadIds), userId, readAt: IsNull(), deletedAt: IsNull() }, { readAt: new Date() });
        state.unreadCount -= unreadIds.length; state.revision = (BigInt(state.revision) + 1n).toString(); await m.save(state);
      }
      return { updated: unreadIds.length, ...summary(state) };
    });
  }

  async readAll(actor: Actor, throughSequence: string) {
    if (actor.kind !== 'user') throw new ApiException(403, 'PERMISSION_DENIED', '仅用户可操作自己的消息');
    const userId = actor.principal.user.id;
    return this.tx.run(actor, async m => {
      const state = await lockMessageState(m, userId);
      if (BigInt(throughSequence) > BigInt(state.nextSequence)) throw invalid('已读范围不能超过当前消息序号');
      const result = await m.createQueryBuilder().update(UserMessage).set({ readAt: new Date() })
        .where('user_id = :userId AND deleted_at IS NULL AND read_at IS NULL AND sequence <= :sequence', { userId, sequence: throughSequence }).execute();
      const updated = result.affected ?? 0;
      if (updated) { state.unreadCount -= updated; state.revision = (BigInt(state.revision) + 1n).toString(); await m.save(state); }
      return { updated, ...summary(state) };
    });
  }

  async remove(actor: Actor, id: string) {
    if (actor.kind !== 'user') throw new ApiException(403, 'PERMISSION_DENIED', '仅用户可操作自己的消息');
    const userId = actor.principal.user.id;
    return this.tx.run(actor, async m => {
      const state = await lockMessageState(m, userId);
      const message = await m.findOneBy(UserMessage, { id, userId, deletedAt: IsNull() });
      if (!message) throw missing();
      await m.update(UserMessage, { id, userId }, { deletedAt: new Date() });
      if (!message.readAt) state.unreadCount--;
      state.revision = (BigInt(state.revision) + 1n).toString(); await m.save(state);
      return { updated: 1, ...summary(state) };
    });
  }

  async send(actor: Actor, dto: AdminMessageDto, key?: string) {
    return this.tx.run(actor, async m => {
      const recipients = await m.find(User, { where: { id: In(dto.userIds), status: 'ACTIVE' }, select: { id: true } });
      if (recipients.length !== dto.userIds.length) throw missing();
      const batchId = randomUUID(), eventKey = `admin:${batchId}`;
      // Stable lock order across multi-recipient sends from different administrators.
      for (const userId of [...dto.userIds].sort()) {
        await deliverMessage(m, { userId, eventKey, category: 'SYSTEM', title: dto.title, body: dto.body });
      }
      const messages = await m.find(UserMessage, { where: { userId: In(dto.userIds), eventKey }, select: { id: true, userId: true } });
      await this.tx.audit(m, actor, 'message.send', batchId, { recipientCount: recipients.length, userIds: dto.userIds });
      return { sentCount: messages.length, messageIds: messages.map(v => v.id) };
    }, { key, action: 'message.send', body: dto });
  }
}
