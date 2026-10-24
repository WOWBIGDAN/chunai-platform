import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException, Principal } from '../common/http';
import { AuthSession, User } from '../database/entities';
import { AdminPrincipal } from './admin-auth';
import { AdminAccount, AdminSession, AuditLog, IdempotencyRecord, Versioned } from './entities';
import { Permission } from './permissions';

export type Actor = { kind: 'user'; principal: Principal } | { kind: 'admin'; principal: AdminPrincipal; permission: Permission };
export const actorKey = (a: Actor) => a.kind === 'user' ? `user:${a.principal.user.id}` : `admin:${a.principal.account.id}`;
export const actorId = (a: Actor) => actorKey(a).split(':')[1];
export const missing = () => new ApiException(404, 'RESOURCE_NOT_FOUND', '资源不存在');
export function conflict(code: string, message: string): never { throw new ApiException(409, code, message); }
export function checkVersion(value: Versioned, version: number) {
  if (value.version !== version) conflict('VERSION_CONFLICT', '数据已更新，请刷新后重试');
}
export function touch(value: Versioned) { value.version++; value.updatedAt = new Date(); }
export function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined)) as Partial<T>;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([,v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function page<T>(items: T[], total: number, q: { page: number; pageSize: number }) {
  return { items, total, page: q.page, pageSize: q.pageSize, hasNext: q.page * q.pageSize < total };
}
@Injectable()
export class CommerceTransaction {
  constructor(private readonly db: DataSource) {}
  private async authorize(m: EntityManager, a: Actor) {
    if (a.kind === 'admin') {
      const account = await m.findOne(AdminAccount, { where: { id: a.principal.account.id }, lock: { mode: 'pessimistic_write' } });
      const session = await m.findOneBy(AdminSession, { id: a.principal.sessionId, adminId: a.principal.account.id });
      if (!account?.enabled || !session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw new ApiException(401, 'TOKEN_INVALID', '会话已失效');
      if (!account.permissions.includes(a.permission)) throw new ApiException(403, 'PERMISSION_DENIED', '没有此操作权限');
    } else {
      const u = await m.findOne(User, { where: { id: a.principal.user.id }, lock: { mode: 'pessimistic_write' } });
      const s = await m.findOneBy(AuthSession, { id: a.principal.sessionId, userId: a.principal.user.id });
      if (u?.status !== 'ACTIVE' || !s || s.revokedAt || s.expiresAt.getTime() <= Date.now()) throw new ApiException(401, 'TOKEN_INVALID', '会话已失效');
    }
  }
  async run<T>(actor: Actor, work: (m: EntityManager) => Promise<T>, idempotency?: { key: string | undefined; action: string; body: unknown }): Promise<T> {
    if (idempotency && !/^[A-Za-z0-9_-]{16,64}$/.test(idempotency.key ?? '')) {
      throw new ApiException(400, 'IDEMPOTENCY_KEY_REQUIRED', '请提供 16–64 位 Idempotency-Key');
    }
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.transaction('READ COMMITTED', async m => {
          await this.authorize(m, actor);
          let record: IdempotencyRecord | null = null;
          if (idempotency) {
            const requestHash = hash(canonical([idempotency.action, idempotency.body]));
            record = await m.findOneBy(IdempotencyRecord, { actorKey: actorKey(actor), requestKey: idempotency.key });
            if (record) {
              if (record.requestHash !== requestHash) conflict('IDEMPOTENCY_CONFLICT', '幂等键已用于其他请求');
              return record.response as T;
            }
            record = m.create(IdempotencyRecord, { id: randomUUID(), actorKey: actorKey(actor), requestKey: idempotency.key!, requestHash });
          }
          const data = await work(m);
          if (record) { record.response = JSON.parse(JSON.stringify(data)); await m.save(record); }
          return data;
        });
      } catch (e) {
        const code = (e as { driverError?: { code?: string } }).driverError?.code;
        if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code ?? '') && attempt < 2) continue;
        if (code === 'ER_DUP_ENTRY') conflict('RESOURCE_CONFLICT', '编号、规格组合或业务记录已存在');
        if (code === 'ER_ROW_IS_REFERENCED_2') conflict('RESOURCE_IN_USE', '资源已有业务引用，不能删除');
        throw e;
      }
    }
  }
  async audit(m: EntityManager, actor: Actor, action: string, resourceId: string, details: Record<string, unknown> = {}) {
    await m.save(m.create(AuditLog, { id: randomUUID(), actorKey: actorKey(actor), action, resourceId, details }));
  }
}
